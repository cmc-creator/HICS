import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getRedisConfig, redisCommand } from './_redis.js';

const STORE_MODE_KEY = '__nyx_hics_store_mode__';
const LOCAL_STORE_KEY = '__nyx_hics_store__';
const LOCAL_LOCK_KEY = '__nyx_hics_store_lock__';
const STORE_REDIS_KEY = process.env.HICS_STORE_REDIS_KEY || 'nyx:hics:store:v1';
const STORE_VERSION_KEY = `${STORE_REDIS_KEY}:version`;
const MAX_UPDATE_ATTEMPTS = 6;

const STORE_FILE_PATH = process.env.HICS_STORE_FILE_PATH
  || path.join(process.cwd(), '.nyx-hics-store.json');

// Compare-and-set: write only if no other request has written since we read.
const CAS_SCRIPT = `
local current = redis.call('GET', KEYS[2]) or '0'
if current ~= ARGV[1] then
  return 0
end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], tostring(tonumber(current) + 1))
return 1
`;

function createInitialStore() {
  return {
    attempts: [],
    events: [],
    progress: {},
    users: [],
    auditLogs: [],
    notifications: [],
    refreshTokens: [],
    mediaAssets: [],
    liveDrills: [],
    rapidChallengeScores: [],
  };
}

function withDefaults(store) {
  return { ...createInitialStore(), ...(store && typeof store === 'object' ? store : {}) };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// Serverless instances share nothing on disk or in memory, so anywhere on Vercel
// the store must be Redis. Falling back silently would lose data between requests.
function requiresDurableStore() {
  return Boolean(process.env.VERCEL) || process.env.HICS_REQUIRE_REDIS === 'true';
}

function assertLocalStoreAllowed() {
  if (requiresDurableStore()) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set; refusing to use non-durable storage.');
  }
}

async function readRedis() {
  const [raw, version] = await redisCommand(['MGET', STORE_REDIS_KEY, STORE_VERSION_KEY]);
  globalThis[STORE_MODE_KEY] = 'redis';
  return {
    store: withDefaults(typeof raw === 'string' ? JSON.parse(raw) : null),
    version: version ?? '0',
  };
}

async function writeRedisIfUnchanged(store, version) {
  const result = await redisCommand([
    'EVAL', CAS_SCRIPT, '2', STORE_REDIS_KEY, STORE_VERSION_KEY, String(version), JSON.stringify(store),
  ]);
  return Number(result) === 1;
}

async function readLocal() {
  if (!globalThis[LOCAL_STORE_KEY]) {
    let stored = null;
    try {
      stored = JSON.parse(await fs.readFile(STORE_FILE_PATH, 'utf8'));
    } catch {
      stored = null;
    }
    globalThis[LOCAL_STORE_KEY] = withDefaults(stored);
  }
  return globalThis[LOCAL_STORE_KEY];
}

async function writeLocal(store) {
  globalThis[LOCAL_STORE_KEY] = store;
  try {
    await fs.mkdir(path.dirname(STORE_FILE_PATH), { recursive: true });
    await fs.writeFile(STORE_FILE_PATH, JSON.stringify(store, null, 2), 'utf8');
    globalThis[STORE_MODE_KEY] = 'file';
  } catch {
    globalThis[STORE_MODE_KEY] = 'memory';
  }
}

// Local development runs in one process, so a promise chain is enough to serialize writes.
async function withLocalLock(fn) {
  const previous = globalThis[LOCAL_LOCK_KEY] || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  globalThis[LOCAL_LOCK_KEY] = previous.then(() => current);
  await previous;
  try {
    return await fn();
  } finally {
    release();
  }
}

function backoff(attempt) {
  return new Promise((resolve) => setTimeout(resolve, 15 * attempt + Math.floor(Math.random() * 25)));
}

/** Fresh read for request handlers that only need to look at data. */
export async function readStore() {
  if (getRedisConfig()) {
    return (await readRedis()).store;
  }

  assertLocalStoreAllowed();
  return clone(await readLocal());
}

/**
 * Read-modify-write that cannot lose concurrent updates. `mutator` receives a fresh
 * copy of the store, may change it, and returns the handler's result. It can run more
 * than once when requests collide, so it must not have side effects outside the store.
 */
export async function updateStore(mutator) {
  if (getRedisConfig()) {
    for (let attempt = 1; attempt <= MAX_UPDATE_ATTEMPTS; attempt += 1) {
      const { store, version } = await readRedis();
      const result = await mutator(store);
      if (await writeRedisIfUnchanged(store, version)) {
        return result;
      }
      await backoff(attempt);
    }
    throw new Error('Store is busy; update could not be applied. Please retry.');
  }

  assertLocalStoreAllowed();
  return withLocalLock(async () => {
    const store = clone(await readLocal());
    const result = await mutator(store);
    await writeLocal(store);
    return result;
  });
}

export function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
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
  return updateStore((store) => appendAuditLog(store, action, data));
}

export function getStoreHealth() {
  const mode = globalThis[STORE_MODE_KEY] ?? 'unknown';
  return {
    mode,
    durable: mode === 'redis',
    redisConfigured: Boolean(getRedisConfig()),
    redisKey: STORE_REDIS_KEY,
    filePath: STORE_FILE_PATH,
  };
}

export function json(res, status, payload) {
  return res.status(status).json(payload);
}
