import { readStore } from '../_store.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';
import { completeLogin } from '../_sessions.js';
import { burnPasswordCheck, normalizeEmail, resolveAccount, verifyPassword } from '../_users.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

const INVALID_CREDENTIALS = { error: 'Invalid email or password.' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!await enforceRateLimit(req, res, {
    scope: 'auth-local-login',
    maxRequests: 15,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  if (process.env.ALLOW_LOCAL_AUTH_FALLBACK !== 'true') {
    return json(res, 403, { error: 'Password sign-in is disabled. Use your organization\'s single sign-on.' });
  }

  const body = parseJsonBody(req);
  if (!body || typeof body !== 'object') {
    return json(res, 400, { error: 'Invalid JSON payload' });
  }

  const validationError = validateBodyFields(body, [
    { name: 'email', required: true, type: 'string', minLength: 5, maxLength: 256 },
    { name: 'password', required: true, type: 'string', minLength: 8, maxLength: 256 },
    { name: 'remember', required: false, type: 'boolean' },
  ]);
  if (validationError) {
    return json(res, 400, { error: validationError });
  }

  const email = normalizeEmail(body.email);
  const password = String(body.password);

  // Per-account limit stops password spraying from many IPs against one user.
  if (!await enforceRateLimit(req, res, {
    scope: 'auth-local-login-account',
    maxRequests: 10,
    windowMs: 15 * 60 * 1000,
    identity: email,
  })) {
    return;
  }

  try {
    const store = await readStore();
    const account = resolveAccount(store, email);
    const passwordHash = account?.user?.passwordHash;

    const valid = passwordHash ? verifyPassword(password, passwordHash) : burnPasswordCheck(password);
    if (!valid || !account) {
      return json(res, 401, INVALID_CREDENTIALS);
    }

    const session = await completeLogin(req, res, account, {
      authMethod: 'password',
      persistent: body.remember !== false,
    });
    return json(res, 200, session);
  } catch (error) {
    console.error('local-login failed', error);
    return json(res, 500, { error: 'Unable to sign in right now. Please try again.' });
  }
}
