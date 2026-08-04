import { issueSignedAccessToken } from '../_auth.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';
import { issueRefreshSession } from '../_sessions.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function inferRole(email) {
  const normalized = String(email || '').toLowerCase();
  if (normalized.includes('it.admin') || normalized.includes('enterprise-admin')) {
    return 'enterprise-admin';
  }
  if (normalized.includes('training')) {
    return 'training-manager';
  }
  return 'facility-admin';
}

function inferFacility(role) {
  return role === 'enterprise-admin' ? 'all' : (process.env.DEFAULT_USER_FACILITY || 'psychiatric-inpatient');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, {
    scope: 'auth-local-login',
    maxRequests: 15,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  if (process.env.ALLOW_LOCAL_AUTH_FALLBACK !== 'true') {
    return json(res, 403, { error: 'Local credential login is disabled in this environment.' });
  }

  const body = parseJsonBody(req);
  if (!body || typeof body !== 'object') {
    return json(res, 400, { error: 'Invalid JSON payload' });
  }

  const validationError = validateBodyFields(body, [
    { name: 'email', required: true, type: 'string', minLength: 5, maxLength: 256 },
    { name: 'password', required: true, type: 'string', minLength: 8, maxLength: 256 },
    { name: 'organization', required: false, type: 'string', maxLength: 128 },
  ]);
  if (validationError) {
    return json(res, 400, { error: validationError });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const organization = String(body.organization || process.env.DEFAULT_ORGANIZATION_NAME || 'Enterprise Health System');

  if (!email.includes('@') || password.length < 8) {
    return json(res, 400, { error: 'Invalid credential format.' });
  }

  const role = inferRole(email);
  const facility = inferFacility(role);

  let accessToken = '';
  let refreshToken = '';
  try {
    accessToken = issueSignedAccessToken({
      email,
      fullName: email.split('@')[0].replace('.', ' '),
      organization,
      role,
      facility,
      authMethod: 'password',
    });

    const refreshSession = await issueRefreshSession({
      email,
      fullName: email.split('@')[0].replace('.', ' '),
      organization,
      role,
      facility,
      authMethod: 'password',
    }, {
      ip: req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
      userAgent: req.headers?.['user-agent'] || 'unknown',
    });
    refreshToken = refreshSession.refreshToken;
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : 'Unable to issue access token',
    });
  }

  return json(res, 200, {
    accessToken,
    refreshToken,
    expiresIn: 3600,
    email,
    fullName: email.split('@')[0].replace('.', ' '),
    organization,
    role,
    facility,
  });
}
