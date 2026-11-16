export function normalizePath(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!base) {
    return path;
  }

  const left = base.endsWith('/') ? base.slice(0, -1) : base;
  const right = path.startsWith('/') ? path : `/${path}`;
  // A caller may hand over a path that already includes the base:
  // the OIDC exchange endpoint is configured with the full path
  // '/api/auth/exchange'. Joining blindly produced
  // '/api/api/auth/exchange' and a 404 on the sign-in callback -
  // that is what broke Google sign-in until 2026-11-16.
  if (right === left || right.startsWith(`${left}/`)) {
    return right;
  }
  return `${left}${right}`;
}

function getSessionAccessToken(): string | null {
  try {
    const raw = localStorage.getItem('nyx-auth-session');
    if (!raw) {
      return null;
    }
    const session = JSON.parse(raw) as { accessToken?: string };
    return typeof session.accessToken === 'string' ? session.accessToken : null;
  } catch {
    return null;
  }
}

function getTenantHeaderContext() {
  try {
    const role = localStorage.getItem('nyx-tenant-role') ?? '';
    const facility = localStorage.getItem('nyx-tenant-facility') ?? '';
    const authRaw = localStorage.getItem('nyx-auth-session');
    const organization = authRaw
      ? (JSON.parse(authRaw) as { user?: { organization?: string } }).user?.organization ?? ''
      : '';

    return {
      role,
      facility,
      organization,
    };
  } catch {
    return {
      role: '',
      facility: '',
      organization: '',
    };
  }
}

export function hasConfiguredApiBaseUrl(): boolean {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  return !!base;
}

export async function publicApiRequest<T>(
  path: string,
  options: RequestInit,
): Promise<T> {
  const token = getSessionAccessToken();
  const tenant = getTenantHeaderContext();

  const response = await fetch(normalizePath(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenant.role ? { 'x-tenant-role': tenant.role } : {}),
      ...(tenant.facility ? { 'x-tenant-facility': tenant.facility } : {}),
      ...(tenant.organization ? { 'x-tenant-organization': tenant.organization } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    // Surface the server's own error message when it sends one
    // (for example "Invalid email or password." from local login)
    // instead of a bare status code.
    let message = `API request failed with status ${response.status}`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string' && payload.error) {
        message = payload.error;
      }
    } catch {
      // Keep the generic message when the body is not JSON.
    }
    // Carry the HTTP status on the error so callers can tell a
    // server refusal (show its message) from a network failure,
    // and so health probes can assert on the status itself.
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
