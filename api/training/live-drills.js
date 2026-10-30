import crypto from 'node:crypto';
import { appendAuditLog, createId, json, readStore, updateStore } from '../_store.js';
import { isEnterpriseAdmin, requireAuth, scopeByFacility } from '../_auth.js';
import { authorizeEndpoint } from '../_policy.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';

const MAX_PARTICIPANTS = 25;
const MAX_EVENTS = 80;

function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[crypto.randomInt(chars.length)]).join('');
}

function sanitizeParticipants(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      name: String(item.name || '').slice(0, 80),
      roleId: String(item.roleId || '').slice(0, 80),
    }))
    .filter((item) => item.name.length >= 1)
    .slice(0, MAX_PARTICIPANTS);
}

function sanitizeEvents(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => ({
      at: typeof item.at === 'string' ? item.at.slice(0, 40) : new Date().toISOString(),
      message: String(item.message || '').slice(0, 240),
    }))
    .filter((item) => item.message.length >= 1)
    .slice(0, MAX_EVENTS);
}

export default async function handler(req, res) {
  if (!await enforceRateLimit(req, res, {
    scope: 'live-drills',
    maxRequests: 220,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (!authorizeEndpoint(res, 'LIVE_DRILLS', req.method, auth.claims)) {
    return;
  }

  const requesterFacility = String(auth.claims.facility || 'all');

  if (req.method === 'GET') {
    const sessionCode = typeof req.query?.sessionCode === 'string' ? req.query.sessionCode.toUpperCase() : '';
    const store = await readStore();
    const scoped = scopeByFacility(store.liveDrills, auth.claims, 'facility');

    if (sessionCode) {
      const session = scoped.find((item) => String(item.sessionCode || '').toUpperCase() === sessionCode) ?? null;
      return json(res, 200, { session });
    }

    const sessions = [...scoped]
      .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())
      .slice(0, 25)
      .map((item) => ({
        id: item.id,
        sessionCode: item.sessionCode,
        phaseIndex: item.phaseIndex,
        running: item.running,
        elapsedSeconds: item.elapsedSeconds,
        participantsCount: Array.isArray(item.participants) ? item.participants.length : 0,
        updatedAt: item.updatedAt,
      }));

    return json(res, 200, { sessions });
  }

  if (req.method === 'PUT') {
    const body = parseJsonBody(req);
    if (!body || typeof body !== 'object') {
      return json(res, 400, { error: 'Invalid JSON payload' });
    }

    const validationError = validateBodyFields(body, [
      { name: 'sessionCode', required: false, type: 'string', minLength: 4, maxLength: 12 },
    ]);
    if (validationError) {
      return json(res, 400, { error: validationError });
    }

    const sessionCode = String(body.sessionCode || randomCode()).toUpperCase();
    const participants = sanitizeParticipants(body.participants);
    const events = sanitizeEvents(body.events);

    const result = await updateStore((store) => {
      const existing = store.liveDrills.find((item) => String(item.sessionCode || '').toUpperCase() === sessionCode);
      if (existing && !isEnterpriseAdmin(auth.claims) && requesterFacility !== 'all' && String(existing.facility || '') !== requesterFacility) {
        return { forbidden: true };
      }

      const nextFacility = existing
        ? String(existing.facility || requesterFacility)
        : (isEnterpriseAdmin(auth.claims) && typeof body.facility === 'string' && body.facility ? body.facility : requesterFacility);

      const session = {
        id: existing?.id || createId('drill'),
        sessionCode,
        phaseIndex: Math.max(0, Number(body.phaseIndex ?? existing?.phaseIndex ?? 0) || 0),
        running: Boolean(body.running ?? existing?.running ?? false),
        elapsedSeconds: Math.max(0, Number(body.elapsedSeconds ?? existing?.elapsedSeconds ?? 0) || 0),
        participants,
        events,
        facility: nextFacility,
        organization: String(auth.claims.organization || existing?.organization || 'Enterprise Health System'),
        updatedBy: String(auth.claims.email || 'unknown@nyxhicslab.local'),
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (existing) {
        const index = store.liveDrills.findIndex((item) => item.id === existing.id);
        store.liveDrills[index] = session;
        appendAuditLog(store, 'live_drill_updated', { sessionCode, facility: session.facility });
      } else {
        store.liveDrills.unshift(session);
        store.liveDrills = store.liveDrills.slice(0, 500);
        appendAuditLog(store, 'live_drill_created', { sessionCode, facility: session.facility });
      }
      return { session };
    });

    if (result.forbidden) {
      return json(res, 403, { error: 'Live drill session outside facility scope' });
    }
    return json(res, 200, { session: result.session });
  }

  if (req.method === 'DELETE') {
    const sessionCode = typeof req.query?.sessionCode === 'string' ? req.query.sessionCode.toUpperCase() : '';
    if (!sessionCode) {
      return json(res, 400, { error: 'sessionCode query parameter is required' });
    }

    const deleted = await updateStore((store) => {
      const beforeCount = store.liveDrills.length;
      if (isEnterpriseAdmin(auth.claims) || requesterFacility === 'all') {
        store.liveDrills = store.liveDrills.filter((item) => String(item.sessionCode || '').toUpperCase() !== sessionCode);
      } else {
        store.liveDrills = store.liveDrills.filter((item) => !(String(item.sessionCode || '').toUpperCase() === sessionCode && String(item.facility || '') === requesterFacility));
      }

      if (store.liveDrills.length === beforeCount) {
        return false;
      }
      appendAuditLog(store, 'live_drill_deleted', { sessionCode, facility: requesterFacility });
      return true;
    });

    if (!deleted) {
      return json(res, 404, { error: 'Live drill session not found' });
    }
    return json(res, 204, {});
  }

  return json(res, 405, { error: 'Method not allowed' });
}
