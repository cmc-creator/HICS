import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { hashPassword } from './_passwords.js';

const STORE_KEY = '__nyx_hics_store__';
const STORE_MODE_KEY = '__nyx_hics_store_mode__';
const STORE_REDIS_KEY = process.env.HICS_STORE_REDIS_KEY || 'nyx:hics:store:v1';

const STORE_FILE_PATH = process.env.HICS_STORE_FILE_PATH
  || path.join(process.cwd(), '.nyx-hics-store.json');

const FALLBACK_TMP_FILE_PATH = path.join(os.tmpdir(), 'nyx-hics-store.json');

function createSeedUsers() {
  // Demo users exist only for local demos (HICS_SEED_DEMO=true).
  // They are passwordless, so they can never sign in with a
  // password - production stores start with no users at all and
  // get their first admin from the bootstrap env (see below).
  if (process.env.HICS_SEED_DEMO !== 'true') {
    return [];
  }

  return [
    {
      id: 'usr-1',
      fullName: 'Alex Rivera',
      email: 'alex.rivera@northcampus.org',
      role: 'facility-admin',
      facility: 'general-acute-care',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'usr-2',
      fullName: 'Jamie Patel',
      email: 'jamie.patel@northcampus.org',
      role: 'facilitator',
      facility: 'community-hospital',
      status: 'active',
      createdAt: new Date().toISOString(),
    },
  ];
}

function createInitialStore() {
  return {
    attempts: [],
    events: [],
    progress: {},
    users: createSeedUsers(),
    auditLogs: [],
    notifications: [],
    refreshTokens: [],
    mediaAssets: [],
    liveDrills: [],
    rapidChallengeScores: [],
    leads: [],
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return null;
  }

  return { url, token };
}

async function readStoreFromRedis() {
  const redis = getRedisConfig();
  if (!redis) {
    return null;
  }

  const response = await fetch(`${redis.url}/get/${encodeURIComponent(STORE_REDIS_KEY)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${redis.token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Redis GET failed with status ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || typeof payload.result !== 'string') {
    return null;
  }

  const parsed = JSON.parse(payload.result);
  // Only a plain object is a store. Anything else (an array, a
  // string) means the stored value is not one of ours - e.g. it was
  // written by the pre-2026-11-16 write path, which wrapped the
  // store JSON in a JSON array that Upstash stored literally.
  // Treat it as missing so a fresh, correctly shaped store is
  // created and written back, healing the database automatically.
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  return parsed;
}

async function writeStoreToRedis(store) {
  const redis = getRedisConfig();
  if (!redis) {
    return false;
  }

  // Use POST body to avoid URL length limits on large stores. The
  // body must be the raw store JSON: the Upstash REST API stores a
  // POST body verbatim. (An earlier version sent a JSON array
  // containing the store JSON; Upstash stored that array text
  // literally, so every later read parsed back an array instead of
  // the store object and handlers crashed on missing collections.)
  const response = await fetch(`${redis.url}/set/${encodeURIComponent(STORE_REDIS_KEY)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redis.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(store),
  });

  if (!response.ok) {
    throw new Error(`Redis SET failed with status ${response.status}`);
  }

  return true;
}

