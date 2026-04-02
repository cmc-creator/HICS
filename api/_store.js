import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const STORE_KEY = '__nyx_hics_store__';
const STORE_REDIS_KEY = process.env.HICS_STORE_REDIS_KEY || 'nyx:hics:store:v1';

const STORE_FILE_PATH = process.env.HICS_STORE_FILE_PATH
  || path.join(process.cwd(), '.nyx-hics-store.json');

const FALLBACK_TMP_FILE_PATH = path.join(os.tmpdir(), 'nyx-hics-store.json');

function createInitialStore() {
  return {
    attempts: [],
    events: [],
    progress: {},
    users: [
      {
        id: 'usr-1',
        fullName: 'Alex Rivera',
        email: 'alex.rivera@northcampus.org',
        role: 'facility-admin',
        facility: 'psychiatric-inpatient',
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
    ],
    auditLogs: [],
    notifications: [],
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

  const encodedStore = encodeURIComponent(JSON.stringify(store));
  const response = await fetch(`${redis.url}/set/${encodeURIComponent(STORE_REDIS_KEY)}/${encodedStore}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redis.token}`,
    },
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

export async function loadStore() {
  if (globalThis[STORE_KEY]) {
    return globalThis[STORE_KEY];
  }

  let store = null;

  try {
    store = await readStoreFromRedis();
  } catch {
    store = null;
  }

  if (!store) {
    store = await readStoreFromFile(STORE_FILE_PATH);
  }

  if (!store) {
    store = await readStoreFromFile(FALLBACK_TMP_FILE_PATH);
  }

  if (!store) {
    store = createInitialStore();
  }

  globalThis[STORE_KEY] = store;
  return store;
}

export async function saveStore(store) {
  globalThis[STORE_KEY] = store;

  try {
    const wroteRedis = await writeStoreToRedis(store);
    if (wroteRedis) {
      return;
    }
  } catch {
    // Fall through to file persistence.
  }

  try {
    await writeStoreToFile(STORE_FILE_PATH, store);
    return;
  } catch {
    // Try temporary path on restricted filesystems (e.g., serverless runtime).
  }

  try {
    await writeStoreToFile(FALLBACK_TMP_FILE_PATH, store);
  } catch {
    // Final fallback is in-memory only for this runtime.
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

export function json(res, status, payload) {
  return res.status(status).json(payload);
}
