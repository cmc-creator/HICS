import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Opt-in MFA for password accounts (sales readiness pass):
//   1. TOTP verified against the RFC 6238 Appendix B test vectors
//   2. enroll -> confirm -> login challenge -> verify flow
//   3. recovery codes work exactly once
//   4. enrollment stays strictly opt-in: users without MFA
//      (including the bootstrap admin) sign in exactly as before,
//      and SSO-only accounts cannot enroll
//
// Isolated environment, set before importing any api module.
const STORE_FILE = path.join(process.cwd(), '.nyx-hics-store-mfa-smoke.json');
fs.rmSync(STORE_FILE, { force: true });
fs.rmSync(path.join(os.tmpdir(), 'nyx-hics-store.json'), { force: true });

process.env.TOKEN_SIGNING_SECRET = process.env.TOKEN_SIGNING_SECRET || 'test-signing-secret-for-smoke';
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

const mfa = await import('../_mfa.js');
const { hashPassword } = await import('../_passwords.js');
const { getStore, saveStore } = await import('../_store.js');
const { default: localLogin } = await import('../auth/local-login.js');
const { default: mfaStatus } = await import('../auth/mfa/status.js');
const { default: mfaEnroll } = await import('../auth/mfa/enroll.js');
const { default: mfaConfirm } = await import('../auth/mfa/confirm.js');
const { default: mfaDisable } = await import('../auth/mfa/disable.js');
const { default: mfaVerify } = await import('../auth/mfa/verify.js');

/* ---- 1. RFC 6238 test vectors (Appendix B, SHA-1) ----
   The RFC secret is the ASCII string "12345678901234567890". */
const RFC_SECRET_ASCII = '12345678901234567890';
const rfcSecretBase32 = mfa.base32Encode(Buffer.from(RFC_SECRET_ASCII, 'utf8'));
assert.equal(rfcSecretBase32, 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 'base32 of the RFC secret');
assert.equal(mfa.base32Decode(rfcSecretBase32).toString('utf8'), RFC_SECRET_ASCII, 'base32 round-trips');

const RFC_VECTORS = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  // SHA-1 column; the RFC table's SHA-256 column shows 35313082
  // for this row. Cross-checked against Python's hmac/hashlib.
  [20000000000, '65353130'],
];
for (const [seconds, expected] of RFC_VECTORS) {
  assert.equal(mfa.totp(rfcSecretBase32, seconds * 1000, 8), expected, `RFC 6238 vector T=${seconds}`);
  assert.equal(mfa.totp(rfcSecretBase32, seconds * 1000, 6), expected.slice(-6), `RFC 6238 vector T=${seconds} at 6 digits`);
  assert.equal(mfa.verifyTotp(rfcSecretBase32, expected.slice(-6), seconds * 1000), true, `verifyTotp accepts T=${seconds}`);
}
assert.equal(mfa.verifyTotp(rfcSecretBase32, '000000', 59 * 1000), false, 'a wrong code is rejected');

/* ---- secret encryption at rest ---- */
const someSecret = mfa.generateTotpSecret();
const encrypted = mfa.encryptTotpSecret(someSecret);
assert.ok(encrypted && encrypted.startsWith('gcm$'), 'secret encrypts with the gcm format');
assert.ok(!encrypted.includes(someSecret), 'ciphertext does not contain the plaintext secret');
assert.equal(mfa.decryptTotpSecret(encrypted), someSecret, 'secret decrypts back');
assert.equal(mfa.decryptTotpSecret('gcm$zz$zz$zz'), null, 'garbage ciphertext decrypts to null');
assert.equal(mfa.decryptTotpSecret(''), null, 'empty ciphertext decrypts to null');

/* ---- harness ---- */
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
      'user-agent': 'auth-mfa-test',
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

function findUser(store, email) {
  return store.users.find((candidate) => String(candidate.email || '').toLowerCase() === email);
}

function wrongCodeFor(secret) {
  for (const candidate of ['000000', '111111', '222222', '999999', '123456']) {
    if (!mfa.verifyTotp(secret, candidate)) {
      return candidate;
    }
  }
  throw new Error('could not find a wrong code');
}

