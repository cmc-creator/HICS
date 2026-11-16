import { consumePasswordToken, hashPassword } from '../_passwords.js';
import { appendAuditLog, json, reloadStore, saveStore } from '../_store.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, {
    scope: 'auth-reset-password',
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
  })) {
    return;
  }

  const body = parseJsonBody(req);
  if (!body || typeof body !== 'object') {
    return json(res, 400, { error: 'Invalid JSON payload' });
  }

  const validationError = validateBodyFields(body, [
    { name: 'token', required: true, type: 'string', minLength: 16, maxLength: 256 },
    { name: 'password', required: true, type: 'string', minLength: 10, maxLength: 256 },
  ]);
  if (validationError) {
    return json(res, 400, { error: validationError });
  }

  // Reload before consuming the token: the token was written to
  // the backing store by whichever instance handled the
  // forgot-password request, and this instance's cache may predate
  // it. Without the reload, fresh links read as invalid/expired.
  const store = await reloadStore();
  const user = consumePasswordToken(store, String(body.token));
  if (!user) {
    return json(res, 400, { error: 'This password link is invalid or has expired. Request a new one and try again.' });
  }

  user.passwordHash = hashPassword(String(body.password));
  delete user.passwordTokenHash;
  delete user.passwordTokenExpiresAt;

  // A password change ends every existing session for the account:
  // refresh sessions live in the store keyed by lowercased email.
  if (Array.isArray(store.refreshTokens)) {
    const userEmail = String(user.email || '').toLowerCase();
    store.refreshTokens = store.refreshTokens.filter(
      (session) => String(session?.email || '').toLowerCase() !== userEmail,
    );
  }

  appendAuditLog(store, 'password_reset_completed', { userId: user.id });
  await saveStore(store);

  return json(res, 200, {
    message: 'Your password has been set. You can now sign in.',
  });
}
