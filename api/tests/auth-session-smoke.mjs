import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const storePath = path.join(os.tmpdir(), `nyx-hics-auth-smoke-${process.pid}.json`);
process.env.TOKEN_SIGNING_SECRET = process.env.TOKEN_SIGNING_SECRET || 'test-signing-secret-for-smoke';
process.env.ALLOW_LOCAL_AUTH_FALLBACK = 'true';
process.env.DEFAULT_ORGANIZATION_NAME = 'Nyx Test Health';
process.env.HICS_STORE_FILE_PATH = storePath;
process.env.ANTHROPIC_API_KEY = '';
process.env.GEMINI_API_KEY = '';
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.VERCEL;

const { updateStore, readStore } = await import('../_store.js');
const { hashPassword } = await import('../_users.js');
const { default: localLogin } = await import('../auth/local-login.js');
const { default: exchange } = await import('../auth/exchange.js');
const { default: refresh } = await import('../auth/refresh.js');
const { default: logout } = await import('../auth/logout.js');
const { default: chat } = await import('../chat.js');
const { default: adminUsers } = await import('../admin/users.js');

const PASSWORD = 'VeryStrongPassword123';

await updateStore((store) => {
  store.users.push(
    {
      id: 'usr-trainer',
      fullName: 'Training Manager',
      email: 'training.manager@example.com',
      role: 'training-manager',
      facility: 'psychiatric-inpatient',
      status: 'active',
      passwordHash: hashPassword(PASSWORD),
    },
    {
      id: 'usr-facility-admin',
      fullName: 'Facility Admin',
      email: 'facility.admin@example.com',
      role: 'facility-admin',
      facility: 'psychiatric-inpatient',
      status: 'active',
      passwordHash: hashPassword(PASSWORD),
    },
  );
});

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
function createReq(method, body = {}, { cookie, token } = {}) {
  ipCounter += 1;
  return {
    method,
    body,
    headers: {
      'user-agent': 'auth-session-smoke-test',
      'x-real-ip': `10.0.0.${ipCounter}`,
      ...(cookie ? { cookie: `nyx_rt=${cookie}` } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    socket: { remoteAddress: '127.0.0.1' },
  };
}

async function call(handler, req) {
  const res = createMockRes();
  await handler(req, res);
  assert.equal(res.didEnd, true, 'handler must end response');
  const setCookie = res.getHeader('set-cookie') || '';
  const cookieValue = /^nyx_rt=([^;]*)/.exec(setCookie)?.[1] ?? null;
  return { status: res.statusCode, body: res.jsonBody, setCookie, cookieValue };
}

// --- Password login checks the stored hash and takes role from the account, not the email.
const wrongPassword = await call(localLogin, createReq('POST', {
  email: 'training.manager@example.com',
  password: 'not-the-password',
}));
assert.equal(wrongPassword.status, 401, 'wrong password must be rejected');

const unknownUser = await call(localLogin, createReq('POST', {
  email: 'it.admin@example.com',
  password: PASSWORD,
}));
assert.equal(unknownUser.status, 401, 'unprovisioned users must be rejected, even with admin-looking emails');

const login = await call(localLogin, createReq('POST', {
  email: 'training.manager@example.com',
  password: PASSWORD,
}));
assert.equal(login.status, 200, 'local login should succeed');
assert.equal(typeof login.body.accessToken, 'string');
assert.equal(login.body.refreshToken, undefined, 'refresh token must not appear in the response body');
assert.equal(login.body.role, 'training-manager');
assert.match(login.setCookie, /HttpOnly/);
assert.match(login.setCookie, /SameSite=Strict/);
assert.ok(login.cookieValue, 'login should set the refresh cookie');

// --- Refresh rotates the cookie; replaying the old one revokes the family.
const firstCookie = login.cookieValue;
const rotated = await call(refresh, createReq('POST', {}, { cookie: firstCookie }));
assert.equal(rotated.status, 200, 'refresh should rotate session');
assert.equal(typeof rotated.body.accessToken, 'string');
assert.ok(rotated.cookieValue && rotated.cookieValue !== firstCookie, 'refresh cookie should rotate');

const staleRace = await call(refresh, createReq('POST', {}, { cookie: firstCookie }));
assert.equal(staleRace.status, 409, 'reuse within the grace window is treated as a tab race');

await updateStore((store) => {
  const rotatedRecord = store.refreshTokens.find((session) => session.revokedReason === 'rotated');
  rotatedRecord.revokedAt = new Date(Date.now() - 60_000).toISOString();
});
const replay = await call(refresh, createReq('POST', {}, { cookie: firstCookie }));
assert.equal(replay.status, 401, 'replay of rotated token should fail');
assert.equal(replay.body.code, 'refresh_replay_detected');

const familyRevoked = await call(refresh, createReq('POST', {}, { cookie: rotated.cookieValue }));
assert.equal(familyRevoked.status, 401, 'token family should be revoked after replay detection');

// --- Deactivated accounts cannot refresh.
const secondLogin = await call(localLogin, createReq('POST', {
  email: 'training.manager@example.com',
  password: PASSWORD,
}));
await updateStore((store) => {
  store.users.find((user) => user.id === 'usr-trainer').status = 'disabled';
});
const inactive = await call(refresh, createReq('POST', {}, { cookie: secondLogin.cookieValue }));
assert.equal(inactive.status, 401, 'disabled accounts must not refresh');
assert.equal(inactive.body.code, 'account_inactive');

const logoutResponse = await call(logout, createReq('POST', {}, { cookie: secondLogin.cookieValue }));
assert.equal(logoutResponse.status, 200, 'logout should return success');
assert.match(logoutResponse.setCookie, /Max-Age=0/, 'logout should clear the cookie');

// --- SSO exchange never invents an identity when the provider isn't configured.
const ssoUnconfigured = await call(exchange, createReq('POST', {
  provider: 'entra',
  code: 'forged-code',
  codeVerifier: 'x'.repeat(64),
  redirectUri: 'https://example.com/auth/callback',
}));
assert.equal(ssoUnconfigured.status, 503, 'unconfigured SSO must fail closed');
assert.equal(ssoUnconfigured.body.accessToken, undefined);

// --- Chat requires a signed-in user.
const anonymousChat = await call(chat, createReq('POST', { message: 'What is HICS?' }));
assert.equal(anonymousChat.status, 401, 'chat must require authentication');

// --- Facility admins cannot mint enterprise admins, and responses never include hashes.
const adminLogin = await call(localLogin, createReq('POST', {
  email: 'facility.admin@example.com',
  password: PASSWORD,
}));
const escalation = await call(adminUsers, createReq('POST', {
  fullName: 'Sneaky Admin',
  email: 'sneaky@example.com',
  role: 'enterprise-admin',
}, { token: adminLogin.body.accessToken }));
assert.equal(escalation.status, 403, 'facility admins must not create enterprise admins');

const invite = await call(adminUsers, createReq('POST', {
  fullName: 'New Facilitator',
  email: 'new.facilitator@example.com',
  role: 'facilitator',
  facility: 'psychiatric-inpatient',
}, { token: adminLogin.body.accessToken }));
assert.equal(invite.status, 201, 'facility admin can invite within scope');
assert.equal(invite.body.user.facility, 'psychiatric-inpatient', 'requested facility must be kept');

const listing = await call(adminUsers, createReq('GET', {}, { token: adminLogin.body.accessToken }));
assert.equal(listing.status, 200);
assert.ok(listing.body.users.every((user) => !('passwordHash' in user)), 'password hashes must never be returned');

// --- Concurrent writes are not lost.
await Promise.all(Array.from({ length: 20 }, (_, index) => updateStore((store) => {
  store.events.push({ id: `concurrent-${index}` });
})));
const finalStore = await readStore();
assert.equal(finalStore.events.filter((event) => String(event.id).startsWith('concurrent-')).length, 20);

fs.rmSync(storePath, { force: true });
console.log('auth-session-smoke: PASS');
