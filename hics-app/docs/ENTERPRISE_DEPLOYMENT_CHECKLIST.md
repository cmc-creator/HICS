# Enterprise Deployment Checklist

NyxHICSlab deploys to Vercel: the Vite app is served statically and `api/` runs as serverless functions on the same origin.

## 1. Required Environment Variables

Copy every value from `hics-app/.env.example` into the Vercel project settings. At minimum:

- `TOKEN_SIGNING_SECRET`: long random value (`openssl rand -base64 48`)
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: the API refuses to start on Vercel without them
- `BOOTSTRAP_ADMIN_EMAILS`: your first administrator, until real accounts exist
- `ALLOW_LOCAL_AUTH_FALLBACK=false` unless you deliberately use password accounts
- `VITE_API_BASE_URL=/api` and `VITE_AUTH_EXCHANGE_ENDPOINT=/api/auth/exchange`

## 2. Identity Provider Setup

- Register redirect URI `https://<app-domain>/auth/callback` and set `ALLOWED_OIDC_REDIRECT_URI` to the same value
- Enable PKCE (S256)
- Enforce MFA and conditional access rules in the IdP
- Set the server-side `OIDC_*` variables (token URL, JWKS URL, issuer, client id/secret) and the client-side `VITE_OIDC_*` variables

## 3. Provision Users

Roles are assigned in NyxHICSlab, not inferred from email addresses.

1. Sign in once as a `BOOTSTRAP_ADMIN_EMAILS` address.
2. Add users from **Admin → Add User** (enterprise-admin, facility-admin, training-manager, facilitator, observer).
3. Remove the bootstrap address from `BOOTSTRAP_ADMIN_EMAILS` once a real enterprise admin account exists.

For scripted setup, run `npm run create-user -- --email ... --name ... --role ... --facility ...` from the repo root with the production Redis variables exported.

## 4. App Security Controls (already in this repo)

- HSTS, CSP without inline scripts, frame denial, and other headers in `vercel.json`
- Refresh tokens in httpOnly, Secure, SameSite=Strict cookies; access tokens expire after 1 hour
- Rate limits shared across serverless instances through Redis
- Audit log for sign-ins, session rotation and replay detection, and data changes

## 5. Go-Live Verification

- SSO sign-in works for a provisioned Entra or Okta user; an unprovisioned user sees the "not provisioned" message
- Reloading the page keeps you signed in; signing out ends the session in every tab
- Role-based routes and actions behave as expected
- The AI assistant answers when signed in and returns 401 when called anonymously
- The Health page shows `durable: true` for the datastore
- Demo request funnel posts to `/api/sales/leads`

## 6. Legal and Product Branding

- Landing page includes NyxCollective LLC product statement
- Copyright and trademark notice displayed
- Brand assets and logo are loaded and visible on desktop and mobile
