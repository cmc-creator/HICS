import { issueSignedAccessToken } from '../_auth.js';
import { verifyPassword } from '../_passwords.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';
import { issueRefreshSession } from '../_sessions.js';
import { getStore } from '../_store.js';

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

  if (!email.includes('@') || password.length < 8) {
    return json(res, 400, { error: 'Invalid credential format.' });
  }

  // Real credential check: the user must exist in the store, be
  // active, and have a passwordHash that verifies. Every failure
  // mode returns the same generic 401 so responses never reveal
  // whether an email is registered.
  const store = await getStore();
  const users = Array.isArray(store.users) ? store.users : [];
  const user = users.find((candidate) => String(candidate?.email || '').toLowerCase() === email);

  if (!user || user.status !== 'active' || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return json(res, 401, { error: 'Invalid email or password.' });
  }

  // Claims always come from the user record, never from the email
  // string or the request body.
  const claims = {
    email,
    fullName: String(user.fullName || ''),
    organization: String(user.organization || process.env.DEFAULT_ORGANIZATION_NAME || 'Enterprise Health System'),
    role: String(user.role || 'facility-admin'),
    facility: String(user.facility || process.env.DEFAULT_USER_FACILITY || 'general-acute-care'),
    authMethod: 'password',
  };

  let accessToken = '';
  let refreshToken = '';
  try {
    accessToken = issueSignedAccessToken(claims);

    const refreshSession = await issueRefreshSession(claims, {
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
    email: claims.email,
    fullName: claims.fullName,
    organization: claims.organization,
    role: claims.role,
    facility: claims.facility,
  });
}
