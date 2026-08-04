import crypto from 'node:crypto';
import { issueSignedAccessToken } from '../_auth.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';
import { issueRefreshSession } from '../_sessions.js';

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

async function verifyIdTokenSignature(idToken, jwksUrl) {
  const decoded = parseJwt(idToken);
  if (!decoded) {
    throw new Error('Invalid id_token format');
  }

  if (decoded.header.alg !== 'RS256' || typeof decoded.header.kid !== 'string') {
    throw new Error('Unsupported id_token signature algorithm');
  }

  const keys = await fetchJwks(jwksUrl);
  const matching = keys.find((key) => key.kid === decoded.header.kid && key.kty === 'RSA');
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

  return {
    tokenUrl: process.env.OIDC_OKTA_TOKEN_URL,
    clientId: process.env.OIDC_OKTA_CLIENT_ID,
    clientSecret: process.env.OIDC_OKTA_CLIENT_SECRET,
    jwksUrl: process.env.OIDC_OKTA_JWKS_URL,
    issuer: process.env.OIDC_OKTA_ISSUER,
  };
}

async function exchangeCodeForIdToken({ provider, code, codeVerifier, redirectUri }) {
  const config = getProviderExchangeConfig(provider);
  if (!config.tokenUrl || !config.clientId || !config.jwksUrl || !config.issuer) {
    return null;
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

function inferRole(email, provider) {
  const normalized = String(email || '').toLowerCase();
  if (normalized.startsWith('it.') || normalized.includes('admin')) {
    return 'enterprise-admin';
  }
  if (provider === 'okta') {
    return 'facility-admin';
  }
  return 'training-manager';
}

function inferFacility(role) {
  if (role === 'enterprise-admin') {
    return 'all';
  }
  return process.env.DEFAULT_USER_FACILITY || 'general-acute-care';
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

  if (!['entra', 'okta'].includes(provider)) {
    return json(res, 400, { error: 'Provider must be entra or okta' });
  }

  const allowedRedirect = process.env.ALLOWED_OIDC_REDIRECT_URI;
  if (allowedRedirect && redirectUri !== allowedRedirect) {
    return json(res, 400, { error: 'Invalid redirectUri' });
  }

  let email = provider === 'okta' ? 'admin@healthsystem.com' : 'it.admin@healthsystem.com';
  let fullName = provider === 'okta' ? 'Okta Administrator' : 'Entra Administrator';

  try {
    const idTokenIdentity = await exchangeCodeForIdToken({ provider, code, codeVerifier, redirectUri });
    if (idTokenIdentity?.email) {
      email = String(idTokenIdentity.email).toLowerCase();
      fullName = String(idTokenIdentity.fullName || fullName);
    }
  } catch (error) {
    if (process.env.ALLOW_OIDC_MOCK_FALLBACK !== 'true') {
      return json(res, 401, {
        error: error instanceof Error ? error.message : 'OIDC token verification failed',
      });
    }
  }

  if (!isValidEmail(email)) {
    return json(res, 500, { error: 'Unable to determine user identity' });
  }

  const role = inferRole(email, provider);
  const facility = inferFacility(role);
  const organization = process.env.DEFAULT_ORGANIZATION_NAME || 'Enterprise Health System';

  let accessToken = '';
  try {
    accessToken = issueSignedAccessToken({
      email,
      fullName,
      organization,
      role,
      facility,
      authMethod: provider === 'okta' ? 'okta-oidc' : 'entra-oidc',
    });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : 'Unable to issue access token',
    });
  }

  let refreshToken = '';
  try {
    const refreshSession = await issueRefreshSession({
      email,
      fullName,
      organization,
      role,
      facility,
      authMethod: provider === 'okta' ? 'okta-oidc' : 'entra-oidc',
    }, {
      ip: req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
      userAgent: req.headers?.['user-agent'] || 'unknown',
    });
    refreshToken = refreshSession.refreshToken;
  } catch (err) {
    // Refresh session store unavailable — return access-token-only response; client will re-auth at expiry.
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
