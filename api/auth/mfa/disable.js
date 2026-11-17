import { requireAuth } from '../../_auth.js';
import { verifyUserMfaCode } from '../../_mfa.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../../_security.js';
import { appendAuditLog, json, reloadStore, saveStore } from '../../_store.js';

// Disables MFA for the signed-in user. A valid authenticator or
// recovery code is required, so a hijacked session alone cannot
// strip the second factor off the account.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, {
    scope: 'auth-mfa-disable',
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
    { name: 'code', required: true, type: 'string', minLength: 6, maxLength: 20 },
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

  if (!user.mfa?.enabled) {
    return json(res, 400, { error: 'MFA is not enabled for this account.' });
  }

  if (!verifyUserMfaCode(user, body.code)) {
    return json(res, 401, { error: 'Invalid code.' });
  }

  delete user.mfa;
  delete user.mfaPending;
  appendAuditLog(store, 'mfa_disabled', { email: user.email });
  await saveStore(store);

  return json(res, 200, { mfaEnabled: false });
}