async function login(email, password) {
  return call(localLogin, createReq('POST', { email, password }));
}

/* ---- seed users ---- */
const store = await getStore();
store.users.push({
  id: 'usr-mfa-casey',
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
  id: 'usr-mfa-sso',
  fullName: 'Sam SSO',
  email: 'sam@example.com',
  role: 'observer',
  facility: 'community-hospital',
  organization: 'Nyx Test Health',
  status: 'active',
  createdAt: new Date().toISOString(),
  ssoProvider: 'google',
});
await saveStore(store);

/* ---- before enrollment: sign-in is untouched (strictly opt-in) ---- */
const plainLogin = await login('casey@example.com', 'CorrectHorseBattery1');
assert.equal(plainLogin.status, 200, 'login works before MFA exists');
assert.equal(typeof plainLogin.body.accessToken, 'string', 'no-MFA login issues a session directly');
const caseyToken = plainLogin.body.accessToken;

const statusBefore = await call(mfaStatus, createReq('GET', {}, caseyToken));
assert.equal(statusBefore.status, 200);
assert.equal(statusBefore.body.mfaEnabled, false);
assert.equal(statusBefore.body.canEnroll, true, 'password accounts can enroll');

const unauthStatus = await call(mfaStatus, createReq('GET'));
assert.equal(unauthStatus.status, 401, 'MFA status requires a session');

/* ---- enrollment ---- */
const enroll = await call(mfaEnroll, createReq('POST', {}, caseyToken));
assert.equal(enroll.status, 200, 'enrollment starts');
assert.equal(typeof enroll.body.secret, 'string');
assert.ok(enroll.body.otpauthUri.startsWith('otpauth://totp/'), 'enrollment returns an otpauth URI');
const caseySecret = enroll.body.secret;

const pendingLogin = await login('casey@example.com', 'CorrectHorseBattery1');
assert.equal(typeof pendingLogin.body.accessToken, 'string', 'a pending (unconfirmed) enrollment does NOT enforce MFA');

const confirmWrong = await call(mfaConfirm, createReq('POST', { code: wrongCodeFor(caseySecret) }, caseyToken));
assert.equal(confirmWrong.status, 400, 'confirm rejects a wrong code');

const confirm = await call(mfaConfirm, createReq('POST', { code: mfa.totp(caseySecret) }, caseyToken));
assert.equal(confirm.status, 200, 'confirm accepts the correct code');
assert.equal(confirm.body.mfaEnabled, true);
assert.equal(confirm.body.recoveryCodes.length, 8, 'confirm returns 8 recovery codes');
for (const code of confirm.body.recoveryCodes) {
  assert.match(code, /^[A-F0-9]{5}-[A-F0-9]{5}$/, 'recovery codes carry the expected format');
}
const recoveryCodes = confirm.body.recoveryCodes;

const caseyRecord = findUser(await getStore(), 'casey@example.com');
assert.equal(caseyRecord.mfa.enabled, true);
assert.equal(caseyRecord.mfa.recoveryCodeHashes.length, 8, 'recovery code hashes are stored');
assert.ok(!JSON.stringify(caseyRecord.mfa).includes(caseySecret), 'the plaintext TOTP secret is never stored');
assert.equal(caseyRecord.mfaPending, undefined, 'the pending enrollment is cleared after confirm');

const statusAfter = await call(mfaStatus, createReq('GET', {}, caseyToken));
assert.equal(statusAfter.body.mfaEnabled, true);

/* ---- login now challenges ---- */
const challenged = await login('casey@example.com', 'CorrectHorseBattery1');
assert.equal(challenged.status, 200, 'password still verifies first');
assert.equal(challenged.body.mfaRequired, true, 'MFA-enabled login returns a challenge instead of a session');
assert.equal(challenged.body.accessToken, undefined, 'no access token is issued before the second factor');
assert.ok(challenged.body.challengeToken.startsWith('mfa.'), 'challenge token carries the mfa prefix');
const challengeToken = challenged.body.challengeToken;

// A challenge token must not work as an access token anywhere.
const challengeAsBearer = await call(mfaStatus, createReq('GET', {}, challengeToken));
assert.equal(challengeAsBearer.status, 401, 'a challenge token is not an access token');

