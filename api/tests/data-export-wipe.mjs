import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Data export + wipe (the contract-end procedure behind the
// privacy policy's deletion promise).
//
// Proves, against a throwaway file store:
// - export is enterprise-admin only and returns the full store
//   as a download, audit-logged;
// - wipe is enterprise-admin only, demands the literal
//   { confirm: "WIPE" } plus re-authentication shaped by the
//   caller's record (password re-entry for password accounts,
//   email typed back for SSO-only accounts);
// - failed confirmations destroy nothing;
// - a successful wipe preserves ONLY the caller's record and
//   resets every other collection to the initial defaults,
//   with the fresh audit log opening on the wipe entry itself.

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hics-data-wipe-test-'));
process.env.HICS_STORE_FILE_PATH = path.join(tmpDir, 'store.json');
process.env.TOKEN_SIGNING_SECRET = process.env.TOKEN_SIGNING_SECRET || 'test-signing-secret-for-smoke';
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.HICS_BOOTSTRAP_ADMIN_EMAIL;
delete process.env.HICS_BOOTSTRAP_ADMIN_PASSWORD;
delete process.env.HICS_SEED_DEMO;
delete process.env.CUSTOMER_DEPLOYMENT;

const storeModule = await import('../_store.js');
const { hashPassword } = await import('../_passwords.js');
const { issueSignedAccessToken } = await import('../_auth.js');
const { default: dataExport } = await import('../admin/data-export.js');
const { default: dataWipe } = await import('../admin/data-wipe.js');

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
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
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

let ipCounter = 0;
function createReq(method, { token = null, body = {} } = {}) {
  ipCounter += 1;
  return {
    method,
    body,
    headers: {
      'user-agent': 'data-export-wipe-test',
      // Distinct IP per request: the handlers rate-limit per IP
      // and this suite intentionally makes many gated calls.
      'x-forwarded-for': `10.0.0.${ipCounter}`,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

async function call(handler, req) {
  const res = createMockRes();
  await handler(req, res);
  assert.equal(res.didEnd, true, 'handler must end response');
  return { status: res.statusCode, body: res.jsonBody, headers: res };
}

function tokenFor(email, role) {
  return issueSignedAccessToken({
    email,
    fullName: email,
    organization: 'Nyx Test Health',
    role,
    facility: role === 'enterprise-admin' ? 'all' : 'general-acute-care',
    authMethod: 'password',
  });
}

const CALLER_PASSWORD = 'correct horse battery staple';
const callerRecord = {
  id: 'usr-wipe-caller',
  fullName: 'Wipe Caller',
  email: 'wipe.caller@example.com',
  role: 'enterprise-admin',
  facility: 'all',
  organization: 'Nyx Test Health',
  status: 'active',
  createdAt: new Date().toISOString(),
  passwordHash: hashPassword(CALLER_PASSWORD),
};

function seedStore() {
  return storeModule.getStore().then(async (store) => {
    store.users = [
      { ...callerRecord },
      {
        id: 'usr-wipe-facility',
        fullName: 'Facility Admin',
        email: 'facility.admin@example.com',
        role: 'facility-admin',
        facility: 'general-acute-care',
        status: 'active',
        createdAt: new Date().toISOString(),
        passwordHash: hashPassword('facility-password-123'),
      },
      {
        id: 'usr-wipe-observer',
        fullName: 'Observer User',
        email: 'observer@example.com',
        role: 'observer',
        facility: 'general-acute-care',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
    ];
    store.attempts = [{ id: 'att-1', scenarioId: 'scenario-1' }];
    store.leads = [{ id: 'lead-1', email: 'buyer@example.com' }];
    store.contracts = [{ id: 'contract-1', status: 'completed' }];
    store.events = [{ id: 'evt-1' }];
    store.refreshTokens = [{ id: 'rt-1' }];
    store.settings = { aiAssistantEnabled: false };
    storeModule.appendAuditLog(store, 'seed_marker', {});
    await storeModule.saveStore(store);
    return store;
  });
}

await seedStore();

const callerToken = tokenFor('wipe.caller@example.com', 'enterprise-admin');
const facilityToken = tokenFor('facility.admin@example.com', 'facility-admin');

/* ---- export: role gates + content ---- */
const exportUnauth = await call(dataExport, createReq('GET'));
assert.equal(exportUnauth.status, 401, 'export requires a session');

const exportFacility = await call(dataExport, createReq('GET', { token: facilityToken }));
assert.equal(exportFacility.status, 403, 'facility-admin cannot export (enterprise only)');

const exportOk = await call(dataExport, createReq('GET', { token: callerToken }));
assert.equal(exportOk.status, 200, `enterprise-admin can export (got ${exportOk.status})`);
assert.match(
  String(exportOk.headers.getHeader('Content-Disposition') || ''),
  /attachment; filename="nyxhicslab-data-export-\d{4}-\d{2}-\d{2}\.json"/,
  'export is served as a JSON download',
);
assert.equal(exportOk.body.exportedBy, 'wipe.caller@example.com');
assert.equal(exportOk.body.store.users.length, 3, 'export carries the full store');
assert.equal(exportOk.body.store.leads.length, 1, 'export includes leads');
assert.equal(exportOk.body.store.contracts.length, 1, 'export includes contracts');
const storeAfterExport = await storeModule.getStore();
assert.ok(
  storeAfterExport.auditLogs.some(
    (entry) => entry.action === 'store_data_exported' && entry.data?.by === 'wipe.caller@example.com',
  ),
  'export is audit-logged',
);

/* ---- wipe: gates that must destroy nothing ---- */
const wipeFacility = await call(dataWipe, createReq('POST', {
  token: facilityToken,
  body: { confirm: 'WIPE', password: 'facility-password-123' },
}));
assert.equal(wipeFacility.status, 403, 'facility-admin cannot wipe (enterprise only)');

const wipeWrongConfirm = await call(dataWipe, createReq('POST', {
  token: callerToken,
  body: { confirm: 'wipe', password: CALLER_PASSWORD },
}));
assert.equal(wipeWrongConfirm.status, 400, 'lowercase confirm is refused');
assert.match(wipeWrongConfirm.body.error, /WIPE/, 'the refusal names the required confirmation');

const wipeMissingConfirm = await call(dataWipe, createReq('POST', {
  token: callerToken,
  body: { password: CALLER_PASSWORD },
}));
assert.equal(wipeMissingConfirm.status, 400, 'missing confirm is refused');

const wipeWrongPassword = await call(dataWipe, createReq('POST', {
  token: callerToken,
  body: { confirm: 'WIPE', password: 'not the password' },
}));
assert.equal(wipeWrongPassword.status, 403, 'wrong password re-entry is refused');

const storeAfterFailedWipes = await storeModule.getStore();
assert.equal(storeAfterFailedWipes.users.length, 3, 'failed wipes destroy nothing (users)');
assert.equal(storeAfterFailedWipes.attempts.length, 1, 'failed wipes destroy nothing (attempts)');
assert.equal(storeAfterFailedWipes.leads.length, 1, 'failed wipes destroy nothing (leads)');

/* ---- wipe: password caller, success ---- */
const wipeOk = await call(dataWipe, createReq('POST', {
  token: callerToken,
  body: { confirm: 'WIPE', password: CALLER_PASSWORD },
}));
assert.equal(wipeOk.status, 200, `enterprise-admin wipe succeeds (got ${wipeOk.status}: ${JSON.stringify(wipeOk.body)})`);
assert.equal(wipeOk.body.wiped, true);
assert.equal(wipeOk.body.preservedUser, 'wipe.caller@example.com');
assert.equal(wipeOk.body.destroyed.users, 2, 'wipe reports the destroyed user count');

const wipedStore = await storeModule.reloadStore();
assert.equal(wipedStore.users.length, 1, 'only the caller survives the wipe');
assert.equal(wipedStore.users[0].email, 'wipe.caller@example.com');
assert.equal(wipedStore.users[0].passwordHash, callerRecord.passwordHash, 'the preserved record is intact, credential included');
assert.deepEqual(wipedStore.attempts, [], 'attempts reset to defaults');
assert.deepEqual(wipedStore.leads, [], 'leads reset to defaults');
assert.deepEqual(wipedStore.contracts, [], 'contracts reset to defaults');
assert.deepEqual(wipedStore.events, [], 'events reset to defaults');
assert.deepEqual(wipedStore.refreshTokens, [], 'sessions reset to defaults');
assert.deepEqual(wipedStore.progress, {}, 'progress reset to defaults');
assert.deepEqual(wipedStore.settings, { aiAssistantEnabled: true }, 'settings reset to defaults');
assert.equal(wipedStore.auditLogs.length, 1, 'the post-wipe audit log opens with exactly the wipe entry');
assert.equal(wipedStore.auditLogs[0].action, 'store_data_wiped');
assert.equal(wipedStore.auditLogs[0].data.by, 'wipe.caller@example.com');
assert.equal(wipedStore.auditLogs[0].data.preservedUser, 'wipe.caller@example.com');

/* ---- wipe: SSO-only caller confirms with their email ---- */
const ssoCaller = {
  id: 'usr-wipe-sso',
  fullName: 'SSO Caller',
  email: 'sso.caller@example.com',
  role: 'enterprise-admin',
  facility: 'all',
  organization: 'Nyx Test Health',
  status: 'active',
  createdAt: new Date().toISOString(),
  ssoProvider: 'google',
};
const reseedStore = await storeModule.getStore();
reseedStore.users.push(ssoCaller, {
  id: 'usr-wipe-extra',
  fullName: 'Extra User',
  email: 'extra@example.com',
  role: 'observer',
  facility: 'general-acute-care',
  status: 'active',
  createdAt: new Date().toISOString(),
});
reseedStore.leads = [{ id: 'lead-2', email: 'buyer2@example.com' }];
await storeModule.saveStore(reseedStore);

const ssoToken = tokenFor('sso.caller@example.com', 'enterprise-admin');

const ssoWipeWrongEmail = await call(dataWipe, createReq('POST', {
  token: ssoToken,
  body: { confirm: 'WIPE', confirmEmail: 'someone.else@example.com' },
}));
assert.equal(ssoWipeWrongEmail.status, 400, 'SSO caller typing a different email is refused');
const storeAfterSsoFailure = await storeModule.getStore();
assert.equal(storeAfterSsoFailure.users.length, 3, 'failed SSO wipe destroys nothing');

const ssoWipeOk = await call(dataWipe, createReq('POST', {
  token: ssoToken,
  body: { confirm: 'WIPE', confirmEmail: 'sso.caller@example.com' },
}));
assert.equal(ssoWipeOk.status, 200, `SSO-only caller wipes with email confirmation (got ${ssoWipeOk.status}: ${JSON.stringify(ssoWipeOk.body)})`);
const ssoWipedStore = await storeModule.reloadStore();
assert.equal(ssoWipedStore.users.length, 1, 'SSO wipe preserves only the SSO caller');
assert.equal(ssoWipedStore.users[0].email, 'sso.caller@example.com');
assert.deepEqual(ssoWipedStore.leads, [], 'SSO wipe resets leads');
assert.equal(ssoWipedStore.auditLogs[0].action, 'store_data_wiped');
assert.equal(ssoWipedStore.auditLogs[0].data.by, 'sso.caller@example.com');

/* ---- export still works on the wiped store ---- */
const exportAfterWipe = await call(dataExport, createReq('GET', { token: ssoToken }));
assert.equal(exportAfterWipe.status, 200, 'export works after a wipe');
assert.equal(exportAfterWipe.body.store.users.length, 1, 'post-wipe export shows only the preserved caller');

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('data-export-wipe: PASS');
