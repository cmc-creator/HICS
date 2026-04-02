// api/auth/forgot-password.js - Vercel serverless function for password reset requests
// TODO: wire to email provider (SendGrid, AWS SES, etc.)
import { addAuditLog, createId, getStore } from '../_store.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body ?? {};

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'A valid enterprise email is required.' });
  }

  // TODO: look up user by email in your tenant database
  // TODO: generate a secure, time-limited reset token (e.g., crypto.randomBytes(32).toString('hex'))
  // TODO: store token hash with expiry (e.g., Redis or database)
  // TODO: send email via provider — include link: https://app.nyxhicslab.com/reset-password?token=<token>

  const store = getStore();
  store.notifications.unshift({
    id: createId('notify'),
    type: 'password_reset_requested',
    recipient: email.toLowerCase(),
    subject: 'NyxHICSlab Password Reset Request',
    message: 'A password reset was requested for this account.',
    sentAt: new Date().toISOString(),
  });
  store.notifications = store.notifications.slice(0, 1000);

  addAuditLog('forgot_password_requested', { email: email.toLowerCase() });

  console.log(`[forgot-password] Reset requested for: ${email}`);

  // Always return success to prevent email enumeration
  return res.status(200).json({
    message: 'If that address is registered, you will receive a password reset email shortly.',
  });
}
