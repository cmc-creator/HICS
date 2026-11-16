import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Per-facility AI assistant off-switch (sales readiness pass):
//   - GET /api/admin/settings readable by any signed-in role
//   - PUT writable only by enterprise-admin / facility-admin
//   - /api/chat refuses with 403 BEFORE any provider call when the
//     setting is off, and answers normally when it is on
//
// Isolated environment, set before importing any api module.
const STORE_FILE = path.join(process.cwd(), '.nyx-hics-store-settings-smoke.json');
fs.rmSync(STORE_FILE, { force: true });
fs.rmSync(path.join(os.tmpdir(), 'nyx-hics-store.json'), { force: true });

process.env.TOKEN_SIGNING_SECRET = process.env.TOKEN_SIGNING_SECRET || 'test-signing-secret-for-smoke';
process.env.DEFAULT_ORGANIZATION_NAME = 'Nyx Test Health';
process.env.DEFAULT_USER_FACILITY = 'psychiatric-inpatient';
process.env.HICS_STORE_FILE_PATH = STORE_FILE;
process.env.HICS_BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com';
process.env.HICS_BOOTSTRAP_ADMIN_PASSWORD = 'BootstrapPass123';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
delete process.env.GEMINI_API_KEY;
delete process.env.HICS_SEED_DEMO;
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_FROM_EMAIL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

// Stub the Anthropic endpoint and count every call: the disabled
// path must be proven to make NO provider call at all.
let anthropicCalls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (String(url).includes('api.anthropic.com')) {
    anthropicCalls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'text', text: 'Stub assistant reply' }] }),
      text: async () => '',
    };
  }
  throw new Error(`Unexpected fetch in test: ${url}`);
};

const { default: settings } = await import('../admin/settings.js');
const { default: chat } = await import('../chat.js');
const { issueSignedAccessToken } = await import('../_auth.js');
const { getStore, reloadStore } = await import('../_store.js');

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

function createReq(method, body = {}, token = null) {
  return {
    method,
    body,
    headers: {
      'user-agent': 'settings-ai-toggle-test',
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

const observerToken = tokenFor('observer');
const facilitatorToken = tokenFor('facilitator');
const facilityAdminToken = tokenFor('facility-admin');
const enterpriseAdminToken = tokenFor('enterprise-admin');

/* ---- settings reads ---- */
const unauthGet = await call(settings, createReq('GET'));
assert.equal(unauthGet.status, 401, 'settings GET requires a session');

const defaultGet = await call(settings, createReq('GET', {}, observerToken));
assert.equal(defaultGet.status, 200, 'any signed-in role may read settings');
assert.equal(defaultGet.body.aiAssistantEnabled, true, 'AI assistant defaults to enabled');

/* ---- chat works while enabled ---- */
const chatOn = await call(chat, createReq('POST', { message: 'What is HICS?' }, observerToken));
assert.equal(chatOn.status, 200, 'chat answers while the assistant is enabled');
assert.equal(chatOn.body.reply, 'Stub assistant reply');
assert.equal(chatOn.body.provider, 'anthropic');
assert.equal(anthropicCalls, 1, 'enabled chat made exactly one provider call');

/* ---- writes are admin-only ---- */
const observerPut = await call(settings, createReq('PUT', { aiAssistantEnabled: false }, observerToken));
assert.equal(observerPut.status, 403, 'observer cannot change the setting');

const facilitatorPut = await call(settings, createReq('PUT', { aiAssistantEnabled: false }, facilitatorToken));
assert.equal(facilitatorPut.status, 403, 'facilitator cannot change the setting');

const badPut = await call(settings, createReq('PUT', { aiAssistantEnabled: 'yes' }, facilityAdminToken));
assert.equal(badPut.status, 400, 'non-boolean setting value is rejected');

const stillOn = await call(settings, createReq('GET', {}, observerToken));
assert.equal(stillOn.body.aiAssistantEnabled, true, 'failed writes did not change the setting');

/* ---- turning it off blocks chat before any provider call ---- */
const putOff = await call(settings, createReq('PUT', { aiAssistantEnabled: false }, facilityAdminToken));
assert.equal(putOff.status, 200, 'facility-admin can disable the assistant');
assert.equal(putOff.body.aiAssistantEnabled, false);

const getOff = await call(settings, createReq('GET', {}, observerToken));
assert.equal(getOff.body.aiAssistantEnabled, false, 'the disabled state is readable by all roles');

const chatOff = await call(chat, createReq('POST', { message: 'What is HICS?' }, observerToken));
assert.equal(chatOff.status, 403, 'chat refuses while the assistant is disabled');
assert.equal(chatOff.body.error, 'The AI assistant is disabled for this facility');
assert.equal(anthropicCalls, 1, 'disabled chat made NO provider call');

const storeAfterToggle = await reloadStore();
assert.equal(storeAfterToggle.settings.aiAssistantEnabled, false, 'the setting persisted to the store');
assert.ok(
  storeAfterToggle.auditLogs.some((entry) => entry.action === 'settings_ai_assistant_toggled'),
  'the toggle was audit-logged',
);

/* ---- turning it back on restores chat ---- */
const putOn = await call(settings, createReq('PUT', { aiAssistantEnabled: true }, enterpriseAdminToken));
assert.equal(putOn.status, 200, 'enterprise-admin can re-enable the assistant');
assert.equal(putOn.body.aiAssistantEnabled, true);

const chatBackOn = await call(chat, createReq('POST', { message: 'What is HICS?' }, observerToken));
assert.equal(chatBackOn.status, 200, 'chat answers again after re-enable');
assert.equal(anthropicCalls, 2, 're-enabled chat calls the provider again');

globalThis.fetch = realFetch;
fs.rmSync(STORE_FILE, { force: true });

console.log('settings-ai-toggle: PASS');
