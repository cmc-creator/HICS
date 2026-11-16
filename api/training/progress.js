import { appendAuditLog, getStore, json, saveStore } from '../_store.js';
import { isEnterpriseAdmin, requireAuth } from '../_auth.js';
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

// Authorization is by record ownership, not by the facility
// string embedded in the key (audit W6). The key's facility
// segment comes from whichever facility the player UI had
// selected, so keying access off it 403'd a user for resuming
// their own progress after selecting a different facility - and
// the client swallowed the 403 into local-only progress. Now:
// enterprise/'all' requesters pass; a record with an ownerEmail
// (stamped on every PUT) belongs to that user wherever the key
// points; legacy records without an owner keep the old
// key-facility rule until their next write stamps one. Another
// user's record is never readable or writable.
function canAccessProgress(claims, key, existing) {
  const requesterFacility = String(claims?.facility || 'all');
  if (isEnterpriseAdmin(claims) || requesterFacility === 'all') {
    return true;
  }
  if (existing && typeof existing.ownerEmail === 'string' && existing.ownerEmail) {
    return existing.ownerEmail.toLowerCase() === String(claims?.email || '').toLowerCase();
  }
  return keyFacilityMatches(key, requesterFacility);
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
  if (!store.progress || typeof store.progress !== 'object' || Array.isArray(store.progress)) {
    store.progress = {};
  }

  if (req.method === 'GET') {
    const key = String(req.query?.key ?? '');
    if (!key) {
      return json(res, 400, { error: 'key query parameter is required' });
    }

    const existing = store.progress[key];
    if (existing && !canAccessProgress(auth.claims, key, existing)) {
      return json(res, 403, { error: 'Progress record belongs to another user' });
    }

    return json(res, 200, { progress: existing ?? null });
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

    if (JSON.stringify(progress).length > 32768) {
      return json(res, 400, { error: 'Progress payload exceeds maximum size' });
    }

    const existing = store.progress[key];
    if (existing && !canAccessProgress(auth.claims, key, existing)) {
      return json(res, 403, { error: 'Progress record belongs to another user' });
    }

    store.progress[key] = {
      ...progress,
      // Ownership is stamped from the session, never from the
      // payload, and is what later reads/writes authorize against.
      ownerEmail: String(auth.claims.email || '').toLowerCase(),
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

    const existing = store.progress[key];
    if (existing && !canAccessProgress(auth.claims, key, existing)) {
      return json(res, 403, { error: 'Progress record belongs to another user' });
    }

    delete store.progress[key];
    appendAuditLog(store, 'scenario_progress_cleared', { key });
    await saveStore(store);
    return json(res, 204, {});
  }

  return json(res, 405, { error: 'Method not allowed' });
}
