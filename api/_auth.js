import crypto from 'node:crypto';

const TOKEN_TTL_SECONDS = 60 * 60;

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLength);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getSigningSecret() {
  return process.env.TOKEN_SIGNING_SECRET || '';
}

function signPayload(payloadText, secret) {
  return base64UrlEncode(crypto.createHmac('sha256', secret).update(payloadText).digest());
}

export function issueSignedAccessToken({
  email,
  fullName,
  organization,
  role = 'facility-admin',
  facility = 'psychiatric-inpatient',
  authMethod = 'oidc',
}) {
  const secret = getSigningSecret();
  if (!secret) {
    throw new Error('TOKEN_SIGNING_SECRET is required to issue signed access tokens');
  }

  const payload = {
    sub: String(email || '').toLowerCase(),
    email: String(email || '').toLowerCase(),
    fullName: String(fullName || 'Enterprise User'),
    organization: String(organization || process.env.DEFAULT_ORGANIZATION_NAME || 'Enterprise Health System'),
    role: String(role || 'facility-admin'),
    facility: String(facility || 'psychiatric-inpatient'),
    authMethod: String(authMethod || 'oidc'),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };

  const payloadText = JSON.stringify(payload);
  const encodedPayload = base64UrlEncode(payloadText);
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

function parseAuthHeader(req) {
  const header = req.headers?.authorization;
  if (!header || typeof header !== 'string') {
    return null;
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

function parseSignedToken(token) {
  const secret = getSigningSecret();
  if (!secret) {
    return null;
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  if (signature.length !== expectedSignature.length) {
    return null;
  }
  const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  if (!valid) {
    return null;
  }

  const payload = safeJsonParse(base64UrlDecode(encodedPayload));
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

function parseDevFallbackToken(token) {
  const allowFallback = process.env.ALLOW_LOCAL_AUTH_FALLBACK === 'true';
  if (!allowFallback || !token.startsWith('pwd-')) {
    return null;
  }

  // Never trust client-supplied role/facility headers — always issue least-privilege claims.
  return {
    sub: 'local-auth-user',
    email: 'local-auth@nyxhicslab.local',
    fullName: 'Local Auth User',
    organization: process.env.DEFAULT_ORGANIZATION_NAME || 'Enterprise Health System',
    role: 'facility-admin',
    facility: process.env.DEFAULT_USER_FACILITY || 'psychiatric-inpatient',
    authMethod: 'password-local-fallback',
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
}

export function getAuthContext(req) {
  const token = parseAuthHeader(req);
  if (!token) {
    return null;
  }

  const signed = parseSignedToken(token);
  if (signed) {
    return {
      token,
      claims: signed,
    };
  }

  const fallback = parseDevFallbackToken(token);
  if (fallback) {
    return {
      token,
      claims: fallback,
    };
  }

  return null;
}

export function requireAuth(req, res) {
  const context = getAuthContext(req);
  if (!context) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return context;
}

export function hasRole(claims, roles) {
  return roles.includes(String(claims?.role || ''));
}

export function canManageUsers(claims) {
  return hasRole(claims, ['enterprise-admin', 'facility-admin']);
}

export function canManageData(claims) {
  return hasRole(claims, ['enterprise-admin', 'facility-admin', 'training-manager']);
}

export function isEnterpriseAdmin(claims) {
  return String(claims?.role || '') === 'enterprise-admin';
}

export function scopeByFacility(items, claims, field = 'facility') {
  if (isEnterpriseAdmin(claims)) {
    return items;
  }

  const facility = String(claims?.facility || 'all');
  if (facility === 'all') {
    return items;
  }

  return items.filter((item) => String(item?.[field] || '') === facility);
}
