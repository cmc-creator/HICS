import { appendAuditLog, createId, getStore, json, saveStore } from '../_store.js';
import { canManageData, isEnterpriseAdmin, requireAuth, scopeByFacility } from '../_auth.js';
import { authorizeEndpoint } from '../_policy.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';

export default async function handler(req, res) {
  if (!enforceRateLimit(req, res, {
    scope: 'training-events',
    maxRequests: 150,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (!authorizeEndpoint(res, 'TRAINING_EVENTS', req.method, auth.claims)) {
    return;
  }

  const store = await getStore();
  const requesterFacility = String(auth.claims.facility || 'all');

  if (req.method === 'GET') {
    if (!canManageData(auth.claims)) {
      return json(res, 403, { error: 'Forbidden' });
    }

    const scopedEvents = scopeByFacility(
      store.events,
      auth.claims,
      'facility',
    );

    const counts = {};
    for (const event of scopedEvents) {
      counts[event.event] = (counts[event.event] ?? 0) + 1;
    }

    const eventCounts = Object.entries(counts)
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count);

    return json(res, 200, { eventCounts });
  }

  if (req.method === 'POST') {
    const body = parseJsonBody(req);
    if (!body || typeof body !== 'object') {
      return json(res, 400, { error: 'Invalid JSON payload' });
    }

    const validationError = validateBodyFields(body, [
      { name: 'event', required: true, type: 'string', minLength: 2, maxLength: 120 },
      { name: 'facility', required: false, type: 'string', maxLength: 80 },
    ]);
    if (validationError) {
      return json(res, 400, { error: validationError });
    }

    const entry = {
      id: createId('event'),
      event: body.event,
      at: new Date().toISOString(),
      data: typeof body.data === 'object' && body.data ? body.data : {},
      facility: requesterFacility,
      organization: String(auth.claims.organization || 'Enterprise Health System'),
    };

    if (isEnterpriseAdmin(auth.claims) && typeof body.facility === 'string' && body.facility) {
      entry.facility = body.facility;
    }

    store.events.unshift(entry);
    store.events = store.events.slice(0, 5000);
    await saveStore(store);
    return json(res, 201, { event: entry });
  }

  if (req.method === 'DELETE') {
    if (!canManageData(auth.claims)) {
      return json(res, 403, { error: 'Forbidden' });
    }

    if (isEnterpriseAdmin(auth.claims) || requesterFacility === 'all') {
      store.events = [];
    } else {
      store.events = store.events.filter((event) => String(event.facility || '') !== requesterFacility);
    }
    appendAuditLog(store, 'training_events_cleared');
    await saveStore(store);
    return json(res, 204, {});
  }

  return json(res, 405, { error: 'Method not allowed' });
}
