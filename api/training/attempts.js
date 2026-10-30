import { appendAuditLog, createId, json, readStore, updateStore } from '../_store.js';
import { canManageData, isEnterpriseAdmin, requireAuth, scopeByFacility } from '../_auth.js';
import { authorizeEndpoint } from '../_policy.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';

export default async function handler(req, res) {
  if (!await enforceRateLimit(req, res, {
    scope: 'training-attempts',
    maxRequests: 150,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (!authorizeEndpoint(res, 'TRAINING_ATTEMPTS', req.method, auth.claims)) {
    return;
  }

  const requesterFacility = String(auth.claims.facility || 'all');

  if (req.method === 'GET') {
    const store = await readStore();
    const scopedAttempts = scopeByFacility(store.attempts, auth.claims).slice(0, 500);
    return json(res, 200, { attempts: scopedAttempts });
  }

  if (req.method === 'POST') {
    const body = parseJsonBody(req);
    if (!body || typeof body !== 'object') {
      return json(res, 400, { error: 'Invalid JSON payload' });
    }

    const validationError = validateBodyFields(body, [
      { name: 'scenarioId', required: true, type: 'string', minLength: 2, maxLength: 120 },
      { name: 'scenarioTitle', required: true, type: 'string', minLength: 2, maxLength: 200 },
      { name: 'facility', required: false, type: 'string', maxLength: 80 },
      { name: 'learnerEmail', required: false, type: 'string', maxLength: 256 },
      { name: 'learnerName', required: false, type: 'string', maxLength: 120 },
    ]);
    if (validationError) {
      return json(res, 400, { error: validationError });
    }

    const defaultFacility = requesterFacility === 'all'
      ? (process.env.DEFAULT_USER_FACILITY || 'general-acute-care')
      : requesterFacility;

    const entry = {
      id: createId('attempt'),
      scenarioId: String(body.scenarioId),
      scenarioTitle: String(body.scenarioTitle),
      facility: String(body.facility || defaultFacility),
      correctAnswers: Math.max(0, Math.min(1000, Number(body.correctAnswers ?? 0))),
      totalSteps: Math.max(0, Math.min(1000, Number(body.totalSteps ?? 0))),
      scorePercent: Math.max(0, Math.min(100, Number(body.scorePercent ?? 0))),
      timedMode: Boolean(body.timedMode),
      facilitatorMode: Boolean(body.facilitatorMode),
      durationSeconds: Math.max(0, Math.min(86400, Number(body.durationSeconds ?? 0))),
      completedAt: new Date().toISOString(),
      learnerEmail: typeof body.learnerEmail === 'string' ? body.learnerEmail : undefined,
      learnerName: typeof body.learnerName === 'string' ? body.learnerName : undefined,
      teamName: typeof body.teamName === 'string' ? body.teamName.slice(0, 120) : undefined,
      assignedRole: typeof body.assignedRole === 'string' ? body.assignedRole.slice(0, 80) : undefined,
      multiplierApplied: typeof body.multiplierApplied === 'number' ? body.multiplierApplied : undefined,
      branchOutcome: typeof body.branchOutcome === 'string' ? body.branchOutcome.slice(0, 120) : undefined,
      earnedBadges: Array.isArray(body.earnedBadges)
        ? body.earnedBadges.filter((badge) => typeof badge === 'string').slice(0, 10)
        : [],
      organization: String(auth.claims.organization || 'Enterprise Health System'),
    };

    if (!isEnterpriseAdmin(auth.claims) && requesterFacility !== 'all' && entry.facility !== requesterFacility) {
      return json(res, 403, { error: 'Attempt facility outside requester scope' });
    }

    if (!canManageData(auth.claims)) {
      entry.learnerEmail = String(auth.claims.email || entry.learnerEmail || '');
      entry.learnerName = String(auth.claims.fullName || entry.learnerName || '');
    }

    await updateStore((store) => {
      store.attempts.unshift(entry);
      store.attempts = store.attempts.slice(0, 5000);
      appendAuditLog(store, 'training_attempt_recorded', {
        scenarioId: entry.scenarioId,
        facility: entry.facility,
        scorePercent: entry.scorePercent,
      });
    });

    return json(res, 201, { attempt: entry });
  }

  if (req.method === 'DELETE') {
    if (!canManageData(auth.claims)) {
      return json(res, 403, { error: 'Forbidden' });
    }

    await updateStore((store) => {
      if (isEnterpriseAdmin(auth.claims) || requesterFacility === 'all') {
        store.attempts = [];
      } else {
        store.attempts = store.attempts.filter((attempt) => String(attempt.facility || '') !== requesterFacility);
      }
      appendAuditLog(store, 'training_attempts_cleared', { facility: requesterFacility });
    });
    return json(res, 204, {});
  }

  return json(res, 405, { error: 'Method not allowed' });
}
