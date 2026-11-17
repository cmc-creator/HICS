import { createId, getStore, saveStore } from './_store.js';

// Transactional email via Resend (https://resend.com).
//
// Requires RESEND_API_KEY and RESEND_FROM_EMAIL. When either is
// missing the helper never throws: it records a best-effort
// 'email_not_configured' notification in the store and returns
// { sent: false, reason: 'not_configured' } so callers (password
// reset, admin invites) can keep their anti-enumeration /
// success-first behavior.

let warnedAboutDefaultBaseUrl = false;

export function getAppBaseUrl() {
  const configured = String(process.env.APP_BASE_URL || '').trim();
  if (!configured && process.env.NODE_ENV === 'production' && !warnedAboutDefaultBaseUrl) {
    // The default below is the public demo site. On a customer
    // deployment that forgot APP_BASE_URL, every password-set,
    // reset, invite, and contract-signing link would send that
    // customer's users to the wrong site (deployment runbook
    // blocker #1) - and from the outside it looks like "the
    // email link is broken", not a config error. Shout once per
    // cold start, in the same loud-log pattern as S3/S4. Local
    // development keeps the default quietly.
    warnedAboutDefaultBaseUrl = true;
    console.error(
      '[NyxHICSlab] WARNING: APP_BASE_URL is not set in production - '
      + 'password-set, reset, invite, and signing links are being built '
      + 'with the default https://www.nyxhicslab.com. On a customer '
      + 'deployment this sends every user to the WRONG site. Set '
      + 'APP_BASE_URL to this deployment\'s own URL.',
    );
  }
  return String(configured || 'https://www.nyxhicslab.com').replace(/\/+$/, '');
}

export function buildPasswordSetUrl(rawToken) {
  return `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

export async function sendEmail({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    // Loud on the server (audit S3): a silently undelivered
    // password-reset or invite email is indistinguishable from
    // success for the user, which is exactly how the reset saga
    // hid. The store notification below is the in-app trace; this
    // log is the operator's.
    console.error(
      `[NyxHICSlab] Email NOT sent (not configured): to=${String(to || '')} subject=${String(subject || '')} - set RESEND_API_KEY and RESEND_FROM_EMAIL.`,
    );
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
      console.error(
        `[NyxHICSlab] Email provider rejected a send (status ${response.status}): to=${String(to || '')} subject=${String(subject || '')}`,
      );
      return { sent: false, reason: 'provider_error', status: response.status };
    }

    return { sent: true };
  } catch (error) {
    console.error(
      `[NyxHICSlab] Email send failed: to=${String(to || '')} subject=${String(subject || '')}:`,
      error instanceof Error ? error.message : error,
    );
    return {
      sent: false,
      reason: 'network_error',
      error: error instanceof Error ? error.message : 'Unknown email transport error',
    };
  }
}
