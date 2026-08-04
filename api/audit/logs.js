import { appendAuditLog, getStore, json, saveStore } from '../_store.js';
import { canManageData, requireAuth } from '../_auth.js';
import { authorizeEndpoint } from '../_policy.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';

export default async function handler(req, res) {
  if (!enforceRateLimit(req, res, {
    scope: 'audit-logs',
    maxRequests: 100,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (!authorizeEndpoint(res, 'AUDIT_LOGS', req.method, auth.claims)) {
    return;
  }

  const store = await getStore();
  const requesterFacility = String(auth.claims.facility || 'all');

  if (req.method === 'GET') {
    if (!canManageData(auth.claims)) {
      return json(res, 403, { error: 'Forbidden' });
    }

    const scoped = requesterFacility === 'all'
      ? store.auditLogs
      : store.auditLogs.filter((log) => {
          const facility = typeof log?.data?.facility === 'string' ? log.data.facility : null;
          return !facility || facility === requesterFacility;
        });

    return json(res, 200, { logs: scoped.slice(0, 200) });
  }

  if (req.method === 'POST') {
    const body = parseJsonBody(req);
    if (!body || typeof body !== 'object') {
      return json(res, 400, { error: 'Invalid JSON payload' });
    }

    const validationError = validateBodyFields(body, [
      { name: 'action', required: true, type: 'string', minLength: 2, maxLength: 120 },
    ]);
    if (validationError) {
      return json(res, 400, { error: validationError });
    }

    const action = String(body.action).slice(0, 120);

    const entry = appendAuditLog(store, action, {
      ...(typeof body.data === 'object' && body.data ? body.data : {}),
      actorEmail: String(auth.claims.email || ''),
      actorRole: String(auth.claims.role || ''),
      facility: requesterFacility,
      organization: String(auth.claims.organization || 'Enterprise Health System'),
    });
    await saveStore(store);
    return json(res, 201, { log: entry });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
