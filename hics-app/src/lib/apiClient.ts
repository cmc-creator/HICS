function normalizePath(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!base) {
    return path;
  }

  const left = base.endsWith('/') ? base.slice(0, -1) : base;
  const right = path.startsWith('/') ? path : `/${path}`;
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
    throw new Error(`API request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit,
  accessToken: string,
  onUnauthorized: () => void,
): Promise<T> {
  const response = await fetch(normalizePath(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    onUnauthorized();
    throw new Error('Session expired. Please sign in again.');
  }

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
