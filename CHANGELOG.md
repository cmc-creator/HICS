# Changelog

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
