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
delete process.env.OIDC_GOOGLE_TOKEN_URL;
delete process.env.OIDC_GOOGLE_JWKS_URL;
delete process.env.OIDC_GOOGLE_ISSUER;
delete process.env.ALLOW_OIDC_MOCK_FALLBACK;

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
assert.equal(success.body.role, 'facility-admin', 'google sign-ins default to facility-admin');
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

globalThis.fetch = originalFetch;

console.log('auth-exchange-google-smoke: PASS');
