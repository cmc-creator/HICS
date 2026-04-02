# Enterprise Deployment Checklist

## 1. Environment Configuration

- Copy `.env.example` to deployment environment variables
- Set `VITE_API_BASE_URL` to production API gateway
- Set `VITE_AUTH_EXCHANGE_ENDPOINT` to backend auth exchange endpoint
- Configure Entra and Okta client ids, authorize URLs, and scopes
- Ensure `VITE_ALLOW_LOCAL_AUTH_FALLBACK=false` and `VITE_ALLOW_LOCAL_LEAD_FALLBACK=false` in production

Recommended same-origin values for this repo:
- `VITE_API_BASE_URL=/api`
- `VITE_AUTH_EXCHANGE_ENDPOINT=/api/auth/exchange`

## 2. Identity Provider Setup

- Register redirect URI: `https://<app-domain>/auth/callback`
- Enable PKCE (S256)
- Enforce MFA and conditional access rules
- Map directory groups to app roles (enterprise-admin, facility-admin, training-manager, facilitator, observer)

## 3. Backend Auth Exchange

- Implement `/auth/exchange` per `ENTERPRISE_AUTH_EXCHANGE_CONTRACT.md`
- Validate authorization code with provider
- Issue app access token and refresh token
- Include tenant and role claims in token payload

This repository now includes an implementation scaffold at:
- `api/auth/exchange.js`

## 3b. Sales Lead Intake API

- Implement `POST /sales/leads` on the same API base URL
- Validate required fields: name, email, organization
- Persist lead with timestamp and source context
- Return `201` on successful lead creation

This repository now includes an implementation scaffold at:
- `api/sales/leads.js`

## 4. App Security Controls

- Enforce HTTPS only
- Add CSP, HSTS, and secure headers at edge
- Enable structured auth and audit logging
- Configure token expiration and session idle timeout

## 5. Go-Live Verification

- SSO login success for Entra and Okta users
- Unauthorized API calls force logout and redirect
- Session idle timeout logs out correctly
- Role-based routes and actions behave as expected
- Demo request funnel posts to `/sales/leads` and routes correctly

## 6. Legal and Product Branding

- Landing page includes NyxCollective LLC product statement
- Copyright and trademark notice displayed
- Brand assets and logo are loaded and visible on desktop and mobile
