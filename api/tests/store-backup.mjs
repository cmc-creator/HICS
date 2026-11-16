import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Store backups (sales readiness: tested backup/restore).
//
// The whole app state is one Redis value. This suite stubs fetch
// with faithful Upstash REST semantics (POST /set stores the body
// verbatim, GET /get returns { result }, plus keys/del/strlen)
// and proves the full cycle against the stub - never production:
//   endpoint role rules -> snapshot -> mutate -> inspect ->
//   restore -> the store is byte-for-byte the snapshot again,
// plus pruning to the newest 14 and the 501 path when Redis is
// not configured at all.

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hics-backup-test-'));
process.env.HICS_STORE_FILE_PATH = path.join(tmpDir, 'store.json');
process.env.UPSTASH_REDIS_REST_URL = 'https://fake-upstash.example';
process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
process.env.TOKEN_SIGNING_SECRET = process.env.TOKEN_SIGNING_SECRET || 'test-signing-secret-for-smoke';
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
    redisData.set(parts[1], String(options.body ?? ''));
    return respond({ result: 'OK' });
  }
  if (parts[0] === 'keys') {
    const prefix = parts[1].replace(/\*$/, '');
    return respond({ result: [...redisData.keys()].filter((key) => key.startsWith(prefix)) });
  }
  if (parts[0] === 'del') {
    const existed = redisData.delete(parts[1]);
    return respond({ result: existed ? 1 : 0 });
  }
  if (parts[0] === 'strlen') {
    return respond({ result: redisData.has(parts[1]) ? redisData.get(parts[1]).length : 0 });
  }
  throw new Error(`Unexpected fetch in test: ${url}`);
};

const storeModule = await import('../_store.js');
const { default: backupHandler } = await import('../admin/backup.js');
const { default: storeHealth } = await import('../health/store.js');
const { issueSignedAccessToken } = await import('../_auth.js');

function createMockRes() {
  let statusCode = 200;
  const headers = new Map();
  let ended = false;
  let body = null;

  const res = {
    set statusCode(value) {
      statusCode = Number(value);
    },
    get statusCode() {
      return statusCode;
    },
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), String(value));
    },
    status(code) {
      statusCode = code;
      return {
        json(payload) {
          ended = true;
          body = payload;
          return res;
        },
      };
    },
    end(payload) {
      ended = true;
      body = payload ? JSON.parse(String(payload)) : null;
    },
    get jsonBody() {
      return body;
    },
    get didEnd() {
      return ended;
    },
  };

  return res;
}