async function readStoreFromFile(targetPath) {
  try {
    const raw = await fs.readFile(targetPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeStoreToFile(targetPath, store) {
  const directory = path.dirname(targetPath);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(store, null, 2), 'utf8');
}

function warnIfEphemeralStoreInProduction(mode) {
  if (process.env.VERCEL_ENV !== 'production') {
    return;
  }
  if (getRedisConfig()) {
    return;
  }
  if (mode !== 'file' && mode !== 'tmp-file') {
    return;
  }
  console.error(
    `[NyxHICSlab] WARNING: the production API store is persisting to "${mode}" `
    + 'because Upstash Redis is not configured (UPSTASH_REDIS_REST_URL / '
    + 'UPSTASH_REDIS_REST_TOKEN are missing). Files on the serverless '
    + 'filesystem are ephemeral: users, training records, and audit logs '
    + 'WILL NOT persist reliably across invocations. Configure Upstash '
    + 'Redis before relying on this deployment for real training data.',
  );
}

// Creates the bootstrap enterprise admin from env on store load.
// Runs for every load source (Redis, file, tmp, fresh) and is
// idempotent: once a user with the bootstrap email exists, this
// never creates a duplicate and never overwrites their password.
async function ensureBootstrapAdmin(store) {
  const email = String(process.env.HICS_BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.HICS_BOOTSTRAP_ADMIN_PASSWORD || '');
  if (!email && !password) {
    return; // Bootstrap admin not configured at all - nothing to do.
  }
  // Partial or invalid configuration used to disable the bootstrap
  // admin silently (audit S4): a fresh environment could come up
  // with no admin and no signal. Log it loudly instead.
  if (!email) {
    console.error('[NyxHICSlab] HICS_BOOTSTRAP_ADMIN_PASSWORD is set but HICS_BOOTSTRAP_ADMIN_EMAIL is missing - bootstrap admin NOT created.');
    return;
  }
  if (password.length < 10) {
    console.error('[NyxHICSlab] HICS_BOOTSTRAP_ADMIN_PASSWORD is shorter than 10 characters - bootstrap admin NOT created.');
    return;
  }

  if (!Array.isArray(store.users)) {
    store.users = [];
  }

  const exists = store.users.some(
    (candidate) => String(candidate?.email || '').toLowerCase() === email,
  );
  if (exists) {
    return;
  }

  store.users.unshift({
    id: createId('usr'),
    fullName: 'Bootstrap Admin',
    email,
    role: 'enterprise-admin',
    facility: 'all',
    organization: process.env.DEFAULT_ORGANIZATION_NAME || 'Enterprise Health System',
    status: 'active',
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(password),
  });

  await saveStore(store);
}

// Shared read path behind loadStore() and reloadStore(): Redis
// first, then the primary store file, then the tmp fallback, then
// a fresh in-memory store. Returns the store plus the mode it
// came from.
async function readStoreFromBacking() {
  let store = null;
  let mode = 'memory';

  try {
    store = await readStoreFromRedis();
    if (store) {
      mode = 'redis';
    }
  } catch (error) {
    console.error(
      '[NyxHICSlab] Redis store read failed; falling back to file/tmp storage:',
      error instanceof Error ? error.message : error,
    );
    store = null;
  }

  if (!store) {
    store = await readStoreFromFile(STORE_FILE_PATH);
    if (store) {
      mode = 'file';
    }
  }

  if (!store) {
    store = await readStoreFromFile(FALLBACK_TMP_FILE_PATH);
    if (store) {
      mode = 'tmp-file';
    }
  }

  if (!store) {
    store = createInitialStore();
    mode = 'memory';
  }

  return { store, mode };
}

// Fills in any top-level collections a loaded store is missing
// (older or partially written data) so handlers can rely on the
// store's shape - appendAuditLog, for one, crashes on a store
// whose auditLogs array is absent. Collections that are present
// but the WRONG TYPE (null, a string, an array where an object
// belongs) are reset to their defaults too (audit W5): a single
// corrupted value must not 500 every handler that touches it.
function ensureStoreShape(store) {
  const defaults = createInitialStore();
  for (const key of Object.keys(defaults)) {
    const expected = defaults[key];
    const actual = store[key];
    if (Array.isArray(expected)) {
      if (!Array.isArray(actual)) {
        store[key] = expected;
      }
    } else if (expected && typeof expected === 'object') {
      if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
        store[key] = expected;
      }
    }
  }
  return store;
}

// Shared tail for loadStore() and reloadStore(): installs the
// store as this instance's cache, warns about ephemeral production
// persistence, and makes sure the bootstrap admin exists.
async function installLoadedStore(store, mode) {
  ensureStoreShape(store);
  globalThis[STORE_KEY] = store;
  globalThis[STORE_MODE_KEY] = mode;
  warnIfEphemeralStoreInProduction(mode);
  await ensureBootstrapAdmin(store);
  return store;
}

export async function loadStore() {
  if (globalThis[STORE_KEY]) {
    if (!globalThis[STORE_MODE_KEY]) {
      globalThis[STORE_MODE_KEY] = 'memory';
    }
    return globalThis[STORE_KEY];
  }

  const { store, mode } = await readStoreFromBacking();
  return installLoadedStore(store, mode);
}

// Forces a fresh read from the backing store and replaces this
// instance's cache with what was read. Auth-critical handlers
// (forgot/reset password, credential login, refresh-session
// validation) call this instead of getStore(): a warm serverless
// instance's cache can predate another instance's writes - a
// freshly created reset token, a new password hash, a session
// revocation - and trusting it makes valid reset links report
// "invalid or expired" and revoked sessions look alive.
export async function reloadStore() {
  const { store, mode } = await readStoreFromBacking();
  return installLoadedStore(store, mode);
}

export async function saveStore(store) {
  globalThis[STORE_KEY] = store;

  try {
    const wroteRedis = await writeStoreToRedis(store);
    if (wroteRedis) {
      globalThis[STORE_MODE_KEY] = 'redis';
      return;
    }
  } catch (error) {
    console.error(
      '[NyxHICSlab] Redis store write failed; falling back to file/tmp storage:',
      error instanceof Error ? error.message : error,
    );
    // Fall through to file persistence.
  }

  try {
    await writeStoreToFile(STORE_FILE_PATH, store);
    globalThis[STORE_MODE_KEY] = 'file';
    warnIfEphemeralStoreInProduction('file');
    return;
  } catch {
    // Try temporary path on restricted filesystems (e.g., serverless runtime).
  }

  try {
    await writeStoreToFile(FALLBACK_TMP_FILE_PATH, store);
    globalThis[STORE_MODE_KEY] = 'tmp-file';
    warnIfEphemeralStoreInProduction('tmp-file');
  } catch {
    // Final fallback is in-memory only for this runtime.
    globalThis[STORE_MODE_KEY] = 'memory';
  }
}

export async function getStore() {
  return loadStore();
}

export function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function appendAuditLog(store, action, data = {}) {
  // Never throw on shape: audit logging rides along inside other
  // handlers' mutations, and a malformed auditLogs value must not
  // take the whole request down with it (audit W5).
  if (!Array.isArray(store.auditLogs)) {
    store.auditLogs = [];
  }
  const entry = {
    id: createId('audit'),
    action,
    at: new Date().toISOString(),
    data,
  };
  store.auditLogs.unshift(entry);
  store.auditLogs = store.auditLogs.slice(0, 2000);
  return entry;
}

export async function addAuditLog(action, data = {}) {
  const store = await loadStore();
  const entry = appendAuditLog(store, action, data);
  await saveStore(store);
  return entry;
}

export function snapshotStore(store) {
  return clone(store);
}

export function getStoreHealth() {
  return {
    mode: globalThis[STORE_MODE_KEY] ?? 'unknown',
    redisConfigured: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    redisKey: STORE_REDIS_KEY,
    filePath: STORE_FILE_PATH,
    fallbackTmpFilePath: FALLBACK_TMP_FILE_PATH,
  };
}

export function json(res, status, payload) {
  return res.status(status).json(payload);
}
