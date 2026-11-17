import { requireAuth } from '../../_auth.js';
import { buildOtpAuthUri, encryptTotpSecret, generateTotpSecret } from '../../_mfa.js';
import { enforceRateLimit } from '../../_security.js';
import { json, reloadStore, saveStore } from '../../_store.js';

// Starts opt-in MFA enrollment for a password account: generates
// a TOTP secret and parks it on the user record as PENDING. The
// secret only becomes active when /confirm proves the user's
// authenticator produces valid codes for it - a half-finished
// enrollment never locks anyone out.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, {
    scope: 'auth-mfa-enroll',
    maxRequests: 10,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  const store = await reloadStore();
  const users = Array.isArray(store.users) ? store.users : [];
  const user = users.find(
    (candidate) => String(candidate?.email || '').toLowerCase() === String(auth.claims.email || '').toLowerCase(),
  );
  if (!user) {
    return json(res, 404, { error: 'Account not found.' });
  }

  if (!user.passwordHash) {
    return json(res, 400, {
      error: 'MFA is only available for password accounts. Accounts that sign in with Google use their identity provider\u2019s MFA.',
    });
  }

  if (user.mfa?.enabled) {
    return json(res, 409, { error: 'MFA is already enabled for this account. Disable it before enrolling again.' });
  }

  const secret = generateTotpSecret();
  const secretEncrypted = encryptTotpSecret(secret);
  if (!secretEncrypted) {
    console.error('[NyxHICSlab] MFA enrollment failed: secret encryption unavailable (TOKEN_SIGNING_SECRET missing).');
    return json(res, 500, { error: 'MFA enrollment is unavailable right now.' });
  }

  user.mfaPending = {
    secretEncrypted,
    createdAt: new Date().toISOString(),
  };
  await saveStore(store);

  return json(res, 200, {
    secret,
    otpauthUri: buildOtpAuthUri({ account: user.email, secret }),
  });
}
