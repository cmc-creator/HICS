# Changelog

## 2026-11-16 - Hardening round 2: SSO domain allowlist, scheduled backups, customer-deployment mode, data export + wipe

Closes the remaining engineering gaps the sales pack and the deployment runbook flagged. New suite: `api/tests/data-export-wipe.mjs`; the exchange, store-backup, and audit-regressions suites gained the new cases. All ten suites pass; the frontend build is green in both deployment modes. **One operator action is required for the backup schedule to run live: add `CRON_SECRET` (a long random value) to the Vercel project's Production environment** - without it the cron endpoint answers 501 and only manual backups run.

### Added
- **SSO email-domain allowlist (`HICS_SSO_ALLOWED_DOMAINS`):** optional, comma-separated, case-insensitive. When set, first-time Google sign-ins auto-provision only for listed domains; owners (`HICS_OWNER_EMAILS` + bootstrap email) are exempt and existing store users are never gated. A rejected first sign-in gets the clean 403 "not provisioned" response - no record created, no tokens - and is audit-logged as `sso_sign_in_rejected_domain`. Unset = the public demo's open self-serve posture, unchanged.
- **Scheduled automatic backups:** `vercel.json` registers a daily Vercel Cron (06:00 UTC) hitting the new `GET /api/cron/backup`. The endpoint is authorized ONLY by the `CRON_SECRET` env var (timing-safe bearer comparison; 401 for anything else, including user session tokens; 501 when the secret or Redis is unconfigured) and reuses the exact snapshot + prune-to-14 helper behind the manual enterprise-admin endpoint, so scheduled and manual backups are identical. Cron runs are audit-logged with `by: "vercel-cron"`.
- **Customer-deployment mode (`CUSTOMER_DEPLOYMENT` / `VITE_CUSTOMER_DEPLOYMENT`, default off):** for per-customer instances - `/` renders the sign-in page instead of the marketing landing, `/request-demo` redirects to sign-in, and `POST /api/sales/leads` returns 404, so demo leads can never persist into a customer's store. The public site (flags unset) behaves exactly as before.
- **Data export + wipe (the contract-end procedure behind the privacy policy's 90-day deletion promise), enterprise-admin only:** `GET /api/admin/data-export` returns the full store as a JSON download (Content-Disposition attachment), audit-logged. `POST /api/admin/data-wipe` requires `{ confirm: "WIPE" }` plus re-authentication shaped by the caller's record - password re-entry verified against the stored scrypt hash, or, for SSO-only accounts, the caller's email typed back - then preserves ONLY the caller's user record and resets every other collection to the initial-store defaults. A `store_data_wipe_requested` entry is saved to the pre-wipe audit log, and the fresh store's log opens with `store_data_wiped` (by whom, when, what was destroyed). Failed confirmations destroy nothing (pinned by tests). Procedure documented as Step 11 of the deployment runbook.

### Fixed
- **APP_BASE_URL trap, hardened:** when `NODE_ENV` is production and `APP_BASE_URL` is unset, link building (password-set/reset, invite, contract-signing links - all flow through `getAppBaseUrl()`) now logs a loud one-per-cold-start `console.error` naming the wrong-site risk, in the S3/S4 pattern. The default value itself is unchanged (local dev keeps it quietly), and the runbook's reset round-trip check is now marked mandatory.

## 2026-11-16 - Contracts in the owner portal + full UI/UX polish pass

Two phases, both requested the same day: the attorney approved building the SaaS agreement into the app ("fillable fields in the owner portal with sign and send"), and Connie asked for a full polish pass - readability, functionality, UI/UX, tasteful dazzling effects. All nine API suites pass (the eight existing plus the new contracts suite); the frontend build is green.

### Added - Contracts (Phase 1)
- **Contracts collection + versioned agreement template:** a new `contracts` store collection (backfilled into existing stores by the shape healer). `api/_contracts.js` renders agreement template version 1 from the approved term sheet - subscription grant, authorized use, fees with annual prepay, term/termination, customer data return and deletion within 90 days, the no-PHI clause (training data only, no BAA), AI assistant and subprocessor terms, security, SLA/support targets, liability cap tied to fees paid, indemnification, insurance covenant, Arizona governing law, and an ESIGN/UETA electronic-signatures consent section - with the order fields (organization, facility, contact, plan tier, annual fee, setup fee, term, start date) merged in.
- **Owner-portal API (enterprise-admin ONLY; facility-admin and below get 403, pinned by tests):** `POST /api/admin/contracts` creates a draft (fields are fixed at creation - there is deliberately no edit route), `GET` list/detail, `POST /:id/preview` renders a draft's exact document without persisting anything, `POST /:id/send` renders the document ONCE, stores it with its SHA-256 hash, issues a 14-day signer token (only the hash is stored), and emails the customer the signing link via Resend from the configured sender; `POST /:id/resend` issues a fresh token and re-emails without ever re-rendering the document; `POST /:id/void` voids anything not yet executed and kills the link; `POST /:id/countersign` records Nyx's typed countersignature, only after the customer has signed.
- **Public signing (`/api/sign/:token`, no login):** GET returns the agreement for display and marks a sent contract viewed exactly once; POST requires the e-sign consent checkbox, a typed signature matching the signer's name, and a live token (invalid 404, expired 410, both leak-free). Signing appends the signature block to the document and recomputes the SHA-256, so the signed copy is tamper-evident; signer name, title, email, timestamp, IP, and user agent are recorded; confirmation emails go to the customer and to info@nyxcollectivellc.com. Every transition is audit-logged and kept in the contract's append-only event list.
- **Frontend:** a Contracts section in the admin area gated to enterprise-admin sessions (nav link included): status-chipped list, create form with inline validation, detail view with preview-before-send, send/resend/void actions, event history, signature record, document hash, countersign form, and a print-friendly signed copy (print CSS isolates the document). The public `/sign/:token` page shows the agreement in a readable document layout with a live typed-signature preview in a script style and an explicit consent checkbox.
- **Toast system:** `lib/toast.tsx` - one provider, success/error/info toasts with role=status/alert announcements, used by the contract flows now and adopted across the app in Phase 2.
- Tests: `api/tests/contracts.mjs` covers the role gates, the full draft -> sent -> viewed -> signed -> completed lifecycle, preview non-persistence, hash-matches-text at every stage, token invalid/expired/voided behavior, consent required, typed-signature matching, countersign ordering, and the audit trail.

### Changed - UI/UX polish (Phase 2)
- **Login page (the sales demo's front door):** brand panel with the logo mark and a soft glow orb, dark-mode-correct colors throughout, an OR divider, inline per-field errors with aria-invalid styling, and spinner working states on credential sign-in, MFA verify, and Google sign-in (all disable while running).
- **Dashboard:** stat tiles and progress numbers count up on load (rAF easing, reduced-motion safe); the progress snapshot shows skeletons while attempts load and a friendly "run your first scenario" empty state when there are none.
- **Route transitions:** the protected layout's main region is keyed by route, so the fade-in replays on every navigation; the navbar's active state follows the longest matching path (Contracts lights up on contract pages, not Admin) and exposes aria-current.
- **Toasts replace silent success:** facility admin user invites and the AI toggle, MFA enable/disable on the Account page, and Training Reports CSV export / certificate / clear-data all confirm via toast. Facility Admin also gained loading skeletons for the user and audit lists, an empty state for users, and a working state on Add User.
- **Forms:** Request Demo gained per-field inline errors and a spinner submit; invalid fields across the app get a red border treatment tied to aria-invalid.
- **Readability:** comfortable line length and line height for long text - Learning Center storyboard cues and objectives (plus aria-labels on its placeholder-only upload inputs), and 1.7 line height across the Privacy and Terms pages.
- **Scenario player:** the progress bar is now a real progressbar (role, value, text) with a soft light sweep animation; the Scenarios filter empty state gained a one-click "Clear all filters" action.
- **Reduced motion, completed:** the prefers-reduced-motion block now stands down EVERY animation and transition in the app (orbs, sheens, metallic borders, gradients, skeletons, toasts, count-ups), closing the gap recorded in the accessibility notes. Every Phase 1 accessibility fix is preserved.

## 2026-11-16 - Enterprise readiness pass: AI off-switch, store backups, opt-in MFA, accessibility

Four items from the sales readiness review, aimed at selling to large hospital systems. New suites: `api/tests/settings-ai-toggle.mjs`, `api/tests/store-backup.mjs`, `api/tests/auth-mfa.mjs`. All eight suites pass; the frontend build is green.

### Added
- **Per-customer AI off-switch:** a tenant-level `settings.aiAssistantEnabled` flag (default on) in the store. `GET/PUT /api/admin/settings` reads/writes it - any signed-in role can read (the frontend needs it), only facility-admin and enterprise-admin can write, and writes are audit-logged (`settings_ai_assistant_toggled`). `api/chat.js` enforces it BEFORE any provider call: when off, chat returns 403 "The AI assistant is disabled for this facility" and Anthropic/Gemini are never contacted (pinned by a fetch-counting test). The floating assistant hides its launcher entirely when off, the full-page assistant shows a disabled notice instead of the chat UI, and Facility Admin gains a "Facility Settings" panel with the toggle. The frontend fetch fails open for DISPLAY only - the server remains the enforcement point.
- **Tested store backups + restore:** `POST /api/admin/backup` (enterprise-admin only) snapshots the live store JSON verbatim to a timestamped key in the same Upstash database (`nyx:hics:store:v1:backup:<ISO>`), pruning to the newest 14; `GET` lists snapshots with timestamps and sizes. `scripts/restore-backup.mjs` restores a snapshot into the main key (`--list`, `--dry-run` inspection, then the real restore). The restore writes the snapshot's raw bytes back, so a round trip is byte-identical. The health store endpoint reports backup count and latest-backup time to enterprise admins. Backups require the Redis-backed store; without Upstash configured the endpoint answers 501. Operator procedure: `hics-sales-pack/backup-restore-runbook.md`. Proven end to end in the suite and against a local fake-Upstash server - production data was never touched.
- **Opt-in MFA (TOTP) for password accounts:** RFC 6238 TOTP implemented with Node's built-in crypto only (`api/_mfa.js`) - base32 secrets, HMAC-SHA1 codes with a +/-1 step window, verified against the RFC 6238 Appendix B test vectors. Enrollment is strictly opt-in per user from the new Account page (`/account`): `POST /api/auth/mfa/enroll` parks an encrypted pending secret, `confirm` activates it only after the user proves their authenticator works and returns 8 one-time recovery codes (shown once; only SHA-256 hashes are stored). Secrets are stored AES-256-GCM-encrypted under a key derived from `TOKEN_SIGNING_SECRET`. When MFA is on, password login returns `{ mfaRequired: true, challengeToken }` - a 5-minute HMAC-signed challenge that is structurally unusable as an access token - and `POST /api/auth/mfa/verify` exchanges challenge + TOTP/recovery code for the normal session; recovery codes are consumed on use. `disable` requires a valid code, so a hijacked session alone cannot strip the factor. SSO-only accounts cannot enroll (their provider owns MFA), nobody is forced into MFA by this change, and the bootstrap admin's sign-in is untouched (pinned by tests).
- **Account page:** `/account` shows the signed-in profile and the MFA controls; linked from the navbar (desktop and mobile).

### Fixed
- **Accessibility (main flows):** dark slate text on blue-600 toggle chips (about 2.4:1 contrast) changed to white (about 5.9:1) in Scenarios and Scenario Player; the Dashboard first-run briefing overlay gained dialog semantics (`role="dialog"`, `aria-modal`, labelled by its heading); the Quiz category filter's orphan `<label>` became a labelled group and its buttons, the Scenarios playlist buttons, and the Scenario Player mode toggles now expose `aria-pressed`; previously unlabeled controls (team-assignment name/role, seconds-per-step, both AI chat inputs) gained accessible names; the primary nav is a single labelled landmark (the mobile menu is no longer a nested `<nav>`); login/MFA errors render with `role="alert"`. Full write-up: `hics-sales-pack/accessibility-notes.md`.

## 2026-11-16 - Permissions honesty: admin UI gated on the real role

### Fixed
- **The admin page dressed basic accounts up as admins:** SSO auto-provisioning gives first-time Google sign-ins an `observer` account, but the frontend never stored the role the sign-in endpoints returned. Any signed-in user could open `/admin`, where the Tenant Profile's "Current Role" showed the local preview switcher (which defaults to Facility Admin) and the Permission Matrix rendered ENABLED from that same switcher. The API refused the actual data all along (the page silently showed empty lists), but for a product sold to hospitals the dressing itself misrepresented the account's permissions.
- **The real role is now plumbed end to end:** both sign-in endpoints already returned `role` and `facility`; the password path (`LoginPage`) and the SSO path (`OidcExchangeResult` / `AuthCallbackPage`) now store them in the auth session (`AuthUser.role` / `AuthUser.facility`), and the auth context exposes `isAdmin` (facility-admin or enterprise-admin).
- **The admin area is gated on the session role:** the `/admin` route redirects any non-admin session to `/dashboard`, and the Navbar Admin link renders only for admin sessions. Sessions persisted before this change carry no role and are treated as non-admin (fail closed) until the user signs in again. The server still enforces the same policy on every admin request; this gate makes the UI honest, it is not the enforcement.
- **Honest labels on Facility Admin:** the Tenant Profile now shows a read-only "Signed-in Role" (the actual account role, which cannot be changed on the page) next to the switcher, the switcher is relabeled "Preview As Role" with a note that it only changes reporting-scope displays, and the Permission Matrix is captioned as reflecting the previewed role.
- **Unchanged on purpose:** the tenant preview switcher still drives reporting-scope displays elsewhere (TrainingReports uses it for its export and clear-data affordances); only the admin route, the Admin nav link, and the profile labels stopped treating it as a permission.
- Tests: `api/tests/audit-regressions.mjs` gains a block pinning the server half of the rule - an observer-role session token receives 403 from `GET /api/admin/users`, `POST /api/admin/users`, and `GET /api/audit/logs`, while a facility-admin token succeeds on the GETs.

## 2026-11-16 - SSO auto-provisioning (B4 follow-up)

### Changed
- **First-time Google sign-in now auto-provisions an account instead of returning 403:** the audit fix for B4 made `api/auth/exchange.js` refuse any verified Google identity with no store record ("not provisioned"). Connie rejected that posture the same day - it walled out legitimate first-time sign-ins, including her own other owner emails, and the production site doubles as the sales demo. A verified identity with no record now gets one created and persisted before tokens are issued: owner emails become `enterprise-admin` with facility `all`; everyone else becomes `observer` - the lowest-privilege non-admin role in the canonical `AppUserRole` list - with the `DEFAULT_USER_FACILITY` / `DEFAULT_ORGANIZATION_NAME` defaults. Existing records are untouched (role/facility/organization still come from the record, never the email string), and an inactive record is still refused with 403. Auto-created records are SSO-only: no password credential is created, so credential login rejects them like any passwordless account. Provisioning is audit-logged as `sso_user_auto_provisioned`, or `sso_owner_auto_provisioned` for owners.
- **Owner emails** come from the new `HICS_OWNER_EMAILS` env var (comma-separated, case-insensitive); the `HICS_BOOTSTRAP_ADMIN_EMAIL` value always counts as an owner too. Deployment note: set `HICS_OWNER_EMAILS` in Vercel to Connie's owner emails so they auto-provision as enterprise admins on first Google sign-in.
- Tests: `api/tests/auth-exchange-google-smoke.mjs` updated - the unprovisioned case now expects auto-provisioned success with the default role, and new cases cover owner provisioning via `HICS_OWNER_EMAILS`, owner provisioning via the bootstrap email, inactive-user refusal, and the created record actually persisting in the store.

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
