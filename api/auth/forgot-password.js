import { buildPasswordSetUrl, sendEmail } from '../_email.js';
import { createPasswordToken } from '../_passwords.js';
import { appendAuditLog, createId, getStore, json, saveStore } from '../_store.js';
import { enforceRateLimit, parseJsonBody } from '../_security.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, { scope: 'auth-forgot-password', maxRequests: 5, windowMs: 15 * 60 * 1000 })) {
    return;
  }

  const body = parseJsonBody(req);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!email || !EMAIL_REGEX.test(email)) {
    return json(res, 400, { error: 'A valid enterprise email is required.' });
  }

  const store = await getStore();
  if (!Array.isArray(store.notifications)) {
    store.notifications = [];
  }
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

  // Only a matching active user gets a token and an email. The
  // response below is identical either way (anti-enumeration).
  const users = Array.isArray(store.users) ? store.users : [];
  const user = users.find((candidate) => (
    String(candidate?.email || '').toLowerCase() === email && candidate.status === 'active'
  ));

  let resetUrl = '';
  if (user) {
    const rawToken = createPasswordToken(store, user);
    resetUrl = buildPasswordSetUrl(rawToken);
  }

  await saveStore(store);

  if (user && resetUrl) {
    await sendEmail({
      to: email,
      subject: 'Set your NyxHICSlab password',
      text: [
        'Hello,',
        '',
        'We received a request to reset the password for your NyxHICSlab account.',
        'Use the link below to set a new password. The link expires in 1 hour.',
        '',
        resetUrl,
        '',
        'If you did not request this, you can ignore this email - your password will not change.',
        '',
        '- NyxHICSlab',
      ].join('\n'),
      html: [
        '<p>Hello,</p>',
        '<p>We received a request to reset the password for your NyxHICSlab account. ',
        'Use the link below to set a new password. The link expires in 1 hour.</p>',
        `<p><a href="${resetUrl}">Set your password</a></p>`,
        '<p>If you did not request this, you can ignore this email - your password will not change.</p>',
        '<p>- NyxHICSlab</p>',
      ].join(''),
    });
  }

  // Always return success to prevent email enumeration.
  return json(res, 200, {
    message: 'If that address is registered, you will receive a password reset email shortly.',
  });
}
