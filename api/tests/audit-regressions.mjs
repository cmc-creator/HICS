import assert from 'node:assert/strict';

// Regression suite for the 2026-11-16 security/reliability audit
// fixes (B2, B3, B5, B6, B7, W8) plus the same-day permissions
// honesty follow-up (admin endpoints enforce the session role).
// Each block pins one fixed behavior so the bug class cannot
// quietly return.

process.env.TOKEN_SIGNING_SECRET = process.env.TOKEN_SIGNING_SECRET || 'test-signing-secret-for-audit-regressions';
process.env.DEFAULT_ORGANIZATION_NAME = 'Nyx Test Health';
process.env.DEFAULT_USER_FACILITY = 'psychiatric-inpatient';
process.env.HICS_STORE_FILE_PATH = process.env.HICS_STORE_FILE_PATH || `${process.cwd()}/.nyx-hics-store-audit-regressions.json`;
// The removed fallbacks must stay removed even when the old flags
// are set - that is the point of these tests.
process.env.ALLOW_LOCAL_AUTH_FALLBACK = 'true';
process.env.ALLOW_OIDC_MOCK_FALLBACK = 'true';
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.SALES_WEBHOOK_URL;
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_FROM_EMAIL;
delete process.env.OIDC_ENTRA_TOKEN_URL;
delete process.env.OIDC_ENTRA_CLIENT_ID;
delete process.env.OIDC_ENTRA_CLIENT_SECRET;
delete process.env.OIDC_ENTRA_JWKS_URL;
delete process.env.OIDC_ENTRA_ISSUER;
delete process.env.OIDC_GOOGLE_CLIENT_ID;
delete process.env.OIDC_GOOGLE_CLIENT_SECRET;

const { default: exchange } = await import('../auth/exchange.js');
const { default: adminUsers } = await import('../admin/users.js');
const { default: auditLogs } = await import('../audit/logs.js');
const { default: attempts } = await import('../training/attempts.js');
const { default: leads } = await import('../sales/leads.js');
const { default: chat } = await import('../chat.js');
const { default: storeHealth } = await import('../health/store.js');
const { getAuthContext, issueSignedAccessToken, resolveFacility } = await import('../_auth.js');
const { getStore } = await import('../_store.js');

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

