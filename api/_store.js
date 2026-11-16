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

  return JSON.parse(payload.result);
}

async function writeStoreToRedis(store) {
  const redis = getRedisConfig();
  if (!redis) {
    return false;
  }

  // Use POST body to avoid URL length limits on large stores.
  const response = await fetch(`${redis.url}/set/${encodeURIComponent(STORE_REDIS_KEY)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redis.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([JSON.stringify(store)]),
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
  if (!email || password.length < 10) {
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

export async function loadStore() {
  if (globalThis[STORE_KEY]) {
    if (!globalThis[STORE_MODE_KEY]) {
      globalThis[STORE_MODE_KEY] = 'memory';
    }
    return globalThis[STORE_KEY];
  }

  let store = null;

  try {
    store = await readStoreFromRedis();
    if (store) {
      globalThis[STORE_MODE_KEY] = 'redis';
    }
  } catch {
    store = null;
  }

  if (!store) {
    store = await readStoreFromFile(STORE_FILE_PATH);
    if (store) {
      globalThis[STORE_MODE_KEY] = 'file';
    }
  }

  if (!store) {
    store = await readStoreFromFile(FALLBACK_TMP_FILE_PATH);
    if (store) {
      globalThis[STORE_MODE_KEY] = 'tmp-file';
    }
  }

  if (!store) {
    store = createInitialStore();
    globalThis[STORE_MODE_KEY] = 'memory';
  }

  globalThis[STORE_KEY] = store;
  warnIfEphemeralStoreInProduction(globalThis[STORE_MODE_KEY]);
  await ensureBootstrapAdmin(store);
  return store;
}

export async function saveStore(store) {
  globalThis[STORE_KEY] = store;

  try {
    const wroteRedis = await writeStoreToRedis(store);
    if (wroteRedis) {
      globalThis[STORE_MODE_KEY] = 'redis';
      return;
    }
  } catch {
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
