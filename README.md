# NyxHICSlab

A Hospital Incident Command System (HICS) training platform with interactive scenarios, role-based learning, live drill tools, and an AI training assistant.

## Features

- **Dashboard**: HICS overview, learner progress snapshot, and quick access to every module.
- **HICS Roles & Org Chart**: 24 positions across Command, Operations, Planning, Logistics, and Finance/Admin, with responsibilities and reporting lines.
- **Training Scenarios (20)**: branching decision scenarios across beginner, intermediate, and advanced levels, including mass casualty, fire, hazmat, cyberattack/EHR downtime, severe weather, power failure, pediatric surge, water advisory, supply disruption, ED boarding, elopement, behavioral escalation, active threat, bomb threat, and workplace violence. Scenario text adapts to the facility type.
- **Scenario Player**: step-by-step decisions with feedback, hints, timed mode, and facilitator controls (pause, reveal).
- **Knowledge Quiz (25 questions)**: category filtering, explanations, and an 80% pass threshold.
- **Learning Center**: storyboard modules with uploaded or streamed video (Vercel Blob).
- **Rapid Challenge**: 75-second triage mini-game with a facility leaderboard.
- **Live Drill Control**: facilitator-run drills with phases, timer, roster, and announcements.
- **Reports**: attempt history, CSV export, and completion certificates.
- **AI Training Assistant**: Claude-powered HICS assistant (Gemini fallback), available to signed-in users only.
- **Facility Administration**: user provisioning, facility scoping, and audit log.

## Tech Stack

- React 19 + TypeScript + Vite, Tailwind CSS v4, React Router v7
- Vercel serverless functions (`api/`) with Upstash Redis for storage and rate limiting
- Vercel Blob for training video

## Local Development

```bash
npm install            # API dependencies (repo root)
cd hics-app
npm install
cp .env.example .env.local   # fill in what you need
npm run dev
```

Open <http://localhost:5173>. Without Redis configured, the API stores data in `.nyx-hics-store.json` (local development only; Vercel deployments refuse to run without Redis).

To exercise the API locally, run `vercel dev` from the repo root.

## Deploying (Vercel)

The app is deployed as one Vercel project: the Vite build is served statically and `api/` runs as serverless functions on the same origin. `vercel.json` sets the build, routing, and security headers.

1. Create an Upstash Redis database and a Vercel Blob store, and connect both to the project.
2. Set the environment variables listed in [`hics-app/.env.example`](hics-app/.env.example). `TOKEN_SIGNING_SECRET` and the Upstash variables are required.
3. Set `BOOTSTRAP_ADMIN_EMAILS` to your own address, sign in through SSO, and add users from **Admin → Add User**. Then clear the bootstrap variable.

The full go-live list is in [`hics-app/docs/ENTERPRISE_DEPLOYMENT_CHECKLIST.md`](hics-app/docs/ENTERPRISE_DEPLOYMENT_CHECKLIST.md).

### Provisioning users from the command line

```bash
# With production UPSTASH_* variables exported, or none for the local store
npm run create-user -- --email jordan.lee@hospital.org --name "Jordan Lee" \
  --role facility-admin --facility general-acute-care
```

Add `--password` to set a password for password sign-in (only used when `ALLOW_LOCAL_AUTH_FALLBACK=true`).

## Security Model

- **Sign-in**: Microsoft Entra ID or Okta through OIDC with PKCE. The server verifies the id_token signature, issuer, audience, and expiry. Optional password sign-in uses scrypt hashes.
- **Authorization**: roles and facilities come only from provisioned accounts; unknown users are refused. Every API route checks the signed token and a per-endpoint role policy in `api/_policy.js`.
- **Sessions**: 1-hour access tokens kept in `sessionStorage`; rotating refresh tokens kept in an httpOnly, Secure, SameSite=Strict cookie, with replay detection that revokes the whole session. The account is re-checked on every refresh.
- **Data integrity**: writes use Redis compare-and-set with retry, so concurrent requests can't overwrite each other.
- **Abuse limits**: rate limits are shared across all serverless instances through Redis; the AI assistant is limited per user.
- **Headers**: HSTS, a CSP with no inline scripts, `frame-ancestors 'none'`, and related headers.

Auth contract details are in [`hics-app/docs/ENTERPRISE_AUTH_EXCHANGE_CONTRACT.md`](hics-app/docs/ENTERPRISE_AUTH_EXCHANGE_CONTRACT.md).

## Testing

```bash
npm run test:api                 # repo root: auth, session, authorization, and store tests
cd hics-app
npm run lint
npm run build                    # includes TypeScript checks
npm run test:smoke:install       # first time only
npm run test:smoke               # Playwright smoke suite
```

GitHub Actions runs all of these on every pull request and push to `main` (`.github/workflows/ci.yml`).

## Ownership and Marks

NyxHICSlab is a product of NyxCollective LLC.

Copyright (c) 2026 NyxCollective LLC. All rights reserved.

NyxHICSlab, NyxCollective, and related names, logos, product marks, and design marks are trademarks of NyxCollective LLC.
