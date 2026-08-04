import { issueSignedAccessToken } from '../_auth.js';
import { rotateRefreshSession } from '../_sessions.js';
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
    scope: 'auth-refresh',
    maxRequests: 30,
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

  const { refreshToken } = body;
  const rotated = await rotateRefreshSession(refreshToken, {
    ip: req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
    userAgent: req.headers?.['user-agent'] || 'unknown',
  });

  if (rotated?.error === 'replay-detected') {
    return json(res, 401, {
      error: 'Refresh token replay detected. Session family has been revoked.',
      code: 'refresh_replay_detected',
    });
  }

  if (!rotated) {
    return json(res, 401, { error: 'Invalid or expired refresh token' });
  }

  const accessToken = issueSignedAccessToken({
    email: rotated.session.email,
    fullName: rotated.session.fullName,
    organization: rotated.session.organization,
    role: rotated.session.role,
    facility: rotated.session.facility,
    authMethod: rotated.session.authMethod,
  });

  return json(res, 200, {
    accessToken,
    refreshToken: rotated.refreshToken,
    expiresIn: 3600,
    email: rotated.session.email,
    fullName: rotated.session.fullName,
    organization: rotated.session.organization,
    role: rotated.session.role,
    facility: rotated.session.facility,
  });
}
