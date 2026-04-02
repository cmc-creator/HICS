import { publicApiRequest } from './apiClient';

export type OidcProvider = 'entra' | 'okta';

const STATE_KEY = 'nyx-oidc-state';
const VERIFIER_KEY = 'nyx-oidc-verifier';
const PROVIDER_KEY = 'nyx-oidc-provider';

interface ProviderConfig {
  name: string;
  clientId: string;
  authorizeEndpoint: string;
  tokenExchangeEndpoint: string;
  scope: string;
}

interface OidcExchangeResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  email: string;
  fullName: string;
  organization: string;
}

function getProviderConfig(provider: OidcProvider): ProviderConfig {
  const prefix = provider === 'entra' ? 'VITE_OIDC_ENTRA' : 'VITE_OIDC_OKTA';
  return {
    name: provider === 'entra' ? 'Microsoft Entra ID' : 'Okta',
    clientId: (import.meta.env[`${prefix}_CLIENT_ID`] as string) ?? '',
    authorizeEndpoint: (import.meta.env[`${prefix}_AUTHORIZE_URL`] as string) ?? '',
    tokenExchangeEndpoint: (import.meta.env.VITE_AUTH_EXCHANGE_ENDPOINT as string) ?? '',
    scope: (import.meta.env[`${prefix}_SCOPE`] as string) ?? 'openid profile email',
  };
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(digest));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function beginOidcLogin(provider: OidcProvider, redirectUri: string): Promise<void> {
  const config = getProviderConfig(provider);
  if (!config.clientId || !config.authorizeEndpoint) {
    throw new Error(`OIDC provider ${config.name} is not configured.`);
  }

  const state = randomString(32);
  const verifier = randomString(96);
  const challenge = await createCodeChallenge(verifier);

  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(PROVIDER_KEY, provider);

  const url = new URL(config.authorizeEndpoint);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', config.scope);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  window.location.assign(url.toString());
}

export function getStoredOidcProvider(): OidcProvider {
  const stored = sessionStorage.getItem(PROVIDER_KEY);
  return stored === 'okta' ? 'okta' : 'entra';
}

export function validateOidcState(state: string): boolean {
  const expected = sessionStorage.getItem(STATE_KEY);
  return !!expected && expected === state;
}

export async function exchangeOidcCode(provider: OidcProvider, code: string, redirectUri: string): Promise<OidcExchangeResult> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY) ?? '';
  const config = getProviderConfig(provider);

  const allowLocalFallback = (import.meta.env.VITE_ALLOW_LOCAL_AUTH_FALLBACK as string | undefined) === 'true';

  if (!config.tokenExchangeEndpoint) {
    if (!allowLocalFallback) {
      throw new Error('OIDC token exchange endpoint is not configured. Set VITE_AUTH_EXCHANGE_ENDPOINT.');
    }

    return {
      accessToken: `oidc-${provider}-${randomString(24)}`,
      refreshToken: randomString(32),
      expiresIn: 3600,
      email: provider === 'okta' ? 'admin@healthsystem.com' : 'it.admin@healthsystem.com',
      fullName: provider === 'okta' ? 'Okta Administrator' : 'Entra Administrator',
      organization: 'Enterprise Health System',
    };
  }

  return publicApiRequest<OidcExchangeResult>(config.tokenExchangeEndpoint, {
    method: 'POST',
    body: JSON.stringify({ provider, code, codeVerifier: verifier, redirectUri }),
  });
}
