import { addAuditLog, createId, getStore, json } from '../_store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const body = req.body ?? {};
  if (!body.type || typeof body.type !== 'string') {
    return json(res, 400, { error: 'type is required' });
  }

  const store = getStore();
  const notification = {
    id: createId('notify'),
    type: body.type,
    recipient: typeof body.recipient === 'string' ? body.recipient : 'system',
    subject: typeof body.subject === 'string' ? body.subject : '',
    message: typeof body.message === 'string' ? body.message : '',
    metadata: typeof body.metadata === 'object' && body.metadata ? body.metadata : {},
    sentAt: new Date().toISOString(),
  };

  store.notifications.unshift(notification);
  store.notifications = store.notifications.slice(0, 1000);
  addAuditLog('notification_sent', { type: notification.type, recipient: notification.recipient });

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
