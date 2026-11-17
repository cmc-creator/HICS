import { issueSignedAccessToken } from '../_auth.js';
import { issueMfaChallengeToken } from '../_mfa.js';
import { verifyPassword } from '../_passwords.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';
import { issueRefreshSession } from '../_sessions.js';
import { reloadStore } from '../_store.js';

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

  // Credential login stands on its own: a user with a stored
  // password credential can sign in, period. It used to be gated
  // on ALLOW_LOCAL_AUTH_FALLBACK - the same flag that armed the
  // forgeable "pwd-" bearer-token fallback in _auth.js - so the
  // two could not be separated (audit B3). The flag is gone.
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
  // whether an email is registered. The store is reloaded first:
  // a warm instance's cache can still hold the pre-reset password
  // hash after another instance handled a password reset.
  const store = await reloadStore();
  const users = Array.isArray(store.users) ? store.users : [];
  const user = users.find((candidate) => String(candidate?.email || '').toLowerCase() === email);

  if (!user || user.status !== 'active' || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return json(res, 401, { error: 'Invalid email or password.' });
  }

  // Opt-in MFA: when the user has enabled a second factor, the
  // password alone does not earn a session. Return a short-lived
  // challenge token instead; /api/auth/mfa/verify exchanges it
  // plus a TOTP/recovery code for the real session. Users without
  // MFA (including the bootstrap admin and every SSO account) are
  // completely unaffected by this branch.
  if (user.mfa?.enabled) {
    try {
      return json(res, 200, {
        mfaRequired: true,
        challengeToken: issueMfaChallengeToken(email),
        challengeExpiresIn: 300,
      });
    } catch (error) {
      console.error('[NyxHICSlab] Failed to issue MFA challenge:', error instanceof Error ? error.message : error);
      return json(res, 500, { error: 'Unable to start MFA verification' });
    }
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
    console.error('[NyxHICSlab] Failed to issue tokens for credential login:', error instanceof Error ? error.message : error);
    return json(res, 500, { error: 'Unable to issue access token' });
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
