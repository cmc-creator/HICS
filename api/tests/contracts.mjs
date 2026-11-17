import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Contracts (owner portal e-signature flow):
//   - enterprise-admin ONLY for create/list/get/send/resend/void/
//     countersign (facility-admin and observer get 403)
//   - lifecycle draft -> sent -> viewed -> signed -> completed
//   - the document renders once at send; its SHA-256 hash matches
//     the stored text at every stage, signatures included
//   - signer tokens: invalid -> 404, expired -> 410, voided -> 404
//   - signing requires the e-sign consent checkbox
//   - countersign before the customer signs -> 400
//
// Isolated environment, set before importing any api module.
const STORE_FILE = path.join(process.cwd(), '.nyx-hics-store-contracts-smoke.json');
fs.rmSync(STORE_FILE, { force: true });
fs.rmSync(path.join(os.tmpdir(), 'nyx-hics-store.json'), { force: true });

process.env.TOKEN_SIGNING_SECRET = process.env.TOKEN_SIGNING_SECRET || 'test-signing-secret-for-smoke';
process.env.DEFAULT_ORGANIZATION_NAME = 'Nyx Test Health';
process.env.DEFAULT_USER_FACILITY = 'psychiatric-inpatient';
process.env.HICS_STORE_FILE_PATH = STORE_FILE;
process.env.HICS_BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com';
process.env.HICS_BOOTSTRAP_ADMIN_PASSWORD = 'BootstrapPass123';
process.env.RESEND_API_KEY = 'test-resend-key';
process.env.RESEND_FROM_EMAIL = 'no-reply@nyxhicslab.com';
delete process.env.HICS_SEED_DEMO;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.APP_BASE_URL;

// Stub the Resend endpoint and capture every email: the raw
// signer token only ever exists inside the emailed link, exactly
// like production, so the test extracts it from the email body.
const sentEmails = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (String(url).includes('api.resend.com')) {
    sentEmails.push(JSON.parse(String(options?.body || '{}')));
    return { ok: true, status: 200, json: async () => ({ id: 'stub-email' }), text: async () => '' };
  }
  throw new Error(`Unexpected fetch in test: ${url}`);
};

const { default: contracts } = await import('../admin/contracts.js');
const { default: contractById } = await import('../admin/contracts/[id].js');
const { default: contractSend } = await import('../admin/contracts/[id]/send.js');
const { default: contractResend } = await import('../admin/contracts/[id]/resend.js');
const { default: contractVoid } = await import('../admin/contracts/[id]/void.js');
const { default: contractCountersign } = await import('../admin/contracts/[id]/countersign.js');
const { default: contractPreview } = await import('../admin/contracts/[id]/preview.js');
const { default: sign } = await import('../sign/[token].js');
const { issueSignedAccessToken } = await import('../_auth.js');
const { reloadStore, saveStore } = await import('../_store.js');

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

