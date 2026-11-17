import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Training attempt recording (regression suite for the
// 2026-11-17 production failure):
//
//   A facilitator whose account facility is 'general-acute-care'
//   ran scenarios to completion from the default browsing path.
//   The ScenarioPlayer sends the UI's facility-profile context
//   as the attempt's `facility` - the ?facility= URL param, which
//   is 'all' on the default All Facilities path (and whatever
//   profile a user happens to be browsing under, e.g.
//   'psychiatric-inpatient'). POST /api/training/attempts
//   resolved the attempt's facility from that client value and
//   hard-rejected with 403 'Attempt facility outside requester
//   scope' whenever it differed from the account's facility
//   claim. The rejection fired before any store mutation, so
//   completed scenarios were NEVER recorded: the client caught
//   the error into its local fallback, the completion screen
//   rendered normally, and the Reports page GET then overwrote
//   the local fallback with the server's empty facility-scoped
//   list - Total Attempts 0 after three 100% completions, while
//   telemetry events (whose endpoint stamps the requester's
//   facility server-side, like events / rapid-challenge /
//   live-drills all do) landed fine.
//
//   The fix mirrors the sibling endpoints: a non-enterprise
//   requester's attempts are stamped with their account facility
//   server-side; only enterprise admins may record under an
//   explicitly requested facility. There is no scope 403.
//
//   The suite also replays the invite bug's mechanism inside
//   the completion chain: after an attempt lands, the player
//   fires POST /training/events, POST /notifications/send and
//   DELETE /training/progress in quick succession. Any of those
//   landing on a warm instance whose cache predated the attempt
//   would erase it with a whole-blob save. Every writer in the
//   chain - and the Reports reads in attempts/events GET - now
//   reloads the store first, like the auth/audit paths.
//
// Isolated environment, set before importing any api module.
const STORE_FILE = path.join(process.cwd(), '.nyx-hics-store-attempts-smoke.json');
fs.rmSync(STORE_FILE, { force: true });
fs.rmSync(path.join(os.tmpdir(), 'nyx-hics-store.json'), { force: true });

process.env.TOKEN_SIGNING_SECRET = 'attempts-smoke-signing-secret';
process.env.ALLOW_LOCAL_AUTH_FALLBACK = 'true';
process.env.DEFAULT_ORGANIZATION_NAME = 'Nyx Test Health';
process.env.HICS_STORE_FILE_PATH = STORE_FILE;
process.env.HICS_BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com';
process.env.HICS_BOOTSTRAP_ADMIN_PASSWORD = 'correct horse battery staple';
delete process.env.HICS_SEED_DEMO;
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_FROM_EMAIL;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

const { getStore } = await import('../_store.js');
const { issueSignedAccessToken } = await import('../_auth.js');
const { default: attempts } = await import('../training/attempts.js');
const { default: events } = await import('../training/events.js');
const { default: progress } = await import('../training/progress.js');
const { default: rapidChallenge } = await import('../training/rapid-challenge.js');
const { default: notificationsSend } = await import('../notifications/send.js');

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

function createReq(method, body = {}, token = null, query = {}) {
  return {
    method,
    body,
    query,
    headers: {
      'user-agent': 'training-attempts-test',
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

function installStaleCache(snapshot) {
  globalThis[STORE_CACHE_KEY] = JSON.parse(JSON.stringify(snapshot));
}

const adminToken = issueSignedAccessToken({
  email: 'admin@example.com',
  fullName: 'Bootstrap Admin',
  organization: 'Nyx Test Health',
  role: 'enterprise-admin',
  facility: 'all',
  authMethod: 'password',
});

// The demo/reviewer shape from the production failure: a real
// facilitator whose ACCOUNT facility is general-acute-care.
const facilitatorToken = issueSignedAccessToken({
  email: 'reviewer@example.com',
  fullName: 'Store Review Demo',
  organization: 'Nyx Test Health',
  role: 'facilitator',
  facility: 'general-acute-care',
  authMethod: 'password',
});

// Loading the store creates the bootstrap admin and persists it.
await getStore();
assert.ok(readBackingStore().users.some((user) => user.email === 'admin@example.com'));

/* ---- Act 1: the exact production payload. The player sends
   facility 'all' from the default All Facilities path. ---- */
const completionPayload = {
  scenarioId: 'psych-unit-fire-smoke',
  scenarioTitle: 'Psych Unit Fire and Smoke Event',
  facility: 'all',
  correctAnswers: 3,
  totalSteps: 3,
  scorePercent: 100,
  timedMode: false,
  facilitatorMode: false,
  durationSeconds: 240,
  learnerEmail: 'reviewer@example.com',
  learnerName: 'Store Review Demo',
};

const first = await call(attempts, createReq('POST', completionPayload, facilitatorToken));
assert.equal(first.status, 201, 'attempt POST from the default all-facilities path must be accepted, not 403');
assert.equal(first.body.attempt.facility, 'general-acute-care', 'attempt is stamped with the account facility');
assert.equal(first.body.attempt.scorePercent, 100);

let backing = readBackingStore();
assert.equal(backing.attempts.length, 1, 'attempt persisted to the backing store');
assert.equal(backing.attempts[0].scenarioId, 'psych-unit-fire-smoke');
assert.ok(
  backing.auditLogs.some((entry) => entry.action === 'training_attempt_recorded'),
  'attempt recording was audit-logged',
);

/* ---- Act 2: browsing under a different facility profile
   (psychiatric-inpatient) must record the same way. ---- */
const second = await call(attempts, createReq('POST', {
  ...completionPayload,
  scenarioId: 'severe-weather-locked-campus',
  scenarioTitle: 'Severe Weather on a Locked Behavioral Campus',
  facility: 'psychiatric-inpatient',
}, facilitatorToken));
assert.equal(second.status, 201, 'attempt POST under a browsed facility profile must be accepted');
assert.equal(second.body.attempt.facility, 'general-acute-care');
assert.equal(readBackingStore().attempts.length, 2);

/* ---- Act 3: the Reports read path returns what was recorded,
   scoped to the facilitator's own facility. ---- */
const reports = await call(attempts, createReq('GET', {}, facilitatorToken));
assert.equal(reports.status, 200);
assert.equal(reports.body.attempts.length, 2, 'Reports GET returns both recorded attempts');
assert.deepEqual(
  reports.body.attempts.map((attempt) => attempt.scenarioId).sort(),
  ['psych-unit-fire-smoke', 'severe-weather-locked-campus'],
);

/* ---- Act 4: the completion chain from stale instances.
   Snapshot the store, record a third attempt from a fresh
   instance, then fire the chain's other writers (events POST,
   progress PUT, notifications POST, progress DELETE) with a
   pre-attempt cache installed - the invite bug's exact trap.
   The attempt must survive every one of them. ---- */
const staleSnapshot = readBackingStore();
assert.equal(staleSnapshot.attempts.length, 2, 'stale snapshot predates the third attempt');

const third = await call(attempts, createReq('POST', {
  ...completionPayload,
  scenarioTitle: 'Psych Unit Fire and Smoke Event',
}, facilitatorToken));
assert.equal(third.status, 201);
assert.equal(readBackingStore().attempts.length, 3);

installStaleCache(staleSnapshot);
const eventWrite = await call(events, createReq('POST', {
  event: 'scenario_completed',
  data: { scenarioId: 'psych-unit-fire-smoke', scorePercent: 100 },
}, facilitatorToken));
assert.equal(eventWrite.status, 201);
assert.equal(readBackingStore().attempts.length, 3, 'attempt survives a stale-instance events write');

installStaleCache(staleSnapshot);
const progressWrite = await call(progress, createReq('PUT', {
  key: 'psych-unit-fire-smoke:all',
  progress: { scenarioId: 'psych-unit-fire-smoke', currentStepIndex: 1, score: 1, answers: [] },
}, facilitatorToken));
assert.equal(progressWrite.status, 200);
assert.equal(readBackingStore().attempts.length, 3, 'attempt survives a stale-instance progress write');

installStaleCache(staleSnapshot);
const notifyWrite = await call(notificationsSend, createReq('POST', {
  type: 'training_completion',
  recipient: 'reviewer@example.com',
  subject: 'NyxHICSlab Scenario Complete',
  message: 'Store Review Demo completed Psych Unit Fire and Smoke Event with a score of 100%',
}, facilitatorToken));
assert.equal(notifyWrite.status, 202);
assert.equal(readBackingStore().attempts.length, 3, 'attempt survives a stale-instance notification write');

installStaleCache(staleSnapshot);
const progressClear = await call(progress, createReq('DELETE', {}, facilitatorToken, { key: 'psych-unit-fire-smoke:all' }));
assert.equal(progressClear.status, 204);
backing = readBackingStore();
assert.equal(backing.attempts.length, 3, 'attempt survives the completion-chain progress clear');
assert.ok(
  backing.events.some((entry) => entry.event === 'scenario_completed'),
  'telemetry event landed server-side alongside the attempts',
);
assert.ok(backing.notifications.some((entry) => entry.type === 'training_completion'), 'notification landed server-side');

const reportsAfterChain = await call(attempts, createReq('GET', {}, facilitatorToken));
assert.equal(reportsAfterChain.body.attempts.length, 3, 'Reports GET still returns all three attempts after the chain');

/* ---- Act 5: sibling pins. Rapid Challenge already stamps the
   requester facility server-side (never affected); enterprise
   admins keep the ability to record under a requested
   facility; the events read shows the telemetry counts. ---- */
const rapid = await call(rapidChallenge, createReq('POST', {
  score: 900,
  peakStreak: 5,
  durationSeconds: 120,
  totalQuestions: 10,
  answered: 10,
  facility: 'psychiatric-inpatient',
}, facilitatorToken));
assert.equal(rapid.status, 201);
assert.equal(
  readBackingStore().rapidChallengeScores[0].facility,
  'general-acute-care',
  'rapid challenge score is stamped with the account facility',
);

const enterpriseAttempt = await call(attempts, createReq('POST', {
  ...completionPayload,
  scenarioId: 'enterprise-facility-run',
  facility: 'community-hospital',
}, adminToken));
assert.equal(enterpriseAttempt.status, 201);
assert.equal(enterpriseAttempt.body.attempt.facility, 'community-hospital', 'enterprise admin may record under a requested facility');

const eventCounts = await call(events, createReq('GET', {}, adminToken));
assert.equal(eventCounts.status, 200);
assert.ok(
  eventCounts.body.eventCounts.some((entry) => entry.event === 'scenario_completed' && entry.count >= 1),
  'events GET reports the scenario_completed telemetry',
);

console.log('training-attempts: all assertions passed');
