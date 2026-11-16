import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Google exchange config: only the client id/secret are provided.
// OIDC_GOOGLE_TOKEN_URL / OIDC_GOOGLE_JWKS_URL / OIDC_GOOGLE_ISSUER are
// deliberately unset so the test proves the handler falls back to
// Google's fixed default endpoints.
process.env.TOKEN_SIGNING_SECRET = process.env.TOKEN_SIGNING_SECRET || 'test-signing-secret-for-smoke';
process.env.DEFAULT_ORGANIZATION_NAME = 'Nyx Test Health';
process.env.DEFAULT_USER_FACILITY = 'psychiatric-inpatient';
process.env.HICS_STORE_FILE_PATH = process.env.HICS_STORE_FILE_PATH || `${process.cwd()}/.nyx-hics-store-exchange-smoke.json`;
process.env.OIDC_GOOGLE_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com';
process.env.OIDC_GOOGLE_CLIENT_SECRET = 'test-google-client-secret';
// Owner auto-provisioning sources (mixed case on purpose: matching
// must be case-insensitive). HICS_BOOTSTRAP_ADMIN_PASSWORD is
// deliberately NOT set - with no usable password the bootstrap
// mechanism creates no user, so the bootstrap-email owner case
// below exercises the SSO auto-provisioning path itself rather
// than a bootstrap-created record.
process.env.HICS_OWNER_EMAILS = 'Owner.Person@Example.com, second.owner@example.com';
process.env.HICS_BOOTSTRAP_ADMIN_EMAIL = 'big.boss@example.com';
delete process.env.HICS_BOOTSTRAP_ADMIN_PASSWORD;
delete process.env.OIDC_GOOGLE_TOKEN_URL;
delete process.env.OIDC_GOOGLE_JWKS_URL;
delete process.env.OIDC_GOOGLE_ISSUER;
delete process.env.ALLOW_OIDC_MOCK_FALLBACK;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const CLIENT_ID = process.env.OIDC_GOOGLE_CLIENT_ID;
const KID = 'google-smoke-test-kid';

