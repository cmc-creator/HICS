import { publicApiRequest } from './apiClient';

// Reads the facility's AI assistant switch (GET /api/admin/settings)
// once per page load and caches the promise. The assistant entry
// points (GlobalAssistant launcher, ChatbotPage) use it to hide
// themselves when a facility admin has turned the assistant off.
//
// A failed read resolves to ENABLED on purpose: the server enforces
// the switch on every /api/chat call regardless of what the UI
// shows, so a transient settings-read failure must not make the
// assistant vanish for everyone - the worst case is the launcher
// renders and the server answers with its "disabled for this
// facility" message.
let cached: Promise<boolean> | null = null;

export function fetchAiAssistantEnabled(): Promise<boolean> {
  if (!cached) {
    cached = publicApiRequest<{ aiAssistantEnabled?: boolean }>('/admin/settings', { method: 'GET' })
      .then((result) => result?.aiAssistantEnabled !== false)
      .catch(() => true);
  }
  return cached;
}

export function resetAiAssistantEnabledCache(): void {
  cached = null;
}
