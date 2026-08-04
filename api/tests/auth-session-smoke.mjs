import assert from 'node:assert/strict';

process.env.TOKEN_SIGNING_SECRET = process.env.TOKEN_SIGNING_SECRET || 'test-signing-secret-for-smoke';
process.env.ALLOW_LOCAL_AUTH_FALLBACK = 'true';
process.env.DEFAULT_ORGANIZATION_NAME = 'Nyx Test Health';
process.env.DEFAULT_USER_FACILITY = 'psychiatric-inpatient';
process.env.HICS_STORE_FILE_PATH = process.env.HICS_STORE_FILE_PATH || `${process.cwd()}/.nyx-hics-store-auth-smoke.json`;

const { default: localLogin } = await import('../auth/local-login.js');
const { default: refresh } = await import('../auth/refresh.js');
const { default: logout } = await import('../auth/logout.js');

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

function createBaseReq(method, body = {}) {
  return {
    method,
    body,
    headers: {
      'user-agent': 'auth-session-smoke-test',
      'x-forwarded-for': '127.0.0.1',
    },
    socket: {
      remoteAddress: '127.0.0.1',
    },
  };
}

async function call(handler, req) {
  const res = createMockRes();
  await handler(req, res);
  assert.equal(res.didEnd, true, 'handler must end response');
  return {
    status: res.statusCode,
    body: res.jsonBody,
  };
}

const loginResponse = await call(localLogin, createBaseReq('POST', {
  email: 'training.manager@example.com',
  password: 'VeryStrongPassword123',
  organization: 'Nyx Test Health',
}));
assert.equal(loginResponse.status, 200, 'local login should succeed');
assert.equal(typeof loginResponse.body.accessToken, 'string');
assert.equal(typeof loginResponse.body.refreshToken, 'string');

const firstRefreshToken = loginResponse.body.refreshToken;

const refreshResponse = await call(refresh, createBaseReq('POST', {
  refreshToken: firstRefreshToken,
}));
assert.equal(refreshResponse.status, 200, 'refresh should rotate session');
assert.equal(typeof refreshResponse.body.accessToken, 'string');
assert.equal(typeof refreshResponse.body.refreshToken, 'string');
assert.notEqual(refreshResponse.body.refreshToken, firstRefreshToken, 'refresh token should rotate');

const replayResponse = await call(refresh, createBaseReq('POST', {
  refreshToken: firstRefreshToken,
}));
assert.equal(replayResponse.status, 401, 'replay of rotated token should fail');
assert.equal(replayResponse.body.code, 'refresh_replay_detected');

const familyRevokedResponse = await call(refresh, createBaseReq('POST', {
  refreshToken: refreshResponse.body.refreshToken,
}));
assert.equal(familyRevokedResponse.status, 401, 'token family should be revoked after replay detection');

const logoutResponse = await call(logout, createBaseReq('POST', {
  refreshToken: refreshResponse.body.refreshToken,
}));
assert.equal(logoutResponse.status, 200, 'logout should return success');

console.log('auth-session-smoke: PASS');
