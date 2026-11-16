import { publicApiRequest } from './apiClient';

interface NotificationPayload {
  type: string;
  recipient?: string;
  subject?: string;
  message: string;
  metadata?: Record<string, string | number | boolean>;
}

// Best-effort by design, but never silent (audit S1): a swallowed
// 401/403 here is how client-originated notifications and audit
// entries used to vanish without a trace.
function logFailure(operation: string, error: unknown) {
  const status = (error as { status?: number } | null)?.status;
  console.error(
    `[NyxHICSlab] ${operation} failed${typeof status === 'number' ? ` (HTTP ${status})` : ''}.`,
    error,
  );
}

export async function sendNotification(payload: NotificationPayload) {
  try {
    await publicApiRequest('/notifications/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // Notification delivery is best-effort.
    logFailure('POST /notifications/send', error);
  }
}

export async function writeAuditLog(action: string, data?: Record<string, string | number | boolean>) {
  try {
    await publicApiRequest('/audit/logs', {
      method: 'POST',
      body: JSON.stringify({ action, data }),
    });
  } catch (error) {
    // Audit write failures should not block UX.
    logFailure('POST /audit/logs', error);
  }
}