function createBaseReq(method, body = {}, headers = {}) {
  return {
    method,
    body,
    headers: {
      'user-agent': 'audit-regressions-test',
      'x-forwarded-for': '127.0.0.1',
      ...headers,
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

// --- (1) B2: an unconfigured OIDC provider rejects and issues
// no token, even with ALLOW_OIDC_MOCK_FALLBACK=true set above.
const exchangeBody = {
  code: 'test-authorization-code',
  codeVerifier: 'test-code-verifier-with-at-least-32-chars',
  redirectUri: 'https://www.nyxhicslab.com/auth/callback',
};
for (const provider of ['entra', 'okta', 'google']) {
  const refused = await call(exchange, createBaseReq('POST', { ...exchangeBody, provider }));
  assert.equal(refused.status, 503, `unconfigured provider ${provider} should return 503 (got ${refused.status})`);
  assert.equal(refused.body.accessToken, undefined, `no access token for unconfigured provider ${provider}`);
  assert.equal(refused.body.refreshToken, undefined, `no refresh token for unconfigured provider ${provider}`);
}

// --- (2) B3: a "pwd-" bearer token is not an identity, even
// with ALLOW_LOCAL_AUTH_FALLBACK=true set above.
const forgedReq = createBaseReq('GET', {}, { authorization: 'Bearer pwd-forged-facility-admin' });
assert.equal(getAuthContext(forgedReq), null, 'pwd- token must not produce an auth context');
const forgedHandler = await call(storeHealth, forgedReq);
assert.equal(forgedHandler.status, 401, 'pwd- token must be rejected by requireAuth handlers');

// Sanity: a properly signed token still authenticates.
const enterpriseToken = issueSignedAccessToken({
  email: 'enterprise.admin@example.com',
  fullName: 'Enterprise Admin',
  organization: 'Nyx Test Health',
  role: 'enterprise-admin',
  facility: 'all',
  authMethod: 'password',
});
const signedContext = getAuthContext(createBaseReq('GET', {}, { authorization: `Bearer ${enterpriseToken}` }));
assert.ok(signedContext, 'signed token should produce an auth context');
assert.equal(signedContext.claims.role, 'enterprise-admin');

// --- (3) B5/W8: resolveFacility semantics, unit level.
assert.equal(resolveFacility('community-hospital', 'all'), 'community-hospital', 'provided facility wins');
assert.equal(resolveFacility(undefined, 'all'), 'psychiatric-inpatient', "'all' requester falls back to the default facility");
assert.equal(resolveFacility('', 'general-acute-care'), 'general-acute-care', 'scoped requester keeps their facility');
assert.equal(resolveFacility(undefined, 'general-acute-care'), 'general-acute-care', 'scoped requester keeps their facility when none provided');

// B5/W8 at the handler level: an enterprise admin creating a
// user in a named facility gets that facility (the old
// precedence bug rewrote it to psychiatric-inpatient), duplicate
// emails are refused, and unknown roles are refused. Emails carry
// a per-run suffix because the suite's store file persists
// between runs - the duplicate check would (correctly) refuse a
// second run's "new" user otherwise.
const runId = `${Date.now()}`;
const nurseEmail = `new.nurse+${runId}@example.com`;
const authHeaders = { authorization: `Bearer ${enterpriseToken}` };
const created = await call(adminUsers, createBaseReq('POST', {
  fullName: 'New Nurse',
  email: nurseEmail,
  role: 'facilitator',
  facility: 'community-hospital',
}, authHeaders));
assert.equal(created.status, 201, `admin user creation should succeed (got ${created.status}: ${JSON.stringify(created.body)})`);
assert.equal(created.body.user.facility, 'community-hospital', 'provided facility must be preserved');
assert.equal(created.body.user.passwordHash, undefined, 'credential material must not leave the server');

const duplicate = await call(adminUsers, createBaseReq('POST', {
  fullName: 'Duplicate Nurse',
  email: nurseEmail.toUpperCase(),
  role: 'facilitator',
  facility: 'community-hospital',
}, authHeaders));
assert.equal(duplicate.status, 409, 'duplicate email (case-insensitive) should return 409');

const badRole = await call(adminUsers, createBaseReq('POST', {
  fullName: 'Role Typo',
  email: `role.typo+${runId}@example.com`,
  role: 'superuser',
  facility: 'community-hospital',
}, authHeaders));
assert.equal(badRole.status, 400, 'unknown role should return 400');

// B5 at the attempts handler: the recorded attempt keeps the
// facility it was posted with.
const attemptPosted = await call(attempts, createBaseReq('POST', {
  scenarioId: 'scenario-1',
  scenarioTitle: 'Code Blue Basics',
  facility: 'community-hospital',
  correctAnswers: 8,
  totalSteps: 10,
  scorePercent: 80,
}, authHeaders));
assert.equal(attemptPosted.status, 201, `attempt recording should succeed (got ${attemptPosted.status})`);
assert.equal(attemptPosted.body.attempt.facility, 'community-hospital', 'attempt facility must be preserved');

// --- (4) B6: a posted sales lead is persisted in the store.
const leadEmail = `buyer+${runId}@example.com`;
const leadPosted = await call(leads, createBaseReq('POST', {
  name: 'Interested Hospital',
  email: leadEmail,
  organization: 'Example Health System',
  teamSize: '50',
  timeline: 'Q1',
  goals: 'Run quarterly HICS drills',
}));
assert.equal(leadPosted.status, 201, `lead submission should succeed (got ${leadPosted.status})`);
assert.ok(leadPosted.body.leadId, 'lead response carries the lead id');
const storeAfterLead = await getStore();
assert.ok(Array.isArray(storeAfterLead.leads), 'store has a leads collection');
const savedLead = storeAfterLead.leads.find((lead) => lead.email === leadEmail);
assert.ok(savedLead, 'posted lead is persisted in the store');
assert.equal(savedLead.id, leadPosted.body.leadId, 'persisted lead matches the returned id');

// --- Customer-deployment mode: with CUSTOMER_DEPLOYMENT=true
// the demo-lead endpoint does not exist (404) and nothing is
// persisted into what would be a customer's store. With the
// flag off again, B6 behavior above is unchanged.
process.env.CUSTOMER_DEPLOYMENT = 'true';
const customerLeadEmail = `customer.mode+${runId}@example.com`;
const customerLead = await call(leads, createBaseReq('POST', {
  name: 'Should Not Persist',
  email: customerLeadEmail,
  organization: 'Customer Health System',
}));
assert.equal(customerLead.status, 404, `customer-deployment lead post should 404 (got ${customerLead.status})`);
const storeAfterCustomerLead = await getStore();
assert.ok(
  !storeAfterCustomerLead.leads.some((lead) => lead.email === customerLeadEmail),
  'customer-deployment lead must not be persisted',
);
delete process.env.CUSTOMER_DEPLOYMENT;
const leadAfterModeOff = await call(leads, createBaseReq('POST', {
  name: 'Public Site Buyer',
  email: `public.mode+${runId}@example.com`,
  organization: 'Example Health System',
}));
assert.equal(leadAfterModeOff.status, 201, 'lead posts work again once customer mode is off');

// --- B7: /api/chat refuses unauthenticated calls before any
// provider work happens.
const chatRefused = await call(chat, createBaseReq('POST', { message: 'How do I run a drill?' }));
assert.equal(chatRefused.status, 401, 'unauthenticated chat should return 401');

// --- (5) Permissions honesty follow-up: the admin endpoints
// enforce the role carried by the session token, independent of
// anything the frontend shows. An 'observer' session (the role
// first-time SSO sign-ins are auto-provisioned with) is refused
// by every admin read and write, while a facility-admin session
// succeeds on the reads. This pins the server half of the rule
// that the /admin UI is now gated on the same roles.
const observerToken = issueSignedAccessToken({
  email: 'observer.user@example.com',
  fullName: 'Observer User',
  organization: 'Nyx Test Health',
  role: 'observer',
  facility: 'general-acute-care',
  authMethod: 'google-oidc',
});
const observerHeaders = { authorization: `Bearer ${observerToken}` };

const observerListUsers = await call(adminUsers, createBaseReq('GET', {}, observerHeaders));
assert.equal(observerListUsers.status, 403, 'observer must be refused the user list');

const observerCreateUser = await call(adminUsers, createBaseReq('POST', {
  fullName: 'Should Not Exist',
  email: `observer.created+${runId}@example.com`,
  role: 'facilitator',
  facility: 'general-acute-care',
}, observerHeaders));
assert.equal(observerCreateUser.status, 403, 'observer must be refused user creation');

const observerReadLogs = await call(auditLogs, createBaseReq('GET', {}, observerHeaders));
assert.equal(observerReadLogs.status, 403, 'observer must be refused the audit logs');

const facilityAdminToken = issueSignedAccessToken({
  email: 'facility.admin@example.com',
  fullName: 'Facility Admin',
  organization: 'Nyx Test Health',
  role: 'facility-admin',
  facility: 'all',
  authMethod: 'password',
});
const facilityAdminHeaders = { authorization: `Bearer ${facilityAdminToken}` };

const adminListUsers = await call(adminUsers, createBaseReq('GET', {}, facilityAdminHeaders));
assert.equal(adminListUsers.status, 200, `facility-admin should read the user list (got ${adminListUsers.status})`);
assert.ok(Array.isArray(adminListUsers.body.users), 'user list response carries a users array');

const adminReadLogs = await call(auditLogs, createBaseReq('GET', {}, facilityAdminHeaders));
assert.equal(adminReadLogs.status, 200, `facility-admin should read the audit logs (got ${adminReadLogs.status})`);
assert.ok(Array.isArray(adminReadLogs.body.logs), 'audit log response carries a logs array');

console.log('audit-regressions: PASS');
