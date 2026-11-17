import { requireAuth } from '../../_auth.js';
import { decryptTotpSecret, generateRecoveryCodes, hashRecoveryCode, verifyTotp } from '../../_mfa.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../../_security.js';
import { appendAuditLog, json, reloadStore, saveStore } from '../../_store.js';

// Confirms an MFA enrollment started by /enroll: the user proves
// their authenticator works by producing a valid code for the
// pending secret. On success the secret goes live and the user is
// shown their one-time recovery codes - the ONLY time the codes
// are ever displayed; only their hashes are stored.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, {
    scope: 'auth-mfa-confirm',
    maxRequests: 10,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  const body = parseJsonBody(req);
  if (!body || typeof body !== 'object') {
    return json(res, 400, { error: 'Invalid JSON payload' });
  }
  const validationError = validateBodyFields(body, [
    { name: 'code', required: true, type: 'string', minLength: 6, maxLength: 10 },
  ]);
  if (validationError) {
    return json(res, 400, { error: validationError });
  }

  const store = await reloadStore();
  const users = Array.isArray(store.users) ? store.users : [];
  const user = users.find(
    (candidate) => String(candidate?.email || '').toLowerCase() === String(auth.claims.email || '').toLowerCase(),
  );
  if (!user) {
    return json(res, 404, { error: 'Account not found.' });
  }

  if (user.mfa?.enabled) {
    return json(res, 409, { error: 'MFA is already enabled for this account.' });
  }

  const pendingSecret = user.mfaPending ? decryptTotpSecret(user.mfaPending.secretEncrypted) : null;
  if (!pendingSecret) {
    return json(res, 400, { error: 'No enrollment in progress. Start enrollment first.' });
  }

  if (!verifyTotp(pendingSecret, body.code)) {
    return json(res, 400, { error: 'That code did not match. Check your authenticator and try again.' });
  }

  const recoveryCodes = generateRecoveryCodes();
  user.mfa = {
    enabled: true,
    secretEncrypted: user.mfaPending.secretEncrypted,
    recoveryCodeHashes: recoveryCodes.map((code) => hashRecoveryCode(code)),
    enrolledAt: new Date().toISOString(),
  };
  delete user.mfaPending;
  appendAuditLog(store, 'mfa_enabled', { email: user.email });
  await saveStore(store);

  return json(res, 200, {
    mfaEnabled: true,
    recoveryCodes,
  });
}