function createReq(method, body = {}, token = null, query = {}) {
  return {
    method,
    body,
    query,
    headers: {
      'user-agent': 'contracts-test-agent',
      'x-forwarded-for': '203.0.113.9',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    socket: { remoteAddress: '203.0.113.9' },
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
const facilityAdminToken = tokenFor('facility-admin');
const enterpriseAdminToken = tokenFor('enterprise-admin');

const sha256 = (text) => crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');

function extractSignerToken(email) {
  const match = String(email?.text || '').match(/\/sign\/([0-9a-f]{64})/);
  assert.ok(match, 'the email must contain a signing link with a token');
  return match[1];
}

const createBody = {
  customer: {
    organization: 'Desert Valley Medical Center',
    facility: 'general-acute-care',
    contactName: 'Jamie Chen',
    contactEmail: 'jamie.chen@desertvalley.example',
  },
  fields: {
    planTier: 'community',
    annualFee: 7500,
    setupFee: 1500,
    termMonths: 12,
    startDate: '2027-01-01',
    governingLaw: 'Arizona',
  },
};

/* ---- role gates on create ---- */
const unauthCreate = await call(contracts, createReq('POST', createBody));
assert.equal(unauthCreate.status, 401, 'create requires a session');

const observerCreate = await call(contracts, createReq('POST', createBody, observerToken));
assert.equal(observerCreate.status, 403, 'observer cannot create contracts');

const facilityCreate = await call(contracts, createReq('POST', createBody, facilityAdminToken));
assert.equal(facilityCreate.status, 403, 'facility-admin cannot create contracts (owner portal is enterprise-admin only)');

/* ---- validation ---- */
const badEmail = await call(contracts, createReq('POST', {
  ...createBody,
  customer: { ...createBody.customer, contactEmail: 'not-an-email' },
}, enterpriseAdminToken));
assert.equal(badEmail.status, 400, 'invalid contact email is rejected');

const badTier = await call(contracts, createReq('POST', {
  ...createBody,
  fields: { ...createBody.fields, planTier: 'platinum' },
}, enterpriseAdminToken));
assert.equal(badTier.status, 400, 'unknown plan tier is rejected');

/* ---- create + read ---- */
const created = await call(contracts, createReq('POST', createBody, enterpriseAdminToken));
assert.equal(created.status, 201, 'enterprise-admin creates a draft');
const contractId = created.body.contract.id;
assert.equal(created.body.contract.status, 'draft');
assert.equal(created.body.contract.templateVersion, 1);
assert.ok(!('signerTokenHash' in created.body.contract), 'token hash is never exposed');
assert.ok(!('documentText' in created.body.contract), 'list summary omits the document text');

const listAsFacility = await call(contracts, createReq('GET', {}, facilityAdminToken));
assert.equal(listAsFacility.status, 403, 'facility-admin cannot list contracts');

const list = await call(contracts, createReq('GET', {}, enterpriseAdminToken));
assert.equal(list.status, 200);
assert.equal(list.body.contracts.length, 1);
assert.equal(list.body.contracts[0].id, contractId);

const missing = await call(contractById, createReq('GET', {}, enterpriseAdminToken, { id: 'contract-nope' }));
assert.equal(missing.status, 404, 'unknown contract id is a 404');

const detailDraft = await call(contractById, createReq('GET', {}, enterpriseAdminToken, { id: contractId }));
assert.equal(detailDraft.status, 200);
assert.equal(detailDraft.body.contract.documentText, '', 'a draft has no rendered document yet');

/* ---- no route edits a contract's fields ---- */
const putAttempt = await call(contracts, createReq('PUT', createBody, enterpriseAdminToken));
assert.equal(putAttempt.status, 405, 'there is no update route for contract fields');

const postToDetail = await call(contractById, createReq('POST', {}, enterpriseAdminToken, { id: contractId }));
assert.equal(postToDetail.status, 405, 'the detail route is read-only');

/* ---- preview renders a draft without persisting anything ---- */
const facilityPreview = await call(contractPreview, createReq('POST', {}, facilityAdminToken, { id: contractId }));
assert.equal(facilityPreview.status, 403, 'facility-admin cannot preview contracts');

const preview = await call(contractPreview, createReq('POST', {}, enterpriseAdminToken, { id: contractId }));
assert.equal(preview.status, 200, 'enterprise-admin previews a draft');
assert.ok(preview.body.documentText.includes('Desert Valley Medical Center'), 'the preview renders the agreement');

const detailAfterPreview = await call(contractById, createReq('GET', {}, enterpriseAdminToken, { id: contractId }));
assert.equal(detailAfterPreview.body.contract.status, 'draft', 'preview does not change the status');
assert.equal(detailAfterPreview.body.contract.documentText, '', 'preview does not persist a document');

/* ---- countersign before send/sign is refused ---- */
const earlyCountersign = await call(contractCountersign, createReq('POST', {
  name: 'Connie Cooper', title: 'Owner', typedSignature: 'Connie Cooper',
}, enterpriseAdminToken, { id: contractId }));
assert.equal(earlyCountersign.status, 400, 'countersign before the customer signs is a 400');

/* ---- send: role gate, render, hash, email ---- */
const facilitySend = await call(contractSend, createReq('POST', {}, facilityAdminToken, { id: contractId }));
assert.equal(facilitySend.status, 403, 'facility-admin cannot send contracts');

const sent = await call(contractSend, createReq('POST', {}, enterpriseAdminToken, { id: contractId }));
assert.equal(sent.status, 200, 'enterprise-admin sends the draft');
assert.equal(sent.body.emailSent, true, 'the signing email went out (stubbed Resend)');
assert.equal(sent.body.contract.status, 'sent');
assert.ok(sent.body.contract.documentText.includes('Desert Valley Medical Center'), 'the document names the customer');
assert.ok(sent.body.contract.documentText.includes('will NOT enter, upload, or transmit PHI'), 'the document carries the no-PHI clause');
assert.ok(sent.body.contract.documentText.includes('$7,500.00'), 'the document carries the annual fee');
assert.equal(sent.body.contract.documentHash, sha256(sent.body.contract.documentText), 'the stored hash matches the rendered text');
const hashAtSend = sent.body.contract.documentHash;
const textAtSend = sent.body.contract.documentText;

const sendAgain = await call(contractSend, createReq('POST', {}, enterpriseAdminToken, { id: contractId }));
assert.equal(sendAgain.status, 400, 'a sent contract cannot be sent (re-rendered) again');

const previewSent = await call(contractPreview, createReq('POST', {}, enterpriseAdminToken, { id: contractId }));
assert.equal(previewSent.status, 400, 'preview is refused once a contract is sent');

let signerToken = extractSignerToken(sentEmails[sentEmails.length - 1]);
assert.equal(sentEmails[sentEmails.length - 1].to[0], 'jamie.chen@desertvalley.example', 'the signing email went to the customer contact');

/* ---- resend: fresh token, same document ---- */
const resent = await call(contractResend, createReq('POST', {}, enterpriseAdminToken, { id: contractId }));
assert.equal(resent.status, 200, 'resend works for a sent contract');
const resentToken = extractSignerToken(sentEmails[sentEmails.length - 1]);
assert.notEqual(resentToken, signerToken, 'resend issues a fresh token');

const oldTokenView = await call(sign, createReq('GET', {}, null, { token: signerToken }));
assert.equal(oldTokenView.status, 404, 'the pre-resend token no longer works');
signerToken = resentToken;

const detailAfterResend = await call(contractById, createReq('GET', {}, enterpriseAdminToken, { id: contractId }));
assert.equal(detailAfterResend.body.contract.documentText, textAtSend, 'resend never changes the document');
assert.equal(detailAfterResend.body.contract.documentHash, hashAtSend, 'resend never changes the document hash');

/* ---- public signing page ---- */
const garbageView = await call(sign, createReq('GET', {}, null, { token: 'f'.repeat(64) }));
assert.equal(garbageView.status, 404, 'an unknown signer token is a clean 404');

const view = await call(sign, createReq('GET', {}, null, { token: signerToken }));
assert.equal(view.status, 200, 'the customer can open the signing page');
assert.equal(view.body.contract.status, 'viewed', 'the first view marks the contract viewed');
assert.equal(view.body.contract.organization, 'Desert Valley Medical Center');
assert.equal(view.body.contract.documentText, textAtSend, 'the customer sees exactly the sent document');

const viewAgain = await call(sign, createReq('GET', {}, null, { token: signerToken }));
assert.equal(viewAgain.status, 200);
const storeAfterViews = await reloadStore();
const viewedEvents = storeAfterViews.contracts[0].events.filter((event) => event.type === 'viewed');
assert.equal(viewedEvents.length, 1, 'viewed is recorded once, not on every open');

/* ---- signing requires consent and a matching typed signature ---- */
const noConsent = await call(sign, createReq('POST', {
  name: 'Jamie Chen', title: 'Director of Emergency Management', typedSignature: 'Jamie Chen',
}, null, { token: signerToken }));
assert.equal(noConsent.status, 400, 'signing without the consent checkbox is a 400');

const mismatch = await call(sign, createReq('POST', {
  name: 'Jamie Chen', title: 'Director of Emergency Management', typedSignature: 'J Chen', consent: true,
}, null, { token: signerToken }));
assert.equal(mismatch.status, 400, 'a typed signature that does not match the name is a 400');

const signed = await call(sign, createReq('POST', {
  name: 'Jamie Chen', title: 'Director of Emergency Management', typedSignature: 'Jamie Chen', consent: true,
}, null, { token: signerToken }));
assert.equal(signed.status, 200, 'the customer signs');
assert.equal(signed.body.contract.status, 'signed');
assert.equal(signed.body.contract.signatures.length, 1);
assert.equal(signed.body.contract.signatures[0].party, 'customer');

const storeAfterSign = await reloadStore();
const signedRecord = storeAfterSign.contracts[0];
assert.equal(signedRecord.signatures[0].ipAddress, '203.0.113.9', 'the signer IP is recorded');
assert.equal(signedRecord.signatures[0].userAgent, 'contracts-test-agent', 'the signer user agent is recorded');
assert.equal(signedRecord.signatures[0].method, 'typed');
assert.ok(signedRecord.documentText.includes('Signed for Desert Valley Medical Center'), 'the signature block was appended');
assert.equal(signedRecord.documentHash, sha256(signedRecord.documentText), 'the hash was recomputed over the signed text');
assert.notEqual(signedRecord.documentHash, hashAtSend, 'the signed hash differs from the at-send hash');
assert.ok(
  sentEmails.some((email) => email.to[0] === 'jamie.chen@desertvalley.example' && String(email.subject).startsWith('Signed:')),
  'the customer received a signed confirmation email',
);
assert.ok(
  sentEmails.some((email) => email.to[0] === 'info@nyxcollectivellc.com'),
  'Nyx Collective received a signed notice email',
);

const signAgain = await call(sign, createReq('POST', {
  name: 'Jamie Chen', title: 'Director of Emergency Management', typedSignature: 'Jamie Chen', consent: true,
}, null, { token: signerToken }));
assert.equal(signAgain.status, 400, 'an already-signed contract cannot be signed again');

/* ---- countersign completes the contract ---- */
const facilityCountersign = await call(contractCountersign, createReq('POST', {
  name: 'Connie Cooper', title: 'Owner', typedSignature: 'Connie Cooper',
}, facilityAdminToken, { id: contractId }));
assert.equal(facilityCountersign.status, 403, 'facility-admin cannot countersign');

const completed = await call(contractCountersign, createReq('POST', {
  name: 'Connie Cooper', title: 'Owner, Nyx Collective LLC', typedSignature: 'Connie Cooper',
}, enterpriseAdminToken, { id: contractId }));
assert.equal(completed.status, 200, 'enterprise-admin countersigns');
assert.equal(completed.body.contract.status, 'completed');
assert.equal(completed.body.contract.signatures.length, 2);
assert.equal(completed.body.contract.signatures[1].party, 'nyx');
assert.equal(completed.body.contract.documentHash, sha256(completed.body.contract.documentText), 'the final hash covers both signatures');
assert.deepEqual(
  completed.body.contract.events.map((event) => event.type),
  ['created', 'sent', 'resent', 'viewed', 'signed', 'countersigned'],
  'the event log tells the whole lifecycle in order',
);

const voidCompleted = await call(contractVoid, createReq('POST', {}, enterpriseAdminToken, { id: contractId }));
assert.equal(voidCompleted.status, 400, 'a completed contract cannot be voided');

/* ---- void kills the signing link ---- */
const second = await call(contracts, createReq('POST', createBody, enterpriseAdminToken));
const secondId = second.body.contract.id;
await call(contractSend, createReq('POST', {}, enterpriseAdminToken, { id: secondId }));
const secondToken = extractSignerToken(sentEmails[sentEmails.length - 1]);

const voided = await call(contractVoid, createReq('POST', {}, enterpriseAdminToken, { id: secondId }));
assert.equal(voided.status, 200);
assert.equal(voided.body.contract.status, 'voided');

const voidedView = await call(sign, createReq('GET', {}, null, { token: secondToken }));
assert.equal(voidedView.status, 404, 'a voided contract signing link is dead');

/* ---- expired links ---- */
const third = await call(contracts, createReq('POST', createBody, enterpriseAdminToken));
const thirdId = third.body.contract.id;
await call(contractSend, createReq('POST', {}, enterpriseAdminToken, { id: thirdId }));
const thirdToken = extractSignerToken(sentEmails[sentEmails.length - 1]);

const storeToExpire = await reloadStore();
const thirdRecord = storeToExpire.contracts.find((candidate) => candidate.id === thirdId);
thirdRecord.signerTokenExpiresAt = new Date(Date.now() - 60 * 1000).toISOString();
await saveStore(storeToExpire);

const expiredView = await call(sign, createReq('GET', {}, null, { token: thirdToken }));
assert.equal(expiredView.status, 410, 'an expired signing link is a 410');

const expiredSign = await call(sign, createReq('POST', {
  name: 'Jamie Chen', title: 'Director', typedSignature: 'Jamie Chen', consent: true,
}, null, { token: thirdToken }));
assert.equal(expiredSign.status, 410, 'an expired link cannot be signed');

const storeFinal = await reloadStore();
const thirdFinal = storeFinal.contracts.find((candidate) => candidate.id === thirdId);
assert.equal(thirdFinal.status, 'expired', 'the expired contract is marked expired');

/* ---- audit trail ---- */
const auditActions = new Set(storeFinal.auditLogs.map((entry) => entry.action));
for (const action of ['contract_created', 'contract_sent', 'contract_viewed', 'contract_signed', 'contract_countersigned', 'contract_voided']) {
  assert.ok(auditActions.has(action), `audit log contains ${action}`);
}

globalThis.fetch = realFetch;
fs.rmSync(STORE_FILE, { force: true });

console.log('contracts: PASS');
