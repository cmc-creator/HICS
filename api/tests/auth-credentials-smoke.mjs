import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolated environment for this suite: its own store file, email
// deliberately NOT configured, bootstrap admin configured, demo
// seeding off. Must be set before importing any api module because
// api/_store.js reads HICS_STORE_FILE_PATH at module load.
const STORE_FILE = path.join(process.cwd(), '.nyx-hics-store-credentials-smoke.json');
fs.rmSync(STORE_FILE, { force: true });
fs.rmSync(path.join(os.tmpdir(), 'nyx-hics-store.json'), { force: true });

process.env.TOKEN_SIGNING_SECRET = process.env.TOKEN_SIGNING_SECRET || 'test-signing-secret-for-smoke';
process.env.ALLOW_LOCAL_AUTH_FALLBACK = 'true';
process.env.DEFAULT_ORGANIZATION_NAME = 'Nyx Test Health';
process.env.DEFAULT_USER_FACILITY = 'psychiatric-inpatient';
process.env.HICS_STORE_FILE_PATH = STORE_FILE;
process.env.HICS_BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com';
process.env.HICS_BOOTSTRAP_ADMIN_PASSWORD = 'BootstrapPass123';
delete process.env.HICS_SEED_DEMO;
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_FROM_EMAIL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const { hashPassword, verifyPassword, createPasswordToken } = await import('../_passwords.js');
const { getStore, saveStore } = await import('../_store.js');
const { default: localLogin } = await import('../auth/local-login.js');
const { default: forgotPassword } = await import('../auth/forgot-password.js');
const { default: resetPassword } = await import('../auth/reset-password.js');

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
      'user-agent': 'auth-credentials-smoke-test',
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

function findUser(store, email) {
  return store.users.find((candidate) => String(candidate.email || '').toLowerCase() === email);
}

/* ---- password hashing ---- */
const hash = hashPassword('CorrectHorseBattery1');
assert.equal(typeof hash, 'string');
assert.ok(hash.startsWith('scrypt$'), 'hash carries the scrypt format prefix');
assert.equal(verifyPassword('CorrectHorseBattery1', hash), true, 'correct password verifies');
assert.equal(verifyPassword('WrongPassword999', hash), false, 'wrong password is rejected');
assert.equal(verifyPassword('CorrectHorseBattery1', 'not-a-real-hash'), false, 'malformed hash is rejected');
assert.equal(verifyPassword('CorrectHorseBattery1', ''), false, 'empty hash is rejected');
assert.notEqual(hashPassword('CorrectHorseBattery1'), hash, 'salts differ between hashes');

/* ---- seed cleanup + bootstrap admin ---- */
const store = await getStore();
assert.equal(findUser(store, 'alex.rivera@northcampus.org'), undefined, 'demo seed user Alex Rivera absent by default');
assert.equal(findUser(store, 'jamie.patel@northcampus.org'), undefined, 'demo seed user Jamie Patel absent by default');

const bootstrap = findUser(store, 'admin@example.com');
assert.ok(bootstrap, 'bootstrap admin was created on store load');
assert.equal(bootstrap.role, 'enterprise-admin');
assert.equal(bootstrap.facility, 'all');
assert.equal(bootstrap.status, 'active');
assert.ok(bootstrap.passwordHash, 'bootstrap admin has a password hash');

await getStore();
assert.equal(
  store.users.filter((candidate) => String(candidate.email || '').toLowerCase() === 'admin@example.com').length,
  1,
  'bootstrap admin is created exactly once',
);

const bootstrapLogin = await call(localLogin, createBaseReq('POST', {
  email: 'admin@example.com',
  password: 'BootstrapPass123',
}));
assert.equal(bootstrapLogin.status, 200, 'bootstrap admin can log in');
assert.equal(bootstrapLogin.body.role, 'enterprise-admin', 'login claims come from the user record');
assert.equal(bootstrapLogin.body.facility, 'all');

