import { appendAuditLog, getStore, json, saveStore } from '../_store.js';
import { requireAuth } from '../_auth.js';
import { authorizeEndpoint } from '../_policy.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';

function keyFacilityMatches(key, facility) {
  if (!key || !facility || facility === 'all') {
    return true;
  }
  const parts = String(key).split(':');
  const keyFacility = parts[1] || '';
  return keyFacility === facility;
}

export default async function handler(req, res) {
  if (!enforceRateLimit(req, res, {
    scope: 'training-progress',
    maxRequests: 180,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (!authorizeEndpoint(res, 'TRAINING_PROGRESS', req.method, auth.claims)) {
    return;
  }

  const store = await getStore();
  const requesterFacility = String(auth.claims.facility || 'all');

  if (req.method === 'GET') {
    const key = String(req.query?.key ?? '');
    if (!key) {
      return json(res, 400, { error: 'key query parameter is required' });
    }

    if (!keyFacilityMatches(key, requesterFacility)) {
      return json(res, 403, { error: 'Progress key outside facility scope' });
    }

    return json(res, 200, { progress: store.progress[key] ?? null });
  }

  if (req.method === 'PUT') {
    const body = parseJsonBody(req);
    if (!body || typeof body !== 'object') {
      return json(res, 400, { error: 'Invalid JSON payload' });
    }

    const validationError = validateBodyFields(body, [
      { name: 'key', required: true, type: 'string', minLength: 3, maxLength: 200 },
    ]);
    if (validationError) {
      return json(res, 400, { error: validationError });
    }

    const { key, progress } = body;
    if (!key || typeof key !== 'string' || !progress || typeof progress !== 'object') {
      return json(res, 400, { error: 'key and progress are required' });
    }

    if (!keyFacilityMatches(key, requesterFacility)) {
      return json(res, 403, { error: 'Progress key outside facility scope' });
    }

    store.progress[key] = {
      ...progress,
      facility: requesterFacility,
      organization: String(auth.claims.organization || 'Enterprise Health System'),
      updatedAt: new Date().toISOString(),
    };

    appendAuditLog(store, 'scenario_progress_saved', { key });
    await saveStore(store);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'DELETE') {
    const key = String(req.query?.key ?? '');
    if (!key) {
      return json(res, 400, { error: 'key query parameter is required' });
    }

    if (!keyFacilityMatches(key, requesterFacility)) {
      return json(res, 403, { error: 'Progress key outside facility scope' });
    }

    delete store.progress[key];
    appendAuditLog(store, 'scenario_progress_cleared', { key });
    await saveStore(store);
    return json(res, 204, {});
  }

  return json(res, 405, { error: 'Method not allowed' });
}
