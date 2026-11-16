import { requireAuth } from '../_auth.js';
import { authorizeEndpoint } from '../_policy.js';
import { enforceRateLimit, parseJsonBody } from '../_security.js';
import { appendAuditLog, getAiAssistantEnabled, getStore, json, reloadStore, saveStore } from '../_store.js';

// Facility settings. Today this carries one switch - the AI
// assistant on/off toggle hospital reviewers ask for - kept in the
// store so a facility admin can change it without a redeploy
// (the previous state of the art was deployment-level API keys:
// AI on for everyone or off for everyone).
//
// GET is readable by every signed-in role (see ADMIN_SETTINGS in
// _policy.js) because the frontend needs the flag to decide
// whether to render the assistant. PUT is admin-only.

export default async function handler(req, res) {
  if (!enforceRateLimit(req, res, {
    scope: 'admin-settings',
    maxRequests: 60,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (!authorizeEndpoint(res, 'ADMIN_SETTINGS', req.method, auth.claims)) {
    return;
  }

  if (req.method === 'GET') {
    const store = await getStore();
    return json(res, 200, {
      aiAssistantEnabled: getAiAssistantEnabled(store),
    });
  }

  if (req.method === 'PUT') {
    const body = parseJsonBody(req);
    if (!body || typeof body !== 'object') {
      return json(res, 400, { error: 'Invalid JSON payload' });
    }
    if (typeof body.aiAssistantEnabled !== 'boolean') {
      return json(res, 400, { error: 'aiAssistantEnabled must be a boolean' });
    }

    // Reload before writing: a settings write is rare and must
    // not clobber another instance's recent changes with this
    // warm instance's stale whole-store copy.
    const store = await reloadStore();
    if (!store.settings || typeof store.settings !== 'object' || Array.isArray(store.settings)) {
      store.settings = {};
    }
    store.settings.aiAssistantEnabled = body.aiAssistantEnabled;
    appendAuditLog(store, 'settings_ai_assistant_toggled', {
      enabled: body.aiAssistantEnabled,
      by: String(auth.claims.email || ''),
    });
    await saveStore(store);

    return json(res, 200, {
      aiAssistantEnabled: getAiAssistantEnabled(store),
    });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
