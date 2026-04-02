import { publicApiRequest } from './apiClient';

interface NotificationPayload {
  type: string;
  recipient?: string;
  subject?: string;
  message: string;
  metadata?: Record<string, string | number | boolean>;
}

export async function sendNotification(payload: NotificationPayload) {
  try {
    await publicApiRequest('/notifications/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    // Notification delivery is best-effort.
  }
}

export async function writeAuditLog(action: string, data?: Record<string, string | number | boolean>) {
  try {
    await publicApiRequest('/audit/logs', {
      method: 'POST',
      body: JSON.stringify({ action, data }),
    });
  } catch {
    // Audit write failures should not block UX.
  }
}
