// Regression test for the Upstash Redis store transport.
//
// The other suites delete the UPSTASH_* env vars, so the Redis
// read/write path was never exercised - which is how the original
// write format bug survived: writeStoreToRedis sent the store as a
// JSON array containing the store JSON, Upstash stored that array
// text literally, and every later read parsed back an array
// instead of the store object (handlers then crashed on missing
// collections, e.g. appendAuditLog on a store with no auditLogs).
//
// This suite stubs fetch with faithful Upstash REST semantics -
// POST /set/<key> stores the request body verbatim, GET /get/<key>
// returns { result: <stored string or null> } - and proves:
//   1. a store written by one module instance reads back intact
//      (same shape, audit log and users preserved) in a fresh one;
//   2. a legacy poisoned value (the array-wrapped form) is treated
//      as missing and self-heals into a correctly shaped store.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Hermetic file fallback paths, set before any store import
// (STORE_FILE_PATH is read at module load).
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hics-store-test-'));
process.env.HICS_STORE_FILE_PATH = path.join(tmpDir, 'store.json');
process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.example';
process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
delete process.env.HICS_BOOTSTRAP_ADMIN_EMAIL;
delete process.env.HICS_BOOTSTRAP_ADMIN_PASSWORD;
delete process.env.HICS_SEED_DEMO;

// --- Faithful Upstash REST stub -------------------------------------------
const redisData = new Map();
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const u = new URL(String(url));
  const parts = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const respond = (payload) => ({
    ok: true,
    status: 200,
    json: async () => payload,
  });
  if (parts[0] === 'get') {
    return respond({ result: redisData.has(parts[1]) ? redisData.get(parts[1]) : null });
  }
  if (parts[0] === 'set') {
    // Upstash stores a POST body verbatim - this is the behavior
    // the original bug violated.
    redisData.set(parts[1], String(options.body ?? ''));
    return respond({ result: 'OK' });
  }
  throw new Error(`Unexpected fetch in test: ${url}`);
};

// --- 1. Write in instance A, read back intact in fresh instance B ---------
const storeA = await import('../_store.js?instance=a');
const loadedA = await storeA.loadStore();
loadedA.users.push({
  id: 'usr-test',
  fullName: 'Round Trip',
  email: 'roundtrip@example.com',
  role: 'facility-admin',
  facility: 'general-acute-care',
  status: 'active',
  createdAt: new Date().toISOString(),
});
storeA.appendAuditLog(loadedA, 'roundtrip_check', { ok: true });
await storeA.saveStore(loadedA);
assert.equal(storeA.getStoreHealth().mode, 'redis', 'write should land on redis');

const rawStored = [...redisData.values()][0];
assert.equal(typeof rawStored, 'string');
const parsedStored = JSON.parse(rawStored);
assert.ok(
  parsedStored && typeof parsedStored === 'object' && !Array.isArray(parsedStored),
  'stored value must be the store object itself, not an array wrapping it',
);

const storeB = await import('../_store.js?instance=b');
const loadedB = await storeB.reloadStore();
assert.equal(storeB.getStoreHealth().mode, 'redis');
assert.ok(Array.isArray(loadedB.auditLogs), 'auditLogs must survive the round trip');
assert.equal(loadedB.auditLogs[0]?.action, 'roundtrip_check');
assert.ok(
  loadedB.users.some((user) => user.email === 'roundtrip@example.com'),
  'users must survive the round trip',
);
// The crash from production: appendAuditLog on a reloaded store.
storeB.appendAuditLog(loadedB, 'post_reload_append', {});
assert.equal(loadedB.auditLogs[0]?.action, 'post_reload_append');

// --- 2. Legacy poisoned value self-heals -----------------------------------
const key = [...redisData.keys()][0];
redisData.set(key, JSON.stringify([JSON.stringify({ users: [] })]));
const storeC = await import('../_store.js?instance=c');
const loadedC = await storeC.reloadStore();
assert.ok(Array.isArray(loadedC.auditLogs), 'poisoned value must heal into a shaped store');
assert.ok(Array.isArray(loadedC.users));
storeC.appendAuditLog(loadedC, 'after_heal', {});
await storeC.saveStore(loadedC);
const healed = JSON.parse(redisData.get(key));
assert.ok(healed && !Array.isArray(healed) && Array.isArray(healed.auditLogs));

globalThis.fetch = realFetch;
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('store-redis-roundtrip: all assertions passed');
