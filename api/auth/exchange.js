import crypto from 'node:crypto';
import { readStore } from '../_store.js';
import { enforceRateLimit, parseJsonBody, validateBodyFields } from '../_security.js';
import { completeLogin } from '../_sessions.js';
import { isValidEmail, normalizeEmail, resolveAccount } from '../_users.js';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

class SsoError extends Error {
  constructor(status, publicMessage, detail) {
    super(detail || publicMessage);
    this.status = status;
    this.publicMessage = publicMessage;
  }
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

async function exchangeCodeForIdentity({ provider, code, codeVerifier, redirectUri }) {
  const config = getProviderExchangeConfig(provider);
  if (!config.tokenUrl || !config.clientId || !config.jwksUrl || !config.issuer) {
    throw new SsoError(503, 'Single sign-on is not configured for this provider.', `Missing OIDC config for ${provider}`);
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

  // Entra often omits `email`; preferred_username/upn carry the sign-in address instead.
  const email = normalizeEmail(claims.email || claims.preferred_username || claims.upn);
  if (!isValidEmail(email)) {
    throw new Error('OIDC id_token has no usable email claim');
  }

  return {
    email,
    fullName: claims.name || email,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  if (!await enforceRateLimit(req, res, {
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
    { name: 'codeVerifier', required: true, type: 'string', minLength: 43, maxLength: 128 },
    { name: 'redirectUri', required: true, type: 'string', minLength: 8, maxLength: 2048 },
    { name: 'remember', required: false, type: 'boolean' },
  ]);
  if (validationError) {
    return json(res, 400, { error: validationError });
  }

  const { provider, code, codeVerifier, redirectUri } = body;

  if (!['entra', 'okta'].includes(provider)) {
    return json(res, 400, { error: 'Provider must be entra or okta' });
  }

  const allowedRedirect = process.env.ALLOWED_OIDC_REDIRECT_URI;
  if (allowedRedirect && redirectUri !== allowedRedirect) {
    return json(res, 400, { error: 'Invalid redirectUri' });
  }

  let identity;
  try {
    identity = await exchangeCodeForIdentity({ provider, code, codeVerifier, redirectUri });
  } catch (error) {
    console.error('OIDC exchange failed', error);
    if (error instanceof SsoError) {
      return json(res, error.status, { error: error.publicMessage });
    }
    return json(res, 401, { error: 'Single sign-on could not be verified. Please try again.' });
  }

  try {
    const store = await readStore();
    const account = resolveAccount(store, identity.email);
    if (!account) {
      return json(res, 403, {
        error: 'Your account has not been provisioned for NyxHICSlab. Ask your facility administrator to add you.',
      });
    }

    const session = await completeLogin(req, res, {
      ...account,
      fullName: account.user?.fullName || identity.fullName,
    }, {
      authMethod: provider === 'okta' ? 'okta-oidc' : 'entra-oidc',
      persistent: body.remember !== false,
    });
    return json(res, 200, session);
  } catch (error) {
    console.error('OIDC session issue failed', error);
    return json(res, 500, { error: 'Unable to complete sign in right now. Please try again.' });
  }
}
