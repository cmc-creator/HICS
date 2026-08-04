import crypto from 'node:crypto';
import { addAuditLog, createId, getStore, saveStore } from './_store.js';

const DEFAULT_REFRESH_TTL_DAYS = 30;

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
    role: String(claims.role || 'facility-admin'),
    facility: String(claims.facility || 'psychiatric-inpatient'),
    authMethod: String(claims.authMethod || 'oidc'),
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
  const store = await getStore();
  ensureRefreshStoreShape(store);
  cleanupExpiredSessions(store, Date.now());

  const refreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);
  const session = buildSessionRecord(tokenHash, claims, metadata);

  store.refreshTokens.unshift(session);
  store.refreshTokens = store.refreshTokens.slice(0, 10000);
  await saveStore(store);

  await addAuditLog('auth_refresh_issued', {
    email: session.email,
    role: session.role,
    facility: session.facility,
    familyId: session.familyId,
  });

  return {
    refreshToken,
    session,
  };
}

export async function rotateRefreshSession(existingRefreshToken, metadata = {}) {
  const store = await getStore();
  ensureRefreshStoreShape(store);
  cleanupExpiredSessions(store, Date.now());

  const existingHash = hashRefreshToken(existingRefreshToken);
  const seenSession = anySessionFromTokenHash(store, existingHash);
  const existing = activeSessionFromTokenHash(store, existingHash);

  if (seenSession && !existing) {
    const replayReason = seenSession.revokedReason === 'rotated' ? 'replay-detected' : 'invalid-reused-token';
    revokeFamily(store, seenSession.familyId, replayReason);
    await saveStore(store);

    await addAuditLog('auth_refresh_replay_detected', {
      email: seenSession.email,
      familyId: seenSession.familyId,
      facility: seenSession.facility,
      reason: replayReason,
    });

    return {
      error: 'replay-detected',
    };
  }

  if (!existing) {
    return null;
  }

  const claims = {
    email: existing.email,
    fullName: existing.fullName,
    organization: existing.organization,
    role: existing.role,
    facility: existing.facility,
    authMethod: existing.authMethod,
  };

  const nextRefreshToken = generateRefreshToken();
  const nextHash = hashRefreshToken(nextRefreshToken);
  const nextSession = buildSessionRecord(nextHash, claims, {
    ...metadata,
    familyId: existing.familyId,
  });

  existing.revokedAt = nowIso();
  existing.replacedBy = nextSession.id;
  existing.revokedReason = 'rotated';
  existing.lastUsedAt = nowIso();

  store.refreshTokens.unshift(nextSession);
  store.refreshTokens = store.refreshTokens.slice(0, 10000);
  await saveStore(store);

  await addAuditLog('auth_refresh_rotated', {
    email: existing.email,
    familyId: existing.familyId,
    previousSessionId: existing.id,
    nextSessionId: nextSession.id,
    facility: existing.facility,
  });

  return {
    refreshToken: nextRefreshToken,
    session: nextSession,
  };
}

export async function revokeRefreshSession(refreshToken, reason = 'logout') {
  const store = await getStore();
  ensureRefreshStoreShape(store);

  const tokenHash = hashRefreshToken(refreshToken);
  const target = store.refreshTokens.find((session) => session.tokenHash === tokenHash);
  if (!target) {
    return false;
  }

  if (!target.revokedAt) {
    target.revokedAt = nowIso();
    target.revokedReason = reason;
    target.lastUsedAt = nowIso();
  }

  await saveStore(store);

  await addAuditLog('auth_refresh_revoked', {
    email: target.email,
    familyId: target.familyId,
    facility: target.facility,
    reason,
  });

  return true;
}