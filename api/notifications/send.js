import { appendAuditLog, createId, json, updateStore } from '../_store.js';
import { requireAuth } from '../_auth.js';
import { authorizeEndpoint } from '../_policy.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';

export default async function handler(req, res) {
  if (!await enforceRateLimit(req, res, {
    scope: 'notifications-send',
    maxRequests: 60,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (!authorizeEndpoint(res, 'NOTIFICATIONS_SEND', req.method, auth.claims)) {
    return;
  }

  const body = parseJsonBody(req);
  if (!body || typeof body !== 'object') {
    return json(res, 400, { error: 'Invalid JSON payload' });
  }

  const validationError = validateBodyFields(body, [
    { name: 'type', required: true, type: 'string', minLength: 2, maxLength: 80 },
    { name: 'recipient', required: false, type: 'string', maxLength: 256 },
    { name: 'subject', required: false, type: 'string', maxLength: 200 },
    { name: 'message', required: false, type: 'string', maxLength: 2000 },
  ]);
  if (validationError) {
    return json(res, 400, { error: validationError });
  }

  const metadata = typeof body.metadata === 'object' && body.metadata ? body.metadata : {};
  if (JSON.stringify(metadata).length > 4096) {
    return json(res, 400, { error: 'Notification metadata exceeds maximum size' });
  }

  const notification = {
    id: createId('notify'),
    type: body.type,
    recipient: typeof body.recipient === 'string' ? body.recipient : 'system',
    subject: typeof body.subject === 'string' ? body.subject : '',
    message: typeof body.message === 'string' ? body.message : '',
    metadata,
    facility: String(auth.claims.facility || 'all'),
    organization: String(auth.claims.organization || 'Enterprise Health System'),
    sentAt: new Date().toISOString(),
  };

  await updateStore((store) => {
    store.notifications.unshift(notification);
    store.notifications = store.notifications.slice(0, 1000);
    appendAuditLog(store, 'notification_sent', {
      type: notification.type,
      recipient: notification.recipient,
      actorEmail: String(auth.claims.email || ''),
      actorRole: String(auth.claims.role || ''),
      facility: notification.facility,
    });
  });

  // Optional webhook integration for real notification relay
  const webhook = process.env.NOTIFICATION_WEBHOOK_URL;
  if (webhook) {
    try {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification),
      });
    } catch (error) {
      console.error('notification webhook error', error);
    }
  }

  return json(res, 202, { accepted: true, notificationId: notification.id });
}
