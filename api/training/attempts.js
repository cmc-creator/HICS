import { addAuditLog, createId, getStore, json } from '../_store.js';

export default async function handler(req, res) {
  const store = getStore();

  if (req.method === 'GET') {
    return json(res, 200, { attempts: store.attempts.slice(0, 500) });
  }

  if (req.method === 'POST') {
    const body = req.body ?? {};
    if (!body.scenarioId || !body.scenarioTitle) {
      return json(res, 400, { error: 'scenarioId and scenarioTitle are required' });
    }

    const entry = {
      id: createId('attempt'),
      scenarioId: String(body.scenarioId),
      scenarioTitle: String(body.scenarioTitle),
      facility: String(body.facility ?? 'all'),
      correctAnswers: Number(body.correctAnswers ?? 0),
      totalSteps: Number(body.totalSteps ?? 0),
      scorePercent: Number(body.scorePercent ?? 0),
      timedMode: Boolean(body.timedMode),
      facilitatorMode: Boolean(body.facilitatorMode),
      durationSeconds: Number(body.durationSeconds ?? 0),
      completedAt: new Date().toISOString(),
      learnerEmail: typeof body.learnerEmail === 'string' ? body.learnerEmail : undefined,
      learnerName: typeof body.learnerName === 'string' ? body.learnerName : undefined,
    };

    store.attempts.unshift(entry);
    store.attempts = store.attempts.slice(0, 5000);
    addAuditLog('training_attempt_recorded', {
      scenarioId: entry.scenarioId,
      facility: entry.facility,
      scorePercent: entry.scorePercent,
    });

    return json(res, 201, { attempt: entry });
  }

  if (req.method === 'DELETE') {
    store.attempts = [];
    addAuditLog('training_attempts_cleared');
    return json(res, 204, {});
  }

  return json(res, 405, { error: 'Method not allowed' });
}