const verifyWrong = await call(mfaVerify, createReq('POST', { challengeToken, code: wrongCodeFor(caseySecret) }));
assert.equal(verifyWrong.status, 401, 'verify rejects a wrong code');

const verifyTotp = await call(mfaVerify, createReq('POST', { challengeToken, code: mfa.totp(caseySecret) }));
assert.equal(verifyTotp.status, 200, 'verify accepts a TOTP code');
assert.equal(typeof verifyTotp.body.accessToken, 'string', 'verify issues the real session');
assert.equal(verifyTotp.body.role, 'facilitator', 'session claims come from the user record');
assert.equal(typeof verifyTotp.body.refreshToken, 'string');

/* ---- recovery codes: single-use ---- */
const challenge2 = await login('casey@example.com', 'CorrectHorseBattery1');
const verifyRecovery = await call(mfaVerify, createReq('POST', {
  challengeToken: challenge2.body.challengeToken,
  code: recoveryCodes[0],
}));
assert.equal(verifyRecovery.status, 200, 'a recovery code completes sign-in');

const challenge3 = await login('casey@example.com', 'CorrectHorseBattery1');
const verifyRecoveryReuse = await call(mfaVerify, createReq('POST', {
  challengeToken: challenge3.body.challengeToken,
  code: recoveryCodes[0],
}));
assert.equal(verifyRecoveryReuse.status, 401, 'the same recovery code cannot be used twice');

const verifyRecovery2 = await call(mfaVerify, createReq('POST', {
  challengeToken: challenge3.body.challengeToken,
  code: recoveryCodes[1].toLowerCase(),
}));
assert.equal(verifyRecovery2.status, 200, 'a second recovery code works (case-insensitive)');

/* ---- tampered / garbage challenges ---- */
const tampered = `${challengeToken.slice(0, -3)}xyz`;
const verifyTampered = await call(mfaVerify, createReq('POST', { challengeToken: tampered, code: mfa.totp(caseySecret) }));
assert.equal(verifyTampered.status, 401, 'a tampered challenge token is rejected');

/* ---- disable requires a code, then sign-in is direct again ---- */
const disableWrong = await call(mfaDisable, createReq('POST', { code: wrongCodeFor(caseySecret) }, caseyToken));
assert.equal(disableWrong.status, 401, 'disable rejects a wrong code');

const disable = await call(mfaDisable, createReq('POST', { code: mfa.totp(caseySecret) }, caseyToken));
assert.equal(disable.status, 200, 'disable accepts a valid code');
assert.equal(disable.body.mfaEnabled, false);

const statusDisabled = await call(mfaStatus, createReq('GET', {}, caseyToken));
assert.equal(statusDisabled.body.mfaEnabled, false);

const directLogin = await login('casey@example.com', 'CorrectHorseBattery1');
assert.equal(typeof directLogin.body.accessToken, 'string', 'after disable, login is direct again');

/* ---- SSO-only accounts cannot enroll ---- */
const { issueSignedAccessToken } = await import('../_auth.js');
const samToken = issueSignedAccessToken({
  email: 'sam@example.com',
  fullName: 'Sam SSO',
  organization: 'Nyx Test Health',
  role: 'observer',
  facility: 'community-hospital',
  authMethod: 'google-oidc',
});
const samStatus = await call(mfaStatus, createReq('GET', {}, samToken));
assert.equal(samStatus.body.canEnroll, false, 'SSO-only accounts cannot enroll');
const samEnroll = await call(mfaEnroll, createReq('POST', {}, samToken));
assert.equal(samEnroll.status, 400, 'enroll refuses SSO-only accounts');

/* ---- bootstrap admin is never forced into MFA ---- */
const bootstrapLogin = await login('admin@example.com', 'BootstrapPass123');
assert.equal(bootstrapLogin.status, 200, 'bootstrap admin still signs in');
assert.equal(typeof bootstrapLogin.body.accessToken, 'string', 'bootstrap admin gets a direct session');

fs.rmSync(STORE_FILE, { force: true });

console.log('auth-mfa: PASS');