function createReq(method, token = null) {
  return {
    method,
    body: {},
    headers: {
      'user-agent': 'store-backup-test',
      'x-forwarded-for': '127.0.0.1',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

async function call(handler, req) {
  const res = createMockRes();
  await handler(req, res);
  assert.equal(res.didEnd, true, 'handler must end response');
  return { status: res.statusCode, body: res.jsonBody };
}

function tokenFor(role) {
  return issueSignedAccessToken({
    email: `${role}@example.com`,
    fullName: `${role} user`,
    organization: 'Nyx Test Health',
    role,
    facility: role === 'enterprise-admin' ? 'all' : 'general-acute-care',
    authMethod: 'password',
  });
}

const enterpriseToken = tokenFor('enterprise-admin');
const facilityAdminToken = tokenFor('facility-admin');
const observerToken = tokenFor('observer');

/* ---- seed a store worth backing up ---- */
const store = await storeModule.getStore();
store.users.push({
  id: 'usr-backup-1',
  fullName: 'Backup One',
  email: 'one@example.com',
  role: 'facilitator',
  facility: 'general-acute-care',
  status: 'active',
  createdAt: new Date().toISOString(),
});
storeModule.appendAuditLog(store, 'pre_backup_marker', {});
await storeModule.saveStore(store);
assert.equal(storeModule.getStoreHealth().mode, 'redis', 'suite must run against the Redis stub');
const usersAtSnapshot = JSON.parse(JSON.stringify(store.users));

/* ---- endpoint role rules ---- */
const unauthPost = await call(backupHandler, createReq('POST'));
assert.equal(unauthPost.status, 401, 'backup POST requires a session');

const facilityPost = await call(backupHandler, createReq('POST', facilityAdminToken));
assert.equal(facilityPost.status, 403, 'facility-admin cannot create backups (enterprise only)');

const observerGet = await call(backupHandler, createReq('GET', observerToken));
assert.equal(observerGet.status, 403, 'observer cannot list backups');

const created = await call(backupHandler, createReq('POST', enterpriseToken));
assert.equal(created.status, 201, 'enterprise-admin can create a backup');
assert.ok(created.body.backup.key.startsWith(storeModule.STORE_BACKUP_PREFIX), 'backup key carries the backup prefix');
assert.ok(created.body.backup.bytes > 0, 'backup reports a nonzero size');
const backupKey = created.body.backup.key;

const listed = await call(backupHandler, createReq('GET', enterpriseToken));
assert.equal(listed.status, 200);
assert.equal(listed.body.backups.length, 1, 'one backup is listed');
assert.equal(listed.body.backups[0].key, backupKey);
assert.equal(listed.body.backups[0].bytes, created.body.backup.bytes, 'listed size matches the created size');

/* ---- health endpoint reports backup status to enterprise admins ---- */
const healthAdmin = await call(storeHealth, createReq('GET', enterpriseToken));
assert.equal(healthAdmin.status, 200);
assert.equal(healthAdmin.body.store.backups.count, 1, 'health reports the backup count');
assert.equal(healthAdmin.body.store.backups.latestAt, created.body.backup.timestamp, 'health reports the latest backup time');

const healthObserver = await call(storeHealth, createReq('GET', observerToken));
assert.equal(healthObserver.status, 200);
assert.equal(healthObserver.body.store.backups, undefined, 'backup details are enterprise-only in health');

/* ---- mutate, inspect, restore: round-trip proof ---- */
const liveStore = await storeModule.getStore();
liveStore.users.push({
  id: 'usr-backup-2',
  fullName: 'Backup Two',
  email: 'two@example.com',
  role: 'observer',
  facility: 'general-acute-care',
  status: 'active',
  createdAt: new Date().toISOString(),
});
storeModule.appendAuditLog(liveStore, 'post_backup_mutation', {});
await storeModule.saveStore(liveStore);
assert.equal((await storeModule.getStore()).users.length, 2, 'mutation landed in the live store');

const inspection = await storeModule.inspectStoreBackup(backupKey);
assert.equal(inspection.counts.users, 1, 'inspection sees the snapshot-time user count');
assert.ok(inspection.bytes > 0);

const restored = await storeModule.restoreStoreFromBackup(backupKey);
assert.ok(restored, 'restore returns the inspection summary');
const reloaded = await storeModule.reloadStore();
assert.equal(reloaded.users.length, 1, 'restore brought back the snapshot-time users');
assert.deepEqual(reloaded.users, usersAtSnapshot, 'restored users are exactly the snapshot users');
assert.equal(reloaded.auditLogs[0]?.action, 'pre_backup_marker', 'restored audit log tops at the snapshot-time entry');
assert.ok(
  !reloaded.auditLogs.some((entry) => entry.action === 'post_backup_mutation'),
  'post-backup mutations are gone after restore',
);

const missingRestore = await storeModule.restoreStoreFromBackup(`${storeModule.STORE_BACKUP_PREFIX}1999-01-01T00:00:00.000Z`);
assert.equal(missingRestore, null, 'restoring a missing backup returns null instead of writing anything');

/* ---- pruning keeps the newest 14 ---- */
for (let index = 0; index < 16; index += 1) {
  await storeModule.createStoreBackup();
}
const afterPrune = await storeModule.listStoreBackups();
assert.equal(afterPrune.length, storeModule.MAX_STORE_BACKUPS, 'backups are pruned to the newest 14');
assert.ok(
  !afterPrune.some((backup) => backup.key === backupKey),
  'the oldest backup was pruned first',
);

/* ---- no Redis configured -> clear 501 (separate process) ---- */
const childScript = [
  `const auth = await import(${JSON.stringify(new URL('../_auth.js', import.meta.url).href)});`,
  `const backup = (await import(${JSON.stringify(new URL('../admin/backup.js', import.meta.url).href)})).default;`,
  'const token = auth.issueSignedAccessToken({ email: "ent@example.com", fullName: "Ent", organization: "Org", role: "enterprise-admin", facility: "all", authMethod: "password" });',
  'let status = 0; let payload = null;',
  'const res = { setHeader() {}, status(code) { status = code; return { json(body) { payload = body; } }; } };',
  'await backup({ method: "POST", body: {}, headers: { authorization: `Bearer ${token}` }, socket: { remoteAddress: "127.0.0.1" } }, res);',
  'console.log(JSON.stringify({ status, error: payload?.error || "" }));',
].join('\n');
const childOutput = execFileSync(process.execPath, ['--input-type=module', '-e', childScript], {
  encoding: 'utf8',
  env: {
    ...process.env,
    UPSTASH_REDIS_REST_URL: '',
    UPSTASH_REDIS_REST_TOKEN: '',
    HICS_STORE_FILE_PATH: path.join(tmpDir, 'child-store.json'),
    TOKEN_SIGNING_SECRET: 'test-signing-secret-for-smoke',
  },
});
const childResult = JSON.parse(childOutput.trim().split('\n').pop());
assert.equal(childResult.status, 501, 'backup POST without Redis configured returns 501');
assert.match(childResult.error, /Redis-backed store/, 'the 501 explains what is missing');

globalThis.fetch = realFetch;
fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('store-backup: PASS');
