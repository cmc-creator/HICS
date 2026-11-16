import { createId, getStore, saveStore } from './_store.js';

// Transactional email via Resend (https://resend.com).
//
// Requires RESEND_API_KEY and RESEND_FROM_EMAIL. When either is
// missing the helper never throws: it records a best-effort
// 'email_not_configured' notification in the store and returns
// { sent: false, reason: 'not_configured' } so callers (password
// reset, admin invites) can keep their anti-enumeration /
// success-first behavior.

export function getAppBaseUrl() {
  return String(process.env.APP_BASE_URL || 'https://www.nyxhicslab.com').replace(/\/+$/, '');
}

export function buildPasswordSetUrl(rawToken) {
  return `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

export async function sendEmail({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    try {
      const store = await getStore();
      if (!Array.isArray(store.notifications)) {
        store.notifications = [];
      }
      store.notifications.unshift({
        id: createId('notify'),
        type: 'email_not_configured',
        recipient: String(to || ''),
        subject: String(subject || ''),
        message: 'Email delivery is not configured (RESEND_API_KEY and RESEND_FROM_EMAIL are required); this message was not sent.',
        sentAt: new Date().toISOString(),
      });
      store.notifications = store.notifications.slice(0, 1000);
      await saveStore(store);
    } catch {
      // Best effort only - email configuration problems must not
      // break the calling flow.
    }
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [String(to)],
        subject: String(subject),
        text: String(text || ''),
        ...(html ? { html: String(html) } : {}),
      }),
    });

    if (!response.ok) {
      return { sent: false, reason: 'provider_error', status: response.status };
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: 'network_error',
      error: error instanceof Error ? error.message : 'Unknown email transport error',
    };
  }
}
