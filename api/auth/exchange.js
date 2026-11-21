import crypto from 'node:crypto';
import { issueSignedAccessToken } from '../_auth.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';
import { issueRefreshSession } from '../_sessions.js';
import { appendAuditLog, createId, reloadStore, saveStore } from '../_store.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function isValidEmail(value) {
  return typeof value === 'string' && value.includes('@') && value.includes('.');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  return Buffer.from(padded, 'base64');
}

function parseJwt(token) {
  const [headerPart, payloadPart, signaturePart] = String(token || '').split('.');
  if (!headerPart || !payloadPart || !signaturePart) {
    return null;
  }

  try {
    const header = JSON.parse(base64UrlDecode(headerPart).toString('utf8'));
    const payload = JSON.parse(base64UrlDecode(payloadPart).toString('utf8'));
    return {
      header,
      payload,
      signingInput: `${headerPart}.${payloadPart}`,
      signature: signaturePart,
    };
  } catch {
    return null;
  }
}

async function fetchJwks(jwksUrl) {
  const response = await fetch(jwksUrl, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Failed to load JWKS (${response.status})`);
  }
  const payload = await response.json();
  return Array.isArray(payload?.keys) ? payload.keys : [];
}

// JWKS documents change only when a provider rotates its signing
// keys, so cache them per URL for 10 minutes instead of fetching
// on every exchange. An unknown kid bypasses the cache once, which
// picks up a rotation immediately without waiting out the TTL.
const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;
const jwksCache = new Map();

async function getJwksKeys(jwksUrl, { forceRefresh = false } = {}) {
  const cached = jwksCache.get(jwksUrl);
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cached.keys;
  }
  const keys = await fetchJwks(jwksUrl);
  jwksCache.set(jwksUrl, { keys, fetchedAt: Date.now() });
  return keys;
}

async function verifyIdTokenSignature(idToken, jwksUrl) {
  const decoded = parseJwt(idToken);
  if (!decoded) {
    throw new Error('Invalid id_token format');
  }

  if (decoded.header.alg !== 'RS256' || typeof decoded.header.kid !== 'string') {
    throw new Error('Unsupported id_token signature algorithm');
  }

  const findKey = (keys) => keys.find((key) => key.kid === decoded.header.kid && key.kty === 'RSA');
  let matching = findKey(await getJwksKeys(jwksUrl));
  if (!matching) {
    matching = findKey(await getJwksKeys(jwksUrl, { forceRefresh: true }));
  }
  if (!matching) {
    throw new Error('No matching JWKS key found for id_token');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(decoded.signingInput);
  verifier.end();

  const publicKey = crypto.createPublicKey({ key: matching, format: 'jwk' });
  const valid = verifier.verify(publicKey, base64UrlDecode(decoded.signature));
  if (!valid) {
    throw new Error('Invalid id_token signature');
  }

  return decoded.payload;
}

function getProviderExchangeConfig(provider) {
  if (provider === 'entra') {
    return {
      tokenUrl: process.env.OIDC_ENTRA_TOKEN_URL,
      clientId: process.env.OIDC_ENTRA_CLIENT_ID,
      clientSecret: process.env.OIDC_ENTRA_CLIENT_SECRET,
      jwksUrl: process.env.OIDC_ENTRA_JWKS_URL,
      issuer: process.env.OIDC_ENTRA_ISSUER,
    };
  }

  if (provider === 'google') {
    return {
      // Google's token, JWKS, and issuer endpoints are fixed public
      // values, so they default when the env overrides are unset.
      tokenUrl: process.env.OIDC_GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token',
      clientId: process.env.OIDC_GOOGLE_CLIENT_ID,
      clientSecret: process.env.OIDC_GOOGLE_CLIENT_SECRET,
      jwksUrl: process.env.OIDC_GOOGLE_JWKS_URL || 'https://www.googleapis.com/oauth2/v3/certs',
      issuer: process.env.OIDC_GOOGLE_ISSUER || 'https://accounts.google.com',
    };
  }

  return {
    tokenUrl: process.env.OIDC_OKTA_TOKEN_URL,
    clientId: process.env.OIDC_OKTA_CLIENT_ID,
    clientSecret: process.env.OIDC_OKTA_CLIENT_SECRET,
    jwksUrl: process.env.OIDC_OKTA_JWKS_URL,
    issuer: process.env.OIDC_OKTA_ISSUER,
  };
}

// The role a first-time SSO user gets when they are not an owner:
// 'observer', the lowest-privilege non-admin role in the canonical
// AppUserRole list (KNOWN_ROLES in api/admin/users.js, mirroring
// hics-app/src/types/index.ts, privilege-ordered high to low). An
// admin can promote the account later; a first sign-in must never
// grant more than this on its own.
const SSO_DEFAULT_ROLE = 'observer';

// Owner emails auto-provision as enterprise admins on first SSO
// sign-in: the people who run the deployment should never be
// locked out of their own app for lack of a pre-created record.
// Sources: the comma-separated HICS_OWNER_EMAILS env list, plus
// the bootstrap admin email, which is an owner by definition.
// Matching is case-insensitive on both sides.
function getOwnerEmails() {
  const owners = new Set();
  for (const entry of String(process.env.HICS_OWNER_EMAILS || '').split(',')) {
    const normalized = entry.trim().toLowerCase();
    if (normalized) {
      owners.add(normalized);
    }
  }
  const bootstrapEmail = String(process.env.HICS_BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  if (bootstrapEmail) {
    owners.add(bootstrapEmail);
  }
  return owners;
}

// Optional SSO sign-up allowlist for enterprise deployments:
// HICS_SSO_ALLOWED_DOMAINS is a comma-separated list of email
// domains (case-insensitive). When it is SET, a first-time SSO
// identity auto-provisions only if its email domain is listed;
// owners (above) are exempt, and existing store users are never
// gated - the list restricts NEW account creation, not sign-in.
// When it is UNSET (the public demo), first sign-ins keep the
// open self-serve posture. Returns null when unset or empty.
function getSsoAllowedDomains() {
  const raw = String(process.env.HICS_SSO_ALLOWED_DOMAINS || '').trim();
  if (!raw) {
    return null;
  }
  const domains = new Set();
  for (const entry of raw.split(',')) {
    const normalized = entry.trim().toLowerCase().replace(/^@/, '');
    if (normalized) {
      domains.add(normalized);
    }
  }
  return domains.size > 0 ? domains : null;
}

// Creates the store record for a first-time SSO sign-in and
// persists it before any token is issued. The record is SSO-only:
// it deliberately has no passwordHash, so credential login rejects
// it with the generic 401, exactly like any account that has not
// set a password - no credential is invented for it.
async function provisionSsoUser(store, { email, fullName, provider }) {
  const isOwner = getOwnerEmails().has(email);
  const user = {
    id: createId('usr'),
    fullName: fullName || email,
    email,
    role: isOwner ? 'enterprise-admin' : SSO_DEFAULT_ROLE,
    facility: isOwner ? 'all' : String(process.env.DEFAULT_USER_FACILITY || 'general-acute-care'),
    organization: String(process.env.DEFAULT_ORGANIZATION_NAME || 'Enterprise Health System'),
    status: 'active',
    createdAt: new Date().toISOString(),
    ssoProvider: provider,
  };
  store.users.push(user);
  appendAuditLog(store, isOwner ? 'sso_owner_auto_provisioned' : 'sso_user_auto_provisioned', {
    userId: user.id,
    email,
    role: user.role,
    facility: user.facility,
    provider,
  });
  await saveStore(store);
  return user;
}

function isProviderConfigured(provider) {
  const config = getProviderExchangeConfig(provider);
  return Boolean(config.tokenUrl && config.clientId && config.jwksUrl && config.issuer);
}

async function exchangeCodeForIdToken({ provider, code, codeVerifier, redirectUri }) {
  const config = getProviderExchangeConfig(provider);
  if (!config.tokenUrl || !config.clientId || !config.jwksUrl || !config.issuer) {
    // Defense in depth: the handler checks configuration first and
    // answers 503, so reaching this throw means a caller skipped
    // the check. An unconfigured provider must never produce an
    // identity - there is no mock or fallback identity anywhere in
    // this flow.
    throw new Error(`OIDC provider ${provider} is not configured`);
  }

  const params = new URLSearchParams();
  params.set('grant_type', 'authorization_code');
  params.set('code', code);
  params.set('redirect_uri', redirectUri);
  params.set('code_verifier', codeVerifier);
  params.set('client_id', config.clientId);
  if (config.clientSecret) {
    params.set('client_secret', config.clientSecret);
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OIDC token exchange failed (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  const idToken = payload?.id_token;
  if (typeof idToken !== 'string' || idToken.length < 10) {
    throw new Error('OIDC token response missing id_token');
  }

  const claims = await verifyIdTokenSignature(idToken, config.jwksUrl);
  if (claims.iss !== config.issuer) {
    throw new Error('OIDC issuer mismatch');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= nowSeconds) {
    throw new Error('OIDC id_token is expired');
  }

  if (claims.aud !== config.clientId && !(Array.isArray(claims.aud) && claims.aud.includes(config.clientId))) {
    throw new Error('OIDC audience mismatch');
  }

  return {
    email: claims.email,
    fullName: claims.name || claims.preferred_username || claims.email,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!enforceRateLimit(req, res, {
    scope: 'auth-exchange',
    maxRequests: 20,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const body = parseJsonBody(req);
  if (!body || typeof body !== 'object') {
    return json(res, 400, { error: 'Invalid JSON payload' });
  }

  const validationError = validateBodyFields(body, [
    { name: 'provider', required: true, type: 'string', maxLength: 20 },
    { name: 'code', required: true, type: 'string', minLength: 5, maxLength: 4096 },
    { name: 'codeVerifier', required: true, type: 'string', minLength: 32, maxLength: 256 },
    { name: 'redirectUri', required: true, type: 'string', minLength: 8, maxLength: 2048 },
  ]);
  if (validationError) {
    return json(res, 400, { error: validationError });
  }

  const { provider, code, codeVerifier, redirectUri } = body;

  if (!provider || !code || !codeVerifier || !redirectUri) {
    return json(res, 400, { error: 'Missing required fields: provider, code, codeVerifier, redirectUri' });
  }

  if (!['entra', 'okta', 'google'].includes(provider)) {
    return json(res, 400, { error: 'Provider must be entra, okta, or google' });
  }

  const allowedRedirect = process.env.ALLOWED_OIDC_REDIRECT_URI;
  if (allowedRedirect && redirectUri !== allowedRedirect) {
    return json(res, 400, { error: 'Invalid redirectUri' });
  }

  // An unconfigured provider (missing token URL, client id, JWKS
  // URL, or issuer after defaults) can never verify an identity.
  // Refuse the exchange outright: no session is issued, and there
  // is deliberately no mock/fallback identity to fall through to.
  if (!isProviderConfigured(provider)) {
    return json(res, 503, { error: 'This sign-in provider is not configured.' });
  }

  let identity = null;
  try {
    identity = await exchangeCodeForIdToken({ provider, code, codeVerifier, redirectUri });
  } catch (error) {
    console.error('[NyxHICSlab] OIDC exchange failed:', error instanceof Error ? error.message : error);
    return json(res, 401, {
      error: error instanceof Error ? error.message : 'OIDC token verification failed',
    });
  }

  const email = String(identity?.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    return json(res, 401, { error: 'Unable to determine user identity' });
  }

  // Role, facility, and organization always come from the store
  // record - never from the email string (audit B4: no substring
  // role inference). An existing record governs as-is, and an
  // inactive one is refused. A verified identity with no record
  // yet is a first sign-in, not an intruder: provision one on the
  // spot (owners as enterprise admins, everyone else with the
  // lowest-privilege role) so legitimate users are never walled
  // out. Reload first so a just-created user is visible even on a
  // warm instance with a stale cache.
  const store = await reloadStore();
  if (!Array.isArray(store.users)) {
    store.users = [];
  }
  let user = store.users.find((candidate) => String(candidate?.email || '').toLowerCase() === email);

  if (user && user.status !== 'active') {
    return json(res, 403, {
      error: 'This account is inactive. Contact your administrator to request access.',
    });
  }

  if (!user) {
    // Enterprise deployments can restrict NEW sign-ups to their
    // own email domains (HICS_SSO_ALLOWED_DOMAINS). The gate sits
    // only on the provisioning path: existing users (handled
    // above) and owner emails are never blocked by it. A rejected
    // first sign-in creates no record and issues no tokens, and
    // is audit-logged under its own action so an admin can see
    // who was turned away.
    const allowedDomains = getSsoAllowedDomains();
    if (allowedDomains && !getOwnerEmails().has(email)) {
      const domain = email.slice(email.lastIndexOf('@') + 1);
      if (!allowedDomains.has(domain)) {
        appendAuditLog(store, 'sso_sign_in_rejected_domain', { email, domain, provider });
        await saveStore(store);
        return json(res, 403, {
          error: 'This account is not provisioned. Contact your administrator to request access.',
        });
      }
    }
    user = await provisionSsoUser(store, { email, fullName: identity.fullName, provider });
  }

  const fullName = String(user.fullName || identity.fullName || email);
  const role = String(user.role || 'facility-admin');
  const facility = String(user.facility || process.env.DEFAULT_USER_FACILITY || 'general-acute-care');
  const organization = String(user.organization || process.env.DEFAULT_ORGANIZATION_NAME || 'Enterprise Health System');

  let accessToken = '';
  try {
    accessToken = issueSignedAccessToken({
      email,
      fullName,
      organization,
      role,
      facility,
      authMethod: `${provider}-oidc`,
    });
  } catch (error) {
    console.error('[NyxHICSlab] Failed to issue access token for SSO session:', error instanceof Error ? error.message : error);
    return json(res, 500, { error: 'Unable to issue access token' });
  }

  let refreshToken = '';
  try {
    const refreshSession = await issueRefreshSession({
      email,
      fullName,
      organization,
      role,
      facility,
      authMethod: `${provider}-oidc`,
    }, {
      ip: req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
      userAgent: req.headers?.['user-agent'] || 'unknown',
    });
    refreshToken = refreshSession.refreshToken;
  } catch (err) {
    // Refresh session store unavailable - return access-token-only response; client will re-auth at expiry.
    return json(res, 200, {
      accessToken,
      refreshToken: '',
      expiresIn: 3600,
      email,
      fullName,
      organization,
      role,
      facility,
      warning: 'Persistent session unavailable. You will need to log in again after your session expires.',
    });
  }

  return json(res, 200, {
    accessToken,
    refreshToken,
    expiresIn: 3600,
    email,
    fullName,
    organization,
    role,
    facility,
  });
}
