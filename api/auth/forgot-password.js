// TODO: wire to email provider (SendGrid, AWS SES, etc.)
import { appendAuditLog, createId, json, updateStore } from '../_store.js';
import { enforceRateLimit, parseJsonBody } from '../_security.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!await enforceRateLimit(req, res, { scope: 'auth-forgot-password', maxRequests: 5, windowMs: 15 * 60 * 1000 })) {
    return;
  }

  const body = parseJsonBody(req);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || !EMAIL_REGEX.test(email)) {
    return json(res, 400, { error: 'A valid enterprise email is required.' });
  }

  // TODO: look up user by email in your tenant database
  // TODO: generate a secure, time-limited reset token (e.g., crypto.randomBytes(32).toString('hex'))
  // TODO: store token hash with expiry (e.g., Redis or database)
  // TODO: send email via provider — include link: https://app.nyxhicslab.com/reset-password?token=<token>

  await updateStore((store) => {
    store.notifications.unshift({
      id: createId('notify'),
      type: 'password_reset_requested',
      recipient: email,
      subject: 'NyxHICSlab Password Reset Request',
      message: 'A password reset was requested for this account.',
      sentAt: new Date().toISOString(),
    });
    store.notifications = store.notifications.slice(0, 1000);
    appendAuditLog(store, 'forgot_password_requested', {});
  });

  // Always return success to prevent email enumeration.
  return json(res, 200, {
    message: 'If that address is registered, you will receive a password reset email shortly.',
  });
}
