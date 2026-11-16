# Changelog

## 2026-11-16 - Security and reliability audit fixes

A full audit of `api/` and `hics-app/src` (requested after the reset/Google sign-in bug chain surfaced three latent defects in one day) found the items below; all were fixed the same day. New regression suite: `api/tests/audit-regressions.mjs`. Note for deployments: the `ALLOW_LOCAL_AUTH_FALLBACK` and `ALLOW_OIDC_MOCK_FALLBACK` env vars are no longer read anywhere and can be removed from the Vercel project; `VITE_ALLOW_LOCAL_AUTH_FALLBACK` is likewise unused by the frontend.

### Fixed (security)
- **SSO mock-identity bypass (B2):** `api/auth/exchange.js` fell through to hardcoded mock identities (with `enterprise-admin` granted to any email containing "admin") whenever a provider's env config was missing - Entra/Okta are unset, so a direct call issued real signed sessions with no credentials. The fallthrough and `ALLOW_OIDC_MOCK_FALLBACK` are deleted: an unconfigured provider returns 503, a failed or identity-less exchange returns 401, and no session is ever issued without a JWKS-verified identity.
- **SSO now requires a provisioned user (B4):** after verification, the exchange reloads the store and looks the user up by email; unknown or inactive accounts get 403. Role, facility, and organization come from the store record - the email-string role inference (`inferRole`/`inferFacility`) is deleted.
- **Forgeable `pwd-` bearer tokens (B3):** `api/_auth.js` accepted any bearer token starting with `pwd-` as a facility admin while `ALLOW_LOCAL_AUTH_FALLBACK` was set - and that flag was live in production. `parseDevFallbackToken` is deleted outright. The same flag also gated real credential login; `api/auth/local-login.js` no longer depends on it, and the frontend's fabricate-a-session branch in `hics-app/src/lib/oidc.ts` is deleted (a missing exchange endpoint now throws a clear configuration error).
- **Unauthenticated AI chat (B7):** `api/chat.js` now requires a valid session (401 otherwise). `GlobalAssistant` and `ChatbotPage` call it through `publicApiRequest` so the session token is attached; both already lived behind the protected layout.