/* ---- real credential login ---- */
store.users.push({
  id: 'usr-test-casey',
  fullName: 'Casey Nurse',
  email: 'casey@example.com',
  role: 'facilitator',
  facility: 'community-hospital',
  organization: 'Nyx Test Health',
  status: 'active',
  createdAt: new Date().toISOString(),
  passwordHash: hashPassword('CorrectHorseBattery1'),
});
store.users.push({
  id: 'usr-test-suspended',
  fullName: 'Sam Suspended',
  email: 'sam@example.com',
  role: 'facilitator',
  facility: 'community-hospital',
  organization: 'Nyx Test Health',
  status: 'suspended',
  createdAt: new Date().toISOString(),
  passwordHash: hashPassword('CorrectHorseBattery1'),
});
store.users.push({
  id: 'usr-test-passwordless',
  fullName: 'Pat Passwordless',
  email: 'pat@example.com',
  role: 'facilitator',
  facility: 'community-hospital',
  organization: 'Nyx Test Health',
  status: 'active',
  createdAt: new Date().toISOString(),
});
await saveStore(store);

const goodLogin = await call(localLogin, createBaseReq('POST', {
  email: 'Casey@Example.com',
  password: 'CorrectHorseBattery1',
}));
assert.equal(goodLogin.status, 200, 'store user with correct password can log in');
assert.equal(goodLogin.body.fullName, 'Casey Nurse', 'fullName claim comes from the user record');
assert.equal(goodLogin.body.role, 'facilitator', 'role claim comes from the user record');
assert.equal(goodLogin.body.facility, 'community-hospital', 'facility claim comes from the user record');
assert.equal(typeof goodLogin.body.accessToken, 'string');
assert.equal(typeof goodLogin.body.refreshToken, 'string');

const wrongPassword = await call(localLogin, createBaseReq('POST', {
  email: 'casey@example.com',
  password: 'WrongPassword999',
}));
assert.equal(wrongPassword.status, 401, 'wrong password is rejected');
assert.equal(wrongPassword.body.error, 'Invalid email or password.');

const unknownEmail = await call(localLogin, createBaseReq('POST', {
  email: 'nobody@example.com',
  password: 'CorrectHorseBattery1',
}));
assert.equal(unknownEmail.status, 401, 'unknown email is rejected');
assert.equal(unknownEmail.body.error, wrongPassword.body.error, 'unknown email gets the identical generic error');

const inactiveLogin = await call(localLogin, createBaseReq('POST', {
  email: 'sam@example.com',
  password: 'CorrectHorseBattery1',
}));
assert.equal(inactiveLogin.status, 401, 'inactive user is rejected');
assert.equal(inactiveLogin.body.error, 'Invalid email or password.');

const passwordlessLogin = await call(localLogin, createBaseReq('POST', {
  email: 'pat@example.com',
  password: 'CorrectHorseBattery1',
}));
assert.equal(passwordlessLogin.status, 401, 'user without a passwordHash is rejected');
assert.equal(passwordlessLogin.body.error, 'Invalid email or password.');

/* ---- forgot password ---- */
const forgotKnown = await call(forgotPassword, createBaseReq('POST', {
  email: 'casey@example.com',
}));
assert.equal(forgotKnown.status, 200, 'forgot-password returns 200 for a known email (email unconfigured)');

const caseyAfterForgot = findUser(store, 'casey@example.com');
assert.match(caseyAfterForgot.passwordTokenHash || '', /^[a-f0-9]{64}$/, 'forgot-password stores a sha256 token hash');
const forgotExpiry = new Date(caseyAfterForgot.passwordTokenExpiresAt).getTime();
assert.ok(forgotExpiry > Date.now() && forgotExpiry <= Date.now() + 61 * 60 * 1000, 'forgot-password token expires in about 1 hour');
assert.ok(
  store.notifications.some((entry) => entry.type === 'email_not_configured'),
  'unconfigured email is recorded as an email_not_configured notification',
);

