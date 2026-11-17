import { issueSignedAccessToken } from '../../_auth.js';
import { parseMfaChallengeToken, verifyUserMfaCode } from '../../_mfa.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../../_security.js';
import { issueRefreshSession } from '../../_sessions.js';
import { appendAuditLog, json, reloadStore, saveStore } from '../../_store.js';

// Second step of password sign-in for MFA-enabled users:
// local-login returned { mfaRequired: true, challengeToken }
// instead of a session; this endpoint exchanges the challenge
// plus a TOTP or recovery code for the real session. The response
// shape is identical to local-login's success response.
//
// Recovery codes are single-use: a matched code's hash is removed
// before the session is issued.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, {
    scope: 'auth-mfa-verify',
    maxRequests: 10,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const body = parseJsonBody(req);
  if (!body || typeof body !== 'object') {
    return json(res, 400, { error: 'Invalid JSON payload' });
  }
  const validationError = validateBodyFields(body, [
    { name: 'challengeToken', required: true, type: 'string', minLength: 10, maxLength: 1024 },
    { name: 'code', required: true, type: 'string', minLength: 6, maxLength: 20 },
  ]);
  if (validationError) {
    return json(res, 400, { error: validationError });
  }

  const email = parseMfaChallengeToken(body.challengeToken);
  if (!email) {
    return json(res, 401, { error: 'The sign-in challenge is invalid or has expired. Sign in again.' });
  }

  const store = await reloadStore();
  const users = Array.isArray(store.users) ? store.users : [];
  const user = users.find((candidate) => String(candidate?.email || '').toLowerCase() === email);

  if (!user || user.status !== 'active' || !user.mfa?.enabled) {
    return json(res, 401, { error: 'Invalid code.' });
  }

  const method = verifyUserMfaCode(user, body.code);
  if (!method) {
    appendAuditLog(store, 'mfa_verify_failed', { email: user.email });
    await saveStore(store);
    return json(res, 401, { error: 'Invalid code.' });
  }

  appendAuditLog(store, 'mfa_verified', { email: user.email, method });
  await saveStore(store);

  // Claims come from the user record, exactly as in local-login.
  const claims = {
    email: user.email,
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
    console.error('[NyxHICSlab] Failed to issue tokens after MFA verification:', error instanceof Error ? error.message : error);
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