// A throwaway RSA keypair stands in for Google's signing keys. The
// public half is served by the stubbed JWKS endpoint; the private half
// mints Google-shaped ID tokens.
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
jwk.kid = KID;
jwk.alg = 'RS256';
jwk.use = 'sig';

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function mintIdToken(overrides = {}) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const claims = {
    iss: 'https://accounts.google.com',
    aud: CLIENT_ID,
    sub: '108234567890123456789',
    email: 'charge.nurse@example.com',
    name: 'Charge Nurse',
    iat: nowSeconds - 10,
    exp: nowSeconds + 3600,
    ...overrides,
  };
  const signingInput = `${base64UrlJson({ alg: 'RS256', kid: KID, typ: 'JWT' })}.${base64UrlJson(claims)}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64url');
  return `${signingInput}.${signature}`;
}

// Stub the only two outbound calls the exchange makes, pinned to
// Google's default URLs: if the handler resolved any other token or
// JWKS URL, the stub throws and the exchange fails.
let currentIdToken = mintIdToken();
const fetchCalls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const urlString = String(url);
  fetchCalls.push({ url: urlString, method: options.method || 'GET', body: options.body });

  if (urlString === 'https://oauth2.googleapis.com/token') {
    return {
      ok: true,
      status: 200,
      json: async () => ({ id_token: currentIdToken, token_type: 'Bearer', expires_in: 3600 }),
      text: async () => '',
    };
  }

  if (urlString === 'https://www.googleapis.com/oauth2/v3/certs') {
    return {
      ok: true,
      status: 200,
      json: async () => ({ keys: [jwk] }),
      text: async () => '',
    };
  }

  throw new Error(`Unexpected fetch in smoke test: ${urlString}`);
};

const { default: exchange } = await import('../auth/exchange.js');
const { getStore, saveStore } = await import('../_store.js');

// For an existing store user, role, facility, and organization
// come from the record, never from the email string (audit fix
// B4). Seed the user the minted ID tokens name; first-time users
// are auto-provisioned instead (cases 5, 7, and 8 below).
const seedStore = await getStore();
if (!seedStore.users.some((candidate) => String(candidate.email || '').toLowerCase() === 'charge.nurse@example.com')) {
  seedStore.users.push({
    id: 'usr-smoke-charge-nurse',
    fullName: 'Charge Nurse',
    email: 'charge.nurse@example.com',
    role: 'facility-admin',
    facility: 'psychiatric-inpatient',
    organization: 'Nyx Test Health',
    status: 'active',
    createdAt: new Date().toISOString(),
  });
  await saveStore(seedStore);
}

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
      'user-agent': 'auth-exchange-google-smoke-test',
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

const exchangeBody = {
  code: 'test-authorization-code',
  codeVerifier: 'test-code-verifier-with-at-least-32-chars',
  redirectUri: 'https://www.nyxhicslab.com/auth/callback',
};

// 1. Unknown providers are still rejected, and the allowlist message
// now names google.
const rejected = await call(exchange, createBaseReq('POST', { ...exchangeBody, provider: 'saml' }));
assert.equal(rejected.status, 400, 'unknown provider should be rejected');
assert.equal(rejected.body.error, 'Provider must be entra, okta, or google');

// 2. Full google exchange: the stubbed token endpoint returns a
// Google-shaped RS256 ID token, verified against the stubbed JWKS.
const success = await call(exchange, createBaseReq('POST', { ...exchangeBody, provider: 'google' }));
assert.equal(success.status, 200, `google exchange should succeed (got ${success.status}: ${JSON.stringify(success.body)})`);
assert.equal(success.body.email, 'charge.nurse@example.com');
assert.equal(success.body.fullName, 'Charge Nurse');
assert.equal(success.body.organization, 'Nyx Test Health');
assert.equal(success.body.role, 'facility-admin', 'role comes from the store record');
assert.equal(success.body.facility, 'psychiatric-inpatient');
assert.equal(typeof success.body.accessToken, 'string');
assert.ok(success.body.accessToken.length > 20, 'access token should be issued');

// The exchange must have used Google's default endpoints (env unset)
// and sent the configured client id/secret to the token endpoint.
const tokenCall = fetchCalls.find((entry) => entry.url === 'https://oauth2.googleapis.com/token');
assert.ok(tokenCall, 'token endpoint should be Google default URL');
const tokenParams = new URLSearchParams(String(tokenCall.body));
assert.equal(tokenParams.get('grant_type'), 'authorization_code');
assert.equal(tokenParams.get('client_id'), CLIENT_ID);
assert.equal(tokenParams.get('client_secret'), 'test-google-client-secret');
assert.ok(
  fetchCalls.some((entry) => entry.url === 'https://www.googleapis.com/oauth2/v3/certs'),
  'JWKS should be loaded from Google default URL',
);

// 3. An expired Google ID token is rejected (no mock fallback set).
currentIdToken = mintIdToken({ exp: Math.floor(Date.now() / 1000) - 60 });
const expired = await call(exchange, createBaseReq('POST', { ...exchangeBody, provider: 'google' }));
assert.equal(expired.status, 401, 'expired id_token should be rejected');
assert.match(String(expired.body.error), /expired/i);

// 4. An ID token minted for a different audience is rejected.
currentIdToken = mintIdToken({ aud: 'someone-elses-client-id' });
const wrongAudience = await call(exchange, createBaseReq('POST', { ...exchangeBody, provider: 'google' }));
assert.equal(wrongAudience.status, 401, 'wrong-audience id_token should be rejected');
assert.match(String(wrongAudience.body.error), /audience/i);

// 5. A fully verified Google identity with no store record is a
// first sign-in: the exchange auto-provisions a basic account
// (lowest-privilege role 'observer', default facility and
// organization) and signs them in. Connie rejected the original
// B4 behavior - a 403 wall for every first-time user - so SSO is
// self-serve at the bottom of the privilege ladder, never above
// it: no role ever comes from the email string.
currentIdToken = mintIdToken({ email: 'new.hire@example.com', name: 'New Hire' });
const firstTimer = await call(exchange, createBaseReq('POST', { ...exchangeBody, provider: 'google' }));
assert.equal(firstTimer.status, 200, `first-time SSO user should be auto-provisioned and signed in (got ${firstTimer.status}: ${JSON.stringify(firstTimer.body)})`);
assert.equal(firstTimer.body.email, 'new.hire@example.com');
assert.equal(firstTimer.body.role, 'observer', 'auto-provisioned role is the lowest-privilege non-admin role');
assert.equal(firstTimer.body.facility, 'psychiatric-inpatient', 'auto-provisioned facility is DEFAULT_USER_FACILITY');
assert.equal(firstTimer.body.organization, 'Nyx Test Health', 'auto-provisioned organization is DEFAULT_ORGANIZATION_NAME');
assert.equal(typeof firstTimer.body.accessToken, 'string');
assert.ok(firstTimer.body.accessToken.length > 20, 'access token should be issued');

// The auto-created record is really in the store afterwards:
// SSO-only (no password credential is invented for it), active,
// and stamped with the provider. The provisioning is also in the
// audit log under its own action.
const storeAfterFirstTimer = await getStore();
const provisioned = storeAfterFirstTimer.users.filter(
  (candidate) => String(candidate.email || '').toLowerCase() === 'new.hire@example.com',
);
assert.equal(provisioned.length, 1, 'exactly one auto-provisioned record should exist');
assert.equal(provisioned[0].role, 'observer');
assert.equal(provisioned[0].status, 'active');
assert.equal(provisioned[0].ssoProvider, 'google');
assert.equal(provisioned[0].passwordHash, undefined, 'SSO-only account must not gain a password credential');
assert.ok(
  storeAfterFirstTimer.auditLogs.some(
    (entry) => entry.action === 'sso_user_auto_provisioned' && entry.data?.email === 'new.hire@example.com',
  ),
  'auto-provisioning should be audit-logged',
);

// 5b. A second sign-in for the same person uses the record the
// first one created - no duplicate provisioning, same role.
const secondSignIn = await call(exchange, createBaseReq('POST', { ...exchangeBody, provider: 'google' }));
assert.equal(secondSignIn.status, 200, 'returning auto-provisioned user should sign in');
assert.equal(secondSignIn.body.role, 'observer');
const storeAfterSecond = await getStore();
assert.equal(
  storeAfterSecond.users.filter((candidate) => String(candidate.email || '').toLowerCase() === 'new.hire@example.com').length,
  1,
  'repeat sign-in must not create a duplicate record',
);

// 6. An unconfigured provider (entra env is unset in this suite)
// is refused with 503 and issues no token (audit fix B2 - the
// mock-identity fallthrough is gone).
currentIdToken = mintIdToken();
const unconfigured = await call(exchange, createBaseReq('POST', { ...exchangeBody, provider: 'entra' }));
assert.equal(unconfigured.status, 503, 'unconfigured provider should return 503');
assert.equal(unconfigured.body.accessToken, undefined, 'no access token for unconfigured provider');

// 7. An owner email from HICS_OWNER_EMAILS (listed there in mixed
// case; the token's email is lowercase) auto-provisions as an
// enterprise admin with facility 'all', and the owner flavor of
// provisioning gets its own audit action.
currentIdToken = mintIdToken({ email: 'owner.person@example.com', name: 'Owner Person' });
const ownerSignIn = await call(exchange, createBaseReq('POST', { ...exchangeBody, provider: 'google' }));
assert.equal(ownerSignIn.status, 200, `owner first sign-in should succeed (got ${ownerSignIn.status}: ${JSON.stringify(ownerSignIn.body)})`);
assert.equal(ownerSignIn.body.role, 'enterprise-admin', 'owner auto-provisions as enterprise-admin');
assert.equal(ownerSignIn.body.facility, 'all', 'owner auto-provisions with facility all');
const storeAfterOwner = await getStore();
const ownerRecord = storeAfterOwner.users.find(
  (candidate) => String(candidate.email || '').toLowerCase() === 'owner.person@example.com',
);
assert.ok(ownerRecord, 'owner record should exist in the store');
assert.equal(ownerRecord.role, 'enterprise-admin');
assert.equal(ownerRecord.ssoProvider, 'google');
assert.ok(
  storeAfterOwner.auditLogs.some(
    (entry) => entry.action === 'sso_owner_auto_provisioned' && entry.data?.email === 'owner.person@example.com',
  ),
  'owner auto-provisioning should be audit-logged distinctly',
);

// 8. The bootstrap admin email counts as an owner even when it is
// not in HICS_OWNER_EMAILS. (No bootstrap user exists in this
// suite: the bootstrap password env is unset, so this record can
// only have come from SSO auto-provisioning.)
currentIdToken = mintIdToken({ email: 'big.boss@example.com', name: 'Big Boss' });
const bootstrapOwnerSignIn = await call(exchange, createBaseReq('POST', { ...exchangeBody, provider: 'google' }));
assert.equal(bootstrapOwnerSignIn.status, 200, 'bootstrap-email first sign-in should succeed');
assert.equal(bootstrapOwnerSignIn.body.role, 'enterprise-admin', 'bootstrap email auto-provisions as enterprise-admin');
assert.equal(bootstrapOwnerSignIn.body.facility, 'all');

// 9. An existing but INACTIVE store record is still refused:
// auto-provisioning must never resurrect or bypass a disabled
// account.
const inactiveStore = await getStore();
if (!inactiveStore.users.some((candidate) => String(candidate.email || '').toLowerCase() === 'suspended.user@example.com')) {
  inactiveStore.users.push({
    id: 'usr-smoke-suspended',
    fullName: 'Suspended User',
    email: 'suspended.user@example.com',
    role: 'facility-admin',
    facility: 'psychiatric-inpatient',
    organization: 'Nyx Test Health',
    status: 'inactive',
    createdAt: new Date().toISOString(),
  });
  await saveStore(inactiveStore);
}
currentIdToken = mintIdToken({ email: 'suspended.user@example.com', name: 'Suspended User' });
const inactive = await call(exchange, createBaseReq('POST', { ...exchangeBody, provider: 'google' }));
assert.equal(inactive.status, 403, 'inactive store user should still be refused');
assert.equal(inactive.body.accessToken, undefined, 'no access token for inactive user');

globalThis.fetch = originalFetch;

console.log('auth-exchange-google-smoke: PASS');