### Fixed (data correctness)
- **Facility silently rewritten (B5):** `String(body.facility ?? requesterFacility === 'all' ? ...)` in `api/admin/users.js` and `api/training/attempts.js` parsed so every provided facility was discarded for `psychiatric-inpatient` - admin-created users landed in the wrong facility and out-of-scope attempts 403'd into a swallowed client-side fallback. Both use the new explicit `resolveFacility()` helper in `api/_auth.js`; a repo-wide grep confirms no other instances.
- **Sales leads discarded (B6):** `api/sales/leads.js` only forwarded leads to `SALES_WEBHOOK_URL` and returned 201 regardless, so with the webhook unset every demo request vanished. Leads are now persisted to a new `leads` store collection (201 means saved); the webhook remains as an optional relay, and the health endpoint/panel report `counts.leads`.
- **Progress scoping (W6):** `api/training/progress.js` authorized against the facility embedded in the progress key (the player's UI selection), locking users out of their own progress. Records now carry a session-stamped `ownerEmail` and authorize by owner; legacy ownerless records keep the old rule until rewritten.

### Changed (hardening)
- **W3:** `api/training/media.js` rejects inline media data URLs over 512 KB with a clear 400 pointing at the Blob upload flow (the app's own uploads already store Blob URLs; the cap protects the single store value from growing past Upstash payload limits).
- **W4:** `api/auth/refresh.js` wraps token issuance in try/catch with a generic 500; the exchange and local-login issuance failures were genericized the same way (details logged server-side, no config text leaked to clients).
- **W5:** `ensureStoreShape` resets top-level collections that are present but the wrong type, not just missing ones; `appendAuditLog` guards its array so it can never throw.
- **W7:** JWKS responses are cached per issuer URL for 10 minutes in `api/auth/exchange.js`, refetching once on an unknown kid so key rotation still lands immediately.
- **W8:** admin user creation rejects duplicate emails (case-insensitive, 409) and unknown roles (400, validated against the canonical `AppUserRole` list).
- **S1 (light):** swallowed catches in `hics-app/src/lib/trainingAnalytics.ts` and `notifications.ts` now `console.error` the operation and HTTP status before the local fallback; `publicApiRequest` errors carry the HTTP status to make that possible.
- **S2:** the HealthCheckPage Auth Exchange probe goes through `publicApiRequest` with an intentionally invalid body and treats HTTP 400 as alive (404/500/network = failure), so it exercises the same path building as real sign-in.
- **S3:** undelivered email is loud server-side: `api/_email.js` logs unconfigured/provider/transport failures, and `api/auth/forgot-password.js` logs when a reset email was not delivered (user-facing response unchanged).
- **S4:** `ensureBootstrapAdmin` logs an error when the bootstrap config is partially present but unusable instead of silently skipping admin creation.
- **H1/H2:** `authContext.tsx` uses the shared `normalizePath` from `apiClient.ts` (its private pre-fix copy is deleted), and the unused `apiRequest` export is removed from `apiClient.ts`.
- **H3 (partial):** `vercel.json` CSP `connect-src` no longer allows `login.microsoftonline.com` or `*.okta.com`.

## 2026-11-16

### Added
- `api/_passwords.js`: scrypt password hashing/verification (node:crypto, per-password salt, timing-safe compare) plus single-use set-password tokens - only the sha256 hash and a 1-hour expiry are stored on the user record.
- `api/_email.js`: transactional email helper backed by Resend (`RESEND_API_KEY` / `RESEND_FROM_EMAIL`). When email is not configured it records an `email_not_configured` store notification instead of throwing.
- `api/auth/reset-password.js`: POST endpoint that consumes a set-password token, sets the password (min 10 chars), clears the token, and deletes the user's stored refresh sessions.
- `hics-app/src/pages/ResetPasswordPage.tsx` and public route `/reset-password`: neutral "Set your password" page used by both password resets and admin invites.
- Bootstrap admin: when `HICS_BOOTSTRAP_ADMIN_EMAIL` and `HICS_BOOTSTRAP_ADMIN_PASSWORD` are set, store load creates that enterprise admin (facility `all`) if no user with the email exists. Idempotent across loads and store backends.
- `api/tests/auth-credentials-smoke.mjs`: credential auth smoke suite (hashing, real login, forgot/reset flow, token reuse and expiry, bootstrap admin, seed behavior).
- Google SSO: `google` added as a third OIDC provider end to end - `hics-app/src/lib/oidc.ts` (authorize URL defaults to Google's fixed endpoint when unset; the authorize request carries `prompt=select_account`) and `api/auth/exchange.js` (token, JWKS, and issuer default to Google's fixed endpoints, so only `OIDC_GOOGLE_CLIENT_ID` and `OIDC_GOOGLE_CLIENT_SECRET` must be configured). Google sessions are labeled `google-oidc` and default to the facility-admin role.
- `api/tests/auth-exchange-google-smoke.mjs`: exchange smoke suite proving the google allowlist entry, the default Google endpoint resolution, and a full fetch-stubbed exchange of a Google-shaped RS256 ID token.

### Changed
- `api/auth/local-login.js`: demo login replaced with real credential verification against the store. Users must exist, be `active`, and have a verifying `passwordHash`; token claims (email, fullName, organization, role, facility) come from the user record. All failures return the same generic 401 `Invalid email or password.` The email-string role/facility inference helpers were removed.
- `api/auth/forgot-password.js`: stub replaced with a real flow - a matching active user gets a set-password token and a reset email linking to `${APP_BASE_URL}/reset-password?token=...` (new `APP_BASE_URL` env, default `https://www.nyxhicslab.com`). The always-200 anti-enumeration response, notification, and audit records are unchanged.
- `api/admin/users.js`: inviting a user now creates a set-password token and sends an invite email with the set-password link; the response includes `inviteEmailSent` and email failure no longer fails the invite. User responses (GET and POST) no longer include credential fields (`passwordHash`, token hash/expiry).
- `api/_store.js`: a fresh store seeds the two demo users only when `HICS_SEED_DEMO=true` (they remain passwordless). In production (`VERCEL_ENV=production`) without Redis configured, falling back to file/tmp persistence now logs a loud warning that training records will not persist.
- `api/tests/auth-session-smoke.mjs`: seeds a real credential user for the login step now that demo login is gone.
- `hics-app/src/lib/apiClient.ts`: `publicApiRequest` now surfaces the server's `error` message (e.g. the login 401) instead of only a bare status code.
- `hics-app/.env.example`: documented `APP_BASE_URL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `HICS_BOOTSTRAP_ADMIN_EMAIL`, `HICS_BOOTSTRAP_ADMIN_PASSWORD`, and `HICS_SEED_DEMO`.
- `hics-app/src/pages/LoginPage.tsx`: the Microsoft Entra and Okta sign-in buttons were replaced with a single "Continue with Google" button. The entra/okta providers remain in code, dormant and env-gated, for customers on those identity providers. `hics-app/src/pages/HealthCheckPage.tsx` environment panel now shows the Google Client ID instead of the Entra/Okta rows, and `.env.example` documents the Google OIDC block with the Entra/Okta blocks marked optional/legacy.

### Fixed
- Google sign-in failed on the callback with "API request failed with status 404" even though Google authentication and consent completed: the exchange endpoint is configured as the full path `/api/auth/exchange` (`VITE_AUTH_EXCHANGE_ENDPOINT`), and `apiClient`'s `normalizePath` prepended the `/api` base URL on top of it, producing `/api/api/auth/exchange`. `normalizePath` (`hics-app/src/lib/apiClient.ts`) now returns the path unchanged when it already starts with the configured base. Every other apiClient caller passes base-relative paths and direct `fetch('/api/...')` callers were unaffected, which is why only the SSO callback broke.
- The Redis store transport never actually worked, in two stacked ways. (1) `writeStoreToRedis` sent the store as a JSON array containing the store JSON; the Upstash REST API stores a POST body verbatim, so the database held the array text and every read parsed back an array instead of the store object - handlers then crashed on missing collections (`appendAuditLog` on a store with no `auditLogs`, production HTTP 500s) or found no users. The write now sends the raw store JSON; `readStoreFromRedis` rejects non-object results so a legacy poisoned value is treated as missing and self-heals on the next write; `installLoadedStore` fills in any missing top-level collections (`ensureStoreShape`). Covered by `api/tests/store-redis-roundtrip.mjs`, which stubs fetch with faithful Upstash semantics - the older suites delete the `UPSTASH_*` env vars, which is why the Redis path had never been exercised. (2) The production Redis credentials (set Aug 2026, provenance unknown) were also invalid - every call returned 401 and the failures were swallowed by silent file/tmp fallbacks, so nothing ever persisted across instances (this is what made fresh password reset links report "invalid or expired"). Replaced with a fresh Upstash database ("nyxhicslab", funny-kiwi-171612.upstash.io) created 2026-11-16 and pointed the app at it via `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (an earlier save of the token carried one stray character - 63 chars vs the real 62 - and was corrected and verified by length). `api/_store.js` now logs Redis read/write failures (console.error) before falling back, so a persistence failure can never hide silently again.
- Fresh password reset links reporting "invalid or expired": serverless instances cache the store in memory per instance, so a reset token written to the backing store by one instance was invisible to a warm instance holding an older cache (the same staleness could keep an old password hash valid after a reset and keep reset-revoked sessions alive). `api/_store.js` now exports `reloadStore()` - a forced fresh read from the backing store that shares `loadStore()`'s read path - and the auth-critical handlers reload before reading: `api/auth/forgot-password.js`, `api/auth/reset-password.js`, `api/auth/local-login.js`, and refresh-session validation in `api/_sessions.js`. Covered by a two-instance staleness simulation in `api/tests/auth-credentials-smoke.mjs`.

## 2026-04-17

### Removed
- `api/_s3_presign.js`: dead code after the Vercel Blob migration; no longer imported by any endpoint.

### Tests
- Added smoke test `learning center, quiz, chatbot, rapid challenge, and live drill render correctly` covering all five previously-untested training module pages with API route stubs.

## 2026-04-14

### Changed
- `api/training/media/upload-url.js`: replaced AWS4 S3 presign pipeline with Vercel Blob `handleUpload` token handshake; endpoint handles both `blob.generate-client-token` (JWT-authenticated, MIME-restricted, size-limited) and `blob.upload-completed` callback phases.
- `hics-app/src/pages/LearningCenterPage.tsx`: swapped `requestLearningMediaUploadTarget` and data-URL fallback for `upload()` from `@vercel/blob/client`; uploaded files go to Vercel Blob and the public URL is saved via `uploadLearningMediaAsset`.
- `hics-app/src/lib/trainingAnalytics.ts`: removed `LearningMediaUploadTarget` interface and `requestLearningMediaUploadTarget` helper.
- `vercel.json`: updated `installCommand` to install root deps for serverless functions; added `connect-src`, `img-src`, and `media-src` CSP entries for Vercel Blob domains.
- `hics-app/.env.example`: replaced S3 variable block with `BLOB_READ_WRITE_TOKEN` entry.

### Added
- Root `package.json` with `@vercel/blob ^0.27.0` dependency for Vercel serverless functions.
- `hics-app/package.json`: added `@vercel/blob ^0.27.0` to frontend dependencies.

## 2026-04-03

### Added
- Live Drill Control page: facilitator-led drill orchestration with phase progression, elapsed timer, participant roster, and announcement broadcast. Sessions saved and restored via `api/training/live-drills`.
- Rapid Challenge page: timed 75-second 10-question mini-game with streak multiplier and facility-scoped leaderboard via `api/training/rapid-challenge`.
- Learning Center page: storyboard module navigator with frame-by-frame progression, completion tracking, S3 presign video upload pipeline, streaming URL support, and admin-scoped media asset management.
- `api/training/media`: media asset CRUD with facility scoping, data-URL and stream-URL support, 8 MB data-URL cap, and audit logging.
- `api/training/media/upload-url`: S3 presign endpoint for direct browser-to-storage PUT uploads with configurable size limit.
- `api/_s3_presign.js`: AWS4-HMAC-SHA256 presigned PUT URL generation compatible with S3-compatible object storage (Cloudflare R2, MinIO, AWS S3).
- `api/_policy.js`: centralized endpoint authorization matrix for `TRAINING_MEDIA`, `LIVE_DRILLS`, `RAPID_CHALLENGE`, and all other protected routes.
- `api/_store.js`: extended shared store with `mediaAssets`, `liveDrillSessions`, and `rapidChallengeScores` collections.
- `api/_sessions.js`: server-side session store with JWT verification helpers.
- `api/auth/refresh.js`: access token refresh endpoint.
- Playwright smoke suite: 5 automated tests (~7 s total) covering public routes, protected route guards, dashboard card navigation, scenario player controls, admin access, and the global assistant widget.
- Navbar extended with Learning Center, Rapid Challenge, and Live Drill items.

## 2026-04-02

### Added
- Facility Administration page: user invite form, facility-scoped user table, and audit log viewer.
- Health Check page: live API endpoint status panel with re-run support.
- `api/admin/users`: admin user list and invite endpoints with enterprise-admin guard.
- `api/audit/logs`: audit log read endpoint, facility-scoped for non-admins.
- `api/notifications/send`: outbound notification dispatch scaffold.
- `api/training/attempts`, `api/training/events`, `api/training/progress`: training data persistence endpoints.
- `api/auth/forgot-password.js`: password reset request handler.
- `api/chat.js`: AI assistant proxy with JWT auth guard and rate limiting.
- `api/_auth.js`: JWT verification, facility scope extraction, and role helpers (`canManageData`, `isEnterpriseAdmin`).
- `api/_security.js`: rate limiting, JSON body parsing with 1 MB cap, and field validation helpers.
- `api/health/store.js`: health check endpoint for datastore connectivity.

### Improved
- Scenario Player and Scenarios page now persist attempt records via the backend API.
- Training Reports loads attempt history from the API with localStorage fallback.

## 2026-04-01

### Added
- Public landing page with marketing hero, testimonials, pricing tier cards, and trust pillars.
- Request Demo page with enterprise lead-intake form routed to `api/sales/leads.js`.
- Enterprise login page with local-auth form, OIDC provider buttons (Entra ID and Okta), and remember-device support.
- Forgot Password page.
- OIDC auth callback page.
- Terms of Service and Privacy Policy pages.
- `api/auth/exchange.js`: OIDC token exchange contract scaffold.
- `api/auth/local-login.js`: local username/password auth endpoint.
- Session inactivity timeout in authenticated layout: 5-minute warning banner with push notification, auto-redirect on expiry.
- `api/sales/leads.js`: request-demo lead capture endpoint.

## 2026-03-31

### Added
- Facility-aware scenario filtering and text adaptation for multiple care environments.
- New scenario content: active shooter, bomb threat, and workplace violence modules.
- Facilitator mode controls (pause, reveal) and timed drill mode in scenario player.
- Local learner progress tracking with reports dashboard and CSV export.
- Advanced scenario browsing: playlists, difficulty/type/duration filters.
- Animated feedback and light humor callouts in scenario and quiz flows.
- In-app Facilitator Quick Start page for rapid training session setup.

### Improved
- Dark mode readability and hover contrast for answer and feedback panels.
- Keyboard focus-visible styling across interactive controls.
- Dashboard with learner progress snapshot and direct reporting links.

### Notes
- Current analytics and reporting are local browser storage based.
- Multi-user cloud persistence can be added in a future phase.
