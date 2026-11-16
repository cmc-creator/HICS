import crypto from 'node:crypto';

// Password credentials and set-password tokens.
//
// Passwords are hashed with scrypt (node:crypto) using a random
// per-password salt. The stored `passwordHash` string is:
//   scrypt$<N>$<r>$<p>$<saltHex>$<derivedKeyHex>
// Verification recomputes the derived key and compares with
// timingSafeEqual so login timing does not leak correctness.

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = crypto.scryptSync(String(password), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return ['scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString('hex'), derived.toString('hex')].join('$');
}

export function verifyPassword(password, storedHash) {
  try {
    const parts = String(storedHash || '').split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') {
      return false;
    }

    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = Buffer.from(parts[4], 'hex');
    const expected = Buffer.from(parts[5], 'hex');
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p) || salt.length === 0 || expected.length === 0) {
      return false;
    }

    const derived = crypto.scryptSync(String(password), salt, expected.length, { N, r, p });
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken || '')).digest('hex');
}

function hashesEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// Creates a single-use set-password token for a user record. Only the
// sha256 hash of the token is stored (plus a 1-hour expiry); the raw
// token is returned to the caller so it can be placed in an email link.
// The caller is responsible for saving the store afterwards.
export function createPasswordToken(store, user) {
  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  user.passwordTokenHash = hashToken(rawToken);
  user.passwordTokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  return rawToken;
}

// Finds the user a raw set-password token belongs to. Returns null when
// the token is unknown or expired. Does not mutate the user record -
// the caller clears `passwordTokenHash` / `passwordTokenExpiresAt`
// once the token has been successfully used.
export function consumePasswordToken(store, rawToken) {
  if (!rawToken || typeof rawToken !== 'string') {
    return null;
  }

  const tokenHash = hashToken(rawToken);
  const users = Array.isArray(store?.users) ? store.users : [];
  const user = users.find((candidate) => (
    candidate
    && typeof candidate.passwordTokenHash === 'string'
    && hashesEqual(candidate.passwordTokenHash, tokenHash)
  ));
  if (!user) {
    return null;
  }

  const expiresAt = new Date(user.passwordTokenExpiresAt || 0).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }

  return user;
}
