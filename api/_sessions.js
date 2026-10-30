import crypto from 'node:crypto';
import { ACCESS_TOKEN_TTL_SECONDS, issueSignedAccessToken } from './_auth.js';
import { appendAuditLog, createId, updateStore } from './_store.js';
import { resolveAccount } from './_users.js';

const DEFAULT_REFRESH_TTL_DAYS = 30;
const REFRESH_COOKIE_NAME = 'nyx_rt';
const REFRESH_COOKIE_PATH = '/api/auth';
// Two tabs can refresh at the same moment with the same cookie. Treat a reuse this soon
// after rotation as a benign race instead of a stolen token.
const ROTATION_GRACE_MS = 15 * 1000;

function refreshTtlMs() {
  const configured = Number(process.env.REFRESH_TOKEN_TTL_DAYS || DEFAULT_REFRESH_TTL_DAYS);
  const safeDays = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_REFRESH_TTL_DAYS;
  return safeDays * 24 * 60 * 60 * 1000;
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function asIso(ms) {
  return new Date(ms).toISOString();
}

export function getRequestMetadata(req) {
  return {
    ip: req.headers?.['x-real-ip'] || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown',
    userAgent: req.headers?.['user-agent'] || 'unknown',
  };
}

// The refresh token lives only in an httpOnly cookie scoped to /api/auth, so page
// scripts (and any XSS) can never read it. SameSite=Strict blocks cross-site use.
export function setRefreshCookie(res, refreshToken, { persistent }) {
  const parts = [
    `${REFRESH_COOKIE_NAME}=${refreshToken}`,
    `Path=${REFRESH_COOKIE_PATH}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
  ];
  if (persistent) {
    parts.push(`Max-Age=${Math.floor(refreshTtlMs() / 1000)}`);
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearRefreshCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${REFRESH_COOKIE_NAME}=; Path=${REFRESH_COOKIE_PATH}; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
  );
}

export function readRefreshCookie(req) {
  const header = req.headers?.cookie;
  if (typeof header !== 'string') {
    return '';
  }

  for (const part of header.split(';')) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name === REFRESH_COOKIE_NAME) {
      return valueParts.join('=');
    }
  }
  return '';
}

function ensureRefreshStoreShape(store) {
  if (!Array.isArray(store.refreshTokens)) {
    store.refreshTokens = [];
  }
}

function cleanupExpiredSessions(store, nowMs) {
  ensureRefreshStoreShape(store);
  store.refreshTokens = store.refreshTokens.filter((session) => {
    const expires = new Date(session.expiresAt || 0).getTime();
    return Number.isFinite(expires) && expires > nowMs - (7 * 24 * 60 * 60 * 1000);
  });
}

function buildSessionRecord(tokenHash, claims, metadata) {
  const issuedAtMs = Date.now();
  return {
    id: createId('sess'),
    tokenHash,
    familyId: metadata.familyId || createId('fam'),
    email: String(claims.email || '').toLowerCase(),
    fullName: String(claims.fullName || ''),
    organization: String(claims.organization || 'Enterprise Health System'),
    role: String(claims.role),
    facility: String(claims.facility),
    authMethod: String(claims.authMethod || 'oidc'),
    persistent: Boolean(metadata.persistent),
    issuedAt: asIso(issuedAtMs),
    expiresAt: asIso(issuedAtMs + refreshTtlMs()),
    lastUsedAt: asIso(issuedAtMs),
    revokedAt: null,
    replacedBy: null,
    revokedReason: null,
    issuedIp: metadata.ip || 'unknown',
    issuedUserAgent: metadata.userAgent || 'unknown',
  };
}

function activeSessionFromTokenHash(store, tokenHash) {
  const nowMs = Date.now();
  return store.refreshTokens.find((session) => {
    const expires = new Date(session.expiresAt || 0).getTime();
    if (!Number.isFinite(expires) || expires <= nowMs) {
      return false;
    }
    if (session.revokedAt) {
      return false;
    }
    return session.tokenHash === tokenHash;
  });
}

function anySessionFromTokenHash(store, tokenHash) {
  return store.refreshTokens.find((session) => session.tokenHash === tokenHash) || null;
}

function revokeFamily(store, familyId, reason) {
  const stamp = nowIso();
  for (const session of store.refreshTokens) {
    if (session.familyId !== familyId || session.revokedAt) {
      continue;
    }

    session.revokedAt = stamp;
    session.revokedReason = reason;
    session.lastUsedAt = stamp;
  }
}

export async function issueRefreshSession(claims, metadata = {}) {
  const refreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);

  const session = await updateStore((store) => {
    cleanupExpiredSessions(store, Date.now());

    const record = buildSessionRecord(tokenHash, claims, metadata);
    store.refreshTokens.unshift(record);
    store.refreshTokens = store.refreshTokens.slice(0, 10000);
    appendAuditLog(store, 'auth_refresh_issued', {
      email: record.email,
      role: record.role,
      facility: record.facility,
      familyId: record.familyId,
    });
    return record;
  });

  return {
    refreshToken,
    session,
  };
}

export async function rotateRefreshSession(existingRefreshToken, metadata = {}) {
  const existingHash = hashRefreshToken(existingRefreshToken);
  const nextRefreshToken = generateRefreshToken();
  const nextHash = hashRefreshToken(nextRefreshToken);

  return updateStore((store) => {
    cleanupExpiredSessions(store, Date.now());

    const seenSession = anySessionFromTokenHash(store, existingHash);
    const existing = activeSessionFromTokenHash(store, existingHash);

    if (seenSession && !existing) {
      const rotatedRecently = seenSession.revokedReason === 'rotated'
        && Date.now() - new Date(seenSession.revokedAt || 0).getTime() < ROTATION_GRACE_MS;
      if (rotatedRecently) {
        return { error: 'stale-token' };
      }

      const replayReason = seenSession.revokedReason === 'rotated' ? 'replay-detected' : 'invalid-reused-token';
      revokeFamily(store, seenSession.familyId, replayReason);
      appendAuditLog(store, 'auth_refresh_replay_detected', {
        email: seenSession.email,
        familyId: seenSession.familyId,
        facility: seenSession.facility,
        reason: replayReason,
      });
      return { error: 'replay-detected' };
    }

    if (!existing) {
      return null;
    }

    // Re-check the account on every refresh so deactivations and role changes take
    // effect within one access-token lifetime instead of lasting for the whole session.
    const account = resolveAccount(store, existing.email);
    if (!account) {
      revokeFamily(store, existing.familyId, 'account-inactive');
      appendAuditLog(store, 'auth_refresh_denied_inactive', {
        email: existing.email,
        familyId: existing.familyId,
        facility: existing.facility,
      });
      return { error: 'account-inactive' };
    }

    const claims = {
      email: existing.email,
      fullName: account.fullName || existing.fullName,
      organization: account.organization || existing.organization,
      role: account.role,
      facility: account.facility,
      authMethod: existing.authMethod,
    };

    const nextSession = buildSessionRecord(nextHash, claims, {
      ...metadata,
      familyId: existing.familyId,
      persistent: existing.persistent,
    });

    existing.revokedAt = nowIso();
    existing.replacedBy = nextSession.id;
    existing.revokedReason = 'rotated';
    existing.lastUsedAt = nowIso();

    store.refreshTokens.unshift(nextSession);
    store.refreshTokens = store.refreshTokens.slice(0, 10000);
    appendAuditLog(store, 'auth_refresh_rotated', {
      email: existing.email,
      familyId: existing.familyId,
      previousSessionId: existing.id,
      nextSessionId: nextSession.id,
      facility: nextSession.facility,
    });

    return {
      refreshToken: nextRefreshToken,
      session: nextSession,
    };
  });
}

/** Response body for a signed-in user; the refresh token goes out only as a cookie. */
export function buildSessionResponse(accessToken, claims) {
  return {
    accessToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    email: claims.email,
    fullName: claims.fullName,
    organization: claims.organization,
    role: claims.role,
    facility: claims.facility,
  };
}

/** Issue an access token plus a refresh cookie for an account resolved by resolveAccount. */
export async function completeLogin(req, res, account, { authMethod, persistent }) {
  const claims = {
    email: account.email,
    fullName: account.fullName || account.email,
    organization: account.organization || process.env.DEFAULT_ORGANIZATION_NAME || 'Enterprise Health System',
    role: account.role,
    facility: account.facility,
    authMethod,
  };

  const accessToken = issueSignedAccessToken(claims);
  const { refreshToken } = await issueRefreshSession(claims, {
    ...getRequestMetadata(req),
    persistent,
  });
  setRefreshCookie(res, refreshToken, { persistent });

  return buildSessionResponse(accessToken, claims);
}

export async function revokeRefreshSession(refreshToken, reason = 'logout') {
  const tokenHash = hashRefreshToken(refreshToken);

  return updateStore((store) => {
    ensureRefreshStoreShape(store);

    const target = store.refreshTokens.find((session) => session.tokenHash === tokenHash);
    if (!target) {
      return false;
    }

    if (!target.revokedAt) {
      target.revokedAt = nowIso();
      target.revokedReason = reason;
      target.lastUsedAt = nowIso();
    }

    appendAuditLog(store, 'auth_refresh_revoked', {
      email: target.email,
      familyId: target.familyId,
      facility: target.facility,
      reason,
    });
    return true;
  });
}
