import crypto from 'node:crypto';

export const ROLES = ['enterprise-admin', 'facility-admin', 'training-manager', 'facilitator', 'observer'];

const ROLE_RANK = {
  'enterprise-admin': 4,
  'facility-admin': 3,
  'training-manager': 2,
  facilitator: 1,
  observer: 0,
};

const SCRYPT_KEY_LENGTH = 64;
let timingEqualizerHash = null;

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
}

/** Only enterprise admins can grant enterprise-admin; everyone else can grant up to their own level. */
export function canAssignRole(actorRole, targetRole) {
  if (!ROLES.includes(targetRole)) {
    return false;
  }
  if (actorRole === 'enterprise-admin') {
    return true;
  }
  return targetRole !== 'enterprise-admin' && ROLE_RANK[targetRole] <= (ROLE_RANK[actorRole] ?? -1);
}

function bootstrapAdminEmails() {
  return String(process.env.BOOTSTRAP_ADMIN_EMAILS || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);
}

/**
 * Roles and facilities come only from provisioned accounts (or the bootstrap admin
 * list), never from the shape of an email address. Unknown or inactive users get null.
 */
export function resolveAccount(store, email) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }

  const user = (store.users || []).find((item) => normalizeEmail(item.email) === normalized);
  if (user) {
    if (user.status !== 'active' || !ROLES.includes(user.role)) {
      return null;
    }
    return {
      user,
      email: normalized,
      role: user.role,
      facility: String(user.facility || (user.role === 'enterprise-admin' ? 'all' : '')),
      fullName: user.fullName,
      organization: user.organization,
    };
  }

  if (bootstrapAdminEmails().includes(normalized)) {
    return {
      user: null,
      email: normalized,
      role: 'enterprise-admin',
      facility: 'all',
      fullName: normalized,
      organization: undefined,
    };
  }

  return null;
}

/** Strip secrets before a user record leaves the server. */
export function toPublicUser(user) {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, SCRYPT_KEY_LENGTH);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password, storedHash) {
  const [scheme, saltB64, hashB64] = String(storedHash || '').split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) {
    return false;
  }

  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

/** Spend the same scrypt time for unknown accounts so timing doesn't reveal which emails exist. */
export function burnPasswordCheck(password) {
  timingEqualizerHash ??= hashPassword(crypto.randomBytes(16).toString('hex'));
  verifyPassword(password, timingEqualizerHash);
  return false;
}
