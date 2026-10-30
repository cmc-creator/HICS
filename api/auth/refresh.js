import { issueSignedAccessToken } from '../_auth.js';
import {
  buildSessionResponse,
  clearRefreshCookie,
  getRequestMetadata,
  readRefreshCookie,
  rotateRefreshSession,
  setRefreshCookie,
} from '../_sessions.js';
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
    scope: 'auth-refresh',
    maxRequests: 30,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const refreshToken = readRefreshCookie(req);
  if (!refreshToken) {
    return json(res, 401, { error: 'No active session' });
  }

  let rotated;
  try {
    rotated = await rotateRefreshSession(refreshToken, getRequestMetadata(req));
  } catch (error) {
    console.error('refresh rotation failed', error);
    return json(res, 503, { error: 'Session service unavailable. Please try again.' });
  }

  if (rotated?.error === 'stale-token') {
    // Another tab just rotated this cookie; the browser already holds the new one.
    return json(res, 409, { error: 'Session was refreshed elsewhere. Retry.', code: 'refresh_stale' });
  }

  if (rotated?.error === 'replay-detected') {
    clearRefreshCookie(res);
    return json(res, 401, {
      error: 'Refresh token replay detected. Session family has been revoked.',
      code: 'refresh_replay_detected',
    });
  }

  if (rotated?.error === 'account-inactive') {
    clearRefreshCookie(res);
    return json(res, 401, { error: 'Your account is no longer active.', code: 'account_inactive' });
  }

  if (!rotated) {
    clearRefreshCookie(res);
    return json(res, 401, { error: 'Invalid or expired session' });
  }

  const { session } = rotated;
  const claims = {
    email: session.email,
    fullName: session.fullName,
    organization: session.organization,
    role: session.role,
    facility: session.facility,
    authMethod: session.authMethod,
  };

  setRefreshCookie(res, rotated.refreshToken, { persistent: session.persistent });
  return json(res, 200, {
    ...buildSessionResponse(issueSignedAccessToken(claims), claims),
    authMethod: session.authMethod,
  });
}
