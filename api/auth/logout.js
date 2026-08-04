import { revokeRefreshSession } from '../_sessions.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, {
    scope: 'auth-logout',
    maxRequests: 50,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const body = parseJsonBody(req);
  if (!body || typeof body !== 'object') {
    return json(res, 400, { error: 'Invalid JSON payload' });
  }

  const validationError = validateBodyFields(body, [
    { name: 'refreshToken', required: true, type: 'string', minLength: 20, maxLength: 512 },
  ]);
  if (validationError) {
    return json(res, 400, { error: validationError });
  }

  await revokeRefreshSession(String(body.refreshToken), 'logout');
  return json(res, 200, { ok: true });
}