const userCountBefore = store.users.length;
const forgotUnknown = await call(forgotPassword, createBaseReq('POST', {
  email: 'ghost@example.com',
}));
assert.equal(forgotUnknown.status, 200, 'forgot-password returns the same 200 for an unknown email');
assert.equal(store.users.length, userCountBefore, 'forgot-password for an unknown email creates nothing');

/* ---- reset password ---- */
const casey = findUser(store, 'casey@example.com');
const rawToken = createPasswordToken(store, casey);
await saveStore(store);

const shortPassword = await call(resetPassword, createBaseReq('POST', {
  token: rawToken,
  password: 'short',
}));
assert.equal(shortPassword.status, 400, 'reset-password rejects passwords under 10 characters');

const resetOk = await call(resetPassword, createBaseReq('POST', {
  token: rawToken,
  password: 'BrandNewPassword99',
}));
assert.equal(resetOk.status, 200, 'reset-password accepts a valid token');
assert.equal(casey.passwordTokenHash, undefined, 'token hash is cleared after a successful reset');
assert.equal(casey.passwordTokenExpiresAt, undefined, 'token expiry is cleared after a successful reset');

const newLogin = await call(localLogin, createBaseReq('POST', {
  email: 'casey@example.com',
  password: 'BrandNewPassword99',
}));
assert.equal(newLogin.status, 200, 'the reset password works for login');

const oldLogin = await call(localLogin, createBaseReq('POST', {
  email: 'casey@example.com',
  password: 'CorrectHorseBattery1',
}));
assert.equal(oldLogin.status, 401, 'the old password no longer works after reset');

const tokenReuse = await call(resetPassword, createBaseReq('POST', {
  token: rawToken,
  password: 'AnotherPassword111',
}));
assert.equal(tokenReuse.status, 400, 'a used token cannot be reused');

const expiredToken = createPasswordToken(store, casey);
casey.passwordTokenExpiresAt = new Date(Date.now() - 60 * 1000).toISOString();
await saveStore(store);
const expiredReset = await call(resetPassword, createBaseReq('POST', {
  token: expiredToken,
  password: 'AnotherPassword111',
}));
assert.equal(expiredReset.status, 400, 'an expired token is rejected');

const bogusReset = await call(resetPassword, createBaseReq('POST', {
  token: 'f'.repeat(64),
  password: 'AnotherPassword111',
}));
assert.equal(bogusReset.status, 400, 'an unknown token is rejected');

/* ---- demo seeding opt-in (separate process, separate store) ---- */
const seedStoreFile = path.join(process.cwd(), '.nyx-hics-store-seed-smoke.json');
fs.rmSync(seedStoreFile, { force: true });
const storeModuleUrl = new URL('../_store.js', import.meta.url).href;
const seedScript = [
  `const m = await import(${JSON.stringify(storeModuleUrl)});`,
  'const s = await m.getStore();',
  'console.log(JSON.stringify(s.users.map((u) => u.email)));',
].join('\n');
const seedOutput = execFileSync(process.execPath, ['--input-type=module', '-e', seedScript], {
  encoding: 'utf8',
  env: {
    ...process.env,
    HICS_SEED_DEMO: 'true',
    HICS_STORE_FILE_PATH: seedStoreFile,
    HICS_BOOTSTRAP_ADMIN_EMAIL: '',
    HICS_BOOTSTRAP_ADMIN_PASSWORD: '',
  },
});
const seededEmails = JSON.parse(seedOutput.trim());
assert.ok(seededEmails.includes('alex.rivera@northcampus.org'), 'HICS_SEED_DEMO=true seeds Alex Rivera');
assert.ok(seededEmails.includes('jamie.patel@northcampus.org'), 'HICS_SEED_DEMO=true seeds Jamie Patel');
fs.rmSync(seedStoreFile, { force: true });

fs.rmSync(STORE_FILE, { force: true });

console.log('auth-credentials-smoke: PASS');
