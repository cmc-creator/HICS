import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Invite set-password lifecycle (regression suite for the
// 2026-11-17 production failure):
//
//   An enterprise admin invites a user from Facility Admin. The
//   API creates the user and a 1-hour set-password token and
//   emails the link. The Facility Admin page then immediately
//   writes an 'admin_user_invite_submitted' audit entry through
//   POST /api/audit/logs. When that second request landed on a
//   warm serverless instance whose in-memory store cache predated
//   the invite, the audit handler appended to its stale copy and
//   saved the WHOLE store blob back - wiping the new user and
//   the token within a second of their creation. The emailed link
//   then reported "invalid or has expired" on first use, even
//   though it was only minutes old.
//
//   The forgot/reset handlers were hardened against this class
//   in f727d0a (reload the store before reading/writing); the
//   invite chain - POST /api/admin/users and POST /api/audit/logs -
//   was not. This suite replays the exact two-instance sequence
//   and pins the fixed behavior: every writer in the invite
//   chain reloads first, so the token survives the chained audit
//   write and the invitee can set a password and sign in.
//
// Isolated environment, set before importing any api module.
const STORE_FILE = path.join(process.cwd(), '.nyx-hics-store-invite-smoke.json');
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

const { consumePasswordToken } = await import('../_passwords.js');
const { getStore } = await import('../_store.js');
const { issueSignedAccessToken } = await import('../_auth.js');
const { default: adminUsers } = await import('../admin/users.js');
const { default: auditLogs } = await import('../audit/logs.js');
const { default: resetPassword } = await import('../auth/reset-password.js');
const { default: localLogin } = await import('../auth/local-login.js');

const STORE_CACHE_KEY = '__nyx_hics_store__';

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
      'user-agent': 'invite-set-password-test',
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

function readBackingStore() {
  return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
}

function findUser(store, email) {
  return store.users.find((candidate) => String(candidate.email || '').toLowerCase() === email);
}

const adminToken = issueSignedAccessToken({
  email: 'admin@example.com',
  fullName: 'Bootstrap Admin',
  organization: 'Nyx Test Health',
  role: 'enterprise-admin',
  facility: 'all',
  authMethod: 'password',
});

/* ---- warm instance B's cache: the store BEFORE the invite ----
   Loading the store creates the bootstrap admin and persists it.
   The snapshot read back here is what a second warm instance,
   loaded before the invite, would be holding in memory. */
await getStore();
const staleSnapshot = readBackingStore();
assert.ok(findUser(staleSnapshot, 'admin@example.com'), 'stale snapshot contains the bootstrap admin');
assert.equal(findUser(staleSnapshot, 'dana@example.com'), undefined, 'stale snapshot predates the invitee');

/* ---- instance A: the admin invites Dana ----
   The Resend fetch is stubbed so the test can read the raw
   token out of the emailed link, exactly like a user clicking
   it. */
process.env.RESEND_API_KEY = 'test-resend-key';
process.env.RESEND_FROM_EMAIL = 'no-reply@example.com';
const realFetch = globalThis.fetch;
let inviteEmailText = '';
globalThis.fetch = async (url, options) => {
  assert.ok(String(url).includes('api.resend.com'), 'only the Resend call is expected while fetch is stubbed');
  inviteEmailText = String(JSON.parse(options.body).text || '');
  return { ok: true, status: 200, json: async () => ({ id: 'stubbed-email' }) };
};
let invite;
try {
  invite = await call(adminUsers, createReq('POST', {
    fullName: 'Dana Demo',
    email: 'dana@example.com',
    role: 'facilitator',
    facility: 'general-acute-care',
  }, adminToken));
} finally {
  globalThis.fetch = realFetch;
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
}
assert.equal(invite.status, 201, 'admin invite creates the user');
assert.equal(invite.body.inviteEmailSent, true, 'invite email was sent');
assert.equal(invite.body.user.email, 'dana@example.com');
assert.equal(invite.body.user.passwordTokenHash, undefined, 'token hash never leaves the server in the response');

const tokenMatch = inviteEmailText.match(/token=([a-f0-9]{64})/);
assert.ok(tokenMatch, 'invite email carries the raw set-password token link');
const rawToken = tokenMatch[1];
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

const afterInvite = readBackingStore();
const danaAfterInvite = findUser(afterInvite, 'dana@example.com');
assert.ok(danaAfterInvite, 'invitee persisted to the backing store');
assert.equal(danaAfterInvite.passwordTokenHash, tokenHash, 'backing store holds the invite token hash');
const inviteExpiry = new Date(danaAfterInvite.passwordTokenExpiresAt).getTime();
assert.ok(inviteExpiry > Date.now() && inviteExpiry <= Date.now() + 61 * 60 * 1000, 'invite token expires in about 1 hour');
assert.ok(
  afterInvite.auditLogs.some((entry) => entry.action === 'admin_user_created'),
  'invite creation was audit-logged',
);

/* ---- the trap is real: instance B's stale cache alone does
   not contain the token - this is the production failure. ---- */
assert.equal(consumePasswordToken(staleSnapshot, rawToken), null, 'stale cache alone would reject the fresh invite token');

/* ---- instance B: the Facility Admin page's chained audit
   write lands on the warm instance holding the stale cache.
   This is the exact call FacilityAdminPage makes immediately
   after a successful invite (writeAuditLog in
   hics-app/src/lib/notifications.ts). ---- */
globalThis[STORE_CACHE_KEY] = staleSnapshot;
const auditWrite = await call(auditLogs, createReq('POST', {
  action: 'admin_user_invite_submitted',
  data: { role: 'facilitator', facility: 'general-acute-care' },
}, adminToken));
assert.equal(auditWrite.status, 201, 'chained audit write succeeds');

/* ---- the invite must survive the chained write ---- */
const afterAudit = readBackingStore();
const danaAfterAudit = findUser(afterAudit, 'dana@example.com');
assert.ok(danaAfterAudit, 'invitee still exists after the chained audit write (stale-instance overwrite regression)');
assert.equal(danaAfterAudit.passwordTokenHash, tokenHash, 'invite token hash survived the chained audit write');
assert.ok(
  afterAudit.auditLogs.some((entry) => entry.action === 'admin_user_invite_submitted'),
  'the chained audit entry was recorded',
);
assert.ok(
  afterAudit.auditLogs.some((entry) => entry.action === 'admin_user_created'),
  'the invite creation audit entry survived too',
);

/* ---- Dana clicks the emailed link and sets her password ---- */
const setPassword = await call(resetPassword, createReq('POST', {
  token: rawToken,
  password: 'InvitedPassword88',
}));
assert.equal(setPassword.status, 200, 'invitee can set a password from the emailed link');

const danaAfterSet = findUser(await getStore(), 'dana@example.com');
assert.equal(danaAfterSet.passwordTokenHash, undefined, 'token hash is cleared after the password is set');
assert.equal(danaAfterSet.passwordTokenExpiresAt, undefined, 'token expiry is cleared after the password is set');

const danaLogin = await call(localLogin, createReq('POST', {
  email: 'dana@example.com',
  password: 'InvitedPassword88',
}));
assert.equal(danaLogin.status, 200, 'invitee can sign in with the password she set');
assert.equal(danaLogin.body.role, 'facilitator', 'invitee signs in with the invited role');

const tokenReuse = await call(resetPassword, createReq('POST', {
  token: rawToken,
  password: 'AnotherPassword111',
}));
assert.equal(tokenReuse.status, 400, 'the invite token cannot be reused after the password is set');

fs.rmSync(STORE_FILE, { force: true });

console.log('invite-set-password: PASS');
