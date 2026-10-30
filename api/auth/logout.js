import { clearRefreshCookie, readRefreshCookie, revokeRefreshSession } from '../_sessions.js';
import { enforceRateLimit } from '../_security.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!await enforceRateLimit(req, res, {
    scope: 'auth-logout',
    maxRequests: 50,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const refreshToken = readRefreshCookie(req);
  clearRefreshCookie(res);

  if (refreshToken) {
    try {
      await revokeRefreshSession(refreshToken, 'logout');
    } catch (error) {
      console.error('logout revocation failed', error);
    }
  }

  return json(res, 200, { ok: true });
}
