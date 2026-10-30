import { appendAuditLog, createId, json, readStore, updateStore } from '../_store.js';
import { canManageData, isEnterpriseAdmin, requireAuth, scopeByFacility } from '../_auth.js';
import { authorizeEndpoint } from '../_policy.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';

function computeLeaderboard(scores) {
  const grouped = new Map();

  for (const entry of scores) {
    const key = String(entry.learnerEmail || entry.learnerName || entry.id);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        learnerName: entry.learnerName,
        learnerEmail: entry.learnerEmail,
        facility: entry.facility,
        bestScore: entry.score,
        bestStreak: entry.peakStreak,
        totalRounds: 1,
        bestDurationSeconds: entry.durationSeconds,
        updatedAt: entry.completedAt,
      });
      continue;
    }

    existing.totalRounds += 1;
    if (entry.score > existing.bestScore) {
      existing.bestScore = entry.score;
      existing.bestStreak = entry.peakStreak;
      existing.bestDurationSeconds = entry.durationSeconds;
      existing.updatedAt = entry.completedAt;
    } else if (entry.score === existing.bestScore && entry.durationSeconds < existing.bestDurationSeconds) {
      existing.bestStreak = Math.max(existing.bestStreak, entry.peakStreak);
      existing.bestDurationSeconds = entry.durationSeconds;
      existing.updatedAt = entry.completedAt;
    } else {
      existing.bestStreak = Math.max(existing.bestStreak, entry.peakStreak);
    }
  }

  return [...grouped.values()]
    .sort((a, b) => b.bestScore - a.bestScore || a.bestDurationSeconds - b.bestDurationSeconds || b.totalRounds - a.totalRounds)
    .slice(0, 10);
}

export default async function handler(req, res) {
  if (!await enforceRateLimit(req, res, {
    scope: 'rapid-challenge',
    maxRequests: 160,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const auth = requireAuth(req, res);
  if (!auth) {
    return;
  }

  if (!authorizeEndpoint(res, 'RAPID_CHALLENGE', req.method, auth.claims)) {
    return;
  }

  const requesterFacility = String(auth.claims.facility || 'all');

  if (req.method === 'GET') {
    const store = await readStore();
    const scoped = scopeByFacility(store.rapidChallengeScores, auth.claims, 'facility');
    return json(res, 200, {
      leaderboard: computeLeaderboard(scoped),
      totalEntries: scoped.length,
    });
  }

  if (req.method === 'POST') {
    const body = parseJsonBody(req);
    if (!body || typeof body !== 'object') {
      return json(res, 400, { error: 'Invalid JSON payload' });
    }

    const validationError = validateBodyFields(body, [
      { name: 'score', required: true, type: 'number' },
      { name: 'peakStreak', required: true, type: 'number' },
      { name: 'durationSeconds', required: true, type: 'number' },
      { name: 'totalQuestions', required: true, type: 'number' },
      { name: 'answered', required: true, type: 'number' },
      { name: 'learnerName', required: false, type: 'string', maxLength: 120 },
      { name: 'learnerEmail', required: false, type: 'string', maxLength: 256 },
      { name: 'facility', required: false, type: 'string', maxLength: 80 },
    ]);
    if (validationError) {
      return json(res, 400, { error: validationError });
    }

    const facility = isEnterpriseAdmin(auth.claims) && typeof body.facility === 'string' && body.facility
      ? body.facility
      : requesterFacility;

    const entry = {
      id: createId('rapid'),
      score: Math.max(0, Math.min(100000, Math.round(Number(body.score)))),
      peakStreak: Math.max(0, Math.min(1000, Math.round(Number(body.peakStreak)))),
      durationSeconds: Math.max(1, Math.min(3600, Math.round(Number(body.durationSeconds)))),
      totalQuestions: Math.max(1, Math.min(1000, Math.round(Number(body.totalQuestions)))),
      answered: Math.max(0, Math.min(1000, Math.round(Number(body.answered)))),
      learnerName: String(body.learnerName || auth.claims.fullName || 'Anonymous Learner').slice(0, 120),
      learnerEmail: String(body.learnerEmail || auth.claims.email || '').slice(0, 256),
      facility,
      organization: String(auth.claims.organization || 'Enterprise Health System'),
      completedAt: new Date().toISOString(),
    };

    const leaderboard = await updateStore((store) => {
      store.rapidChallengeScores.unshift(entry);
      store.rapidChallengeScores = store.rapidChallengeScores.slice(0, 5000);
      appendAuditLog(store, 'rapid_challenge_score_recorded', {
        facility: entry.facility,
        score: entry.score,
        learnerEmail: entry.learnerEmail,
      });
      return computeLeaderboard(scopeByFacility(store.rapidChallengeScores, auth.claims, 'facility'));
    });

    return json(res, 201, {
      score: entry,
      leaderboard,
    });
  }

  if (req.method === 'DELETE') {
    if (!canManageData(auth.claims)) {
      return json(res, 403, { error: 'Forbidden' });
    }

    await updateStore((store) => {
      if (isEnterpriseAdmin(auth.claims) || requesterFacility === 'all') {
        store.rapidChallengeScores = [];
      } else {
        store.rapidChallengeScores = store.rapidChallengeScores.filter((entry) => String(entry.facility || '') !== requesterFacility);
      }
      appendAuditLog(store, 'rapid_challenge_scores_cleared', { facility: requesterFacility });
    });
    return json(res, 204, {});
  }

  return json(res, 405, { error: 'Method not allowed' });
}
