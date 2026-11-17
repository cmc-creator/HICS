import { requireAuth } from '../../_auth.js';
import { enforceRateLimit } from '../../_security.js';
import { getStore, json } from '../../_store.js';

// MFA status for the signed-in user, for the Account page.
// canEnroll is false for SSO-only accounts (no password
// credential): their identity provider owns MFA, and this TOTP
// layer only guards password sign-in.

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, {
    scope: 'auth-mfa-status',
    maxRequests: 30,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  const store = await getStore();
  const users = Array.isArray(store.users) ? store.users : [];
  const user = users.find(
    (candidate) => String(candidate?.email || '').toLowerCase() === String(auth.claims.email || '').toLowerCase(),
  );

  return json(res, 200, {
    mfaEnabled: Boolean(user?.mfa?.enabled),
    canEnroll: Boolean(user?.passwordHash),
    enrollmentPending: Boolean(user?.mfaPending),
  });
}
