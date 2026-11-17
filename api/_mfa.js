import crypto from 'node:crypto';

// Opt-in MFA for password accounts: TOTP (RFC 6238) built on
// HOTP (RFC 4226) with HMAC-SHA1, plus one-time recovery codes.
// Node's built-in crypto only - no new dependencies.
//
// Storage model (on the user record):
//   user.mfa = {
//     enabled: true,
//     secretEncrypted,        // base32 TOTP secret, AES-256-GCM
//                             // encrypted under a key derived from
//                             // TOKEN_SIGNING_SECRET, so a store
//                             // leak alone does not expose secrets
//     recoveryCodeHashes,     // sha256 hashes, one per code;
//                             // a code is removed when used
//     enrolledAt,
//   }
//   user.mfaPending = { secretEncrypted, createdAt }  // enrollment
//                             // started but not yet confirmed
//
// Enrollment is strictly opt-in per user. SSO users never touch
// any of this (their identity provider owns MFA), and a user with
// no mfa record signs in exactly as before.

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const RECOVERY_CODE_COUNT = 8;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const ISSUER = 'NyxHICSlab';

/* ---------------- base32 (RFC 4648) ---------------- */

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  while (output.length % 8 !== 0) {
    output += '=';
  }
  return output;
}

export function base32Decode(text) {
  const cleaned = String(text || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      continue;
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/* ---------------- HOTP / TOTP (RFC 4226 / 6238) ---------------- */

export function hotp(secretBase32, counter, digits = TOTP_DIGITS) {
  const key = base32Decode(secretBase32);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', key).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  const code = binary % (10 ** digits);
  return String(code).padStart(digits, '0');
}

export function totp(secretBase32, timestampMs = Date.now(), digits = TOTP_DIGITS) {
  const counter = Math.floor(timestampMs / 1000 / TOTP_STEP_SECONDS);
  return hotp(secretBase32, counter, digits);
}

function codesEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

// Accepts the current code plus one step either side (clock skew
// between the user's phone and the server is normal).
export function verifyTotp(secretBase32, code, timestampMs = Date.now()) {
  const normalized = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(normalized)) {
    return false;
  }
  const counter = Math.floor(timestampMs / 1000 / TOTP_STEP_SECONDS);
  for (const candidate of [counter - 1, counter, counter + 1]) {
    if (candidate >= 0 && codesEqual(hotp(secretBase32, candidate), normalized)) {
      return true;
    }
  }
  return false;
}

export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20)).replace(/=+$/, '');
}

export function buildOtpAuthUri({ account, secret }) {
  const label = `${encodeURIComponent(ISSUER)}:${encodeURIComponent(String(account || ''))}`;
  const params = new URLSearchParams({
    secret: String(secret || ''),
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/* ---------------- secret encryption at rest ---------------- */

function getEncryptionKey() {
  const secret = process.env.TOKEN_SIGNING_SECRET || '';
  if (!secret) {
    return null;
  }
  return crypto.createHash('sha256').update(`nyx-mfa-secret-encryption:${secret}`).digest();
}

export function encryptTotpSecret(plainSecret) {
  const key = getEncryptionKey();
  if (!key) {
    return null;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plainSecret), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['gcm', iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join('$');
}

export function decryptTotpSecret(stored) {
  try {
    const key = getEncryptionKey();
    if (!key) {
      return null;
    }
    const parts = String(stored || '').split('$');
    if (parts.length !== 4 || parts[0] !== 'gcm') {
      return null;
    }
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(parts[1], 'hex'));
    decipher.setAuthTag(Buffer.from(parts[2], 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(parts[3], 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/* ---------------- recovery codes ---------------- */

function normalizeRecoveryCode(code) {
  return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT) {
  const codes = [];
  for (let index = 0; index < count; index += 1) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

// Tries a recovery code against the user's stored hashes. On a
// match the hash is REMOVED from the record (single-use) and the
// caller must save the store. Returns true when a code matched.
export function consumeRecoveryCode(user, code) {
  const hashes = Array.isArray(user?.mfa?.recoveryCodeHashes) ? user.mfa.recoveryCodeHashes : [];
  const candidateHash = hashRecoveryCode(code);
  const index = hashes.findIndex((stored) => codesEqual(stored, candidateHash));
  if (index === -1) {
    return false;
  }
  hashes.splice(index, 1);
  user.mfa.recoveryCodeHashes = hashes;
  return true;
}

/* ---------------- verification against a user record ---------------- */

// Returns 'totp' or 'recovery' when the code is valid for this
// user, null otherwise. A matched recovery code is consumed
// (mutates the record; the caller saves).
export function verifyUserMfaCode(user, code) {
  if (!user?.mfa?.enabled) {
    return null;
  }
  const secret = decryptTotpSecret(user.mfa.secretEncrypted);
  if (secret && verifyTotp(secret, code)) {
    return 'totp';
  }
  if (consumeRecoveryCode(user, code)) {
    return 'recovery';
  }
  return null;
}

/* ---------------- MFA challenge tokens ----------------
   After the password verifies, local-login returns a short-lived
   challenge token instead of a session; /api/auth/mfa/verify
   exchanges challenge + code for the real session. The token is
   HMAC-signed like an access token but carries a purpose field
   and an "mfa." prefix, which makes it structurally unusable as
   an access token (the access-token parser expects exactly
   <payload>.<signature>). */

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function signChallengePayload(encodedPayload) {
  return base64UrlEncode(
    crypto.createHmac('sha256', process.env.TOKEN_SIGNING_SECRET || '').update(encodedPayload).digest(),
  );
}

export function issueMfaChallengeToken(email) {
  if (!process.env.TOKEN_SIGNING_SECRET) {
    throw new Error('TOKEN_SIGNING_SECRET is required to issue MFA challenge tokens');
  }
  const payload = {
    purpose: 'mfa-challenge',
    email: String(email || '').toLowerCase(),
    exp: Math.floor((Date.now() + CHALLENGE_TTL_MS) / 1000),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  return `mfa.${encodedPayload}.${signChallengePayload(encodedPayload)}`;
}

export function parseMfaChallengeToken(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3 || parts[0] !== 'mfa') {
      return null;
    }
    const [, encodedPayload, signature] = parts;
    if (!codesEqual(signature, signChallengePayload(encodedPayload))) {
      return null;
    }
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (!payload || payload.purpose !== 'mfa-challenge' || typeof payload.email !== 'string') {
      return null;
    }
    if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload.email;
  } catch {
    return null;
  }
}
