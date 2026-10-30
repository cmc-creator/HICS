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

export function getSessionAccessToken(): string | null {
  try {
    const raw = sessionStorage.getItem('nyx-auth-session');
    if (!raw) {
      return null;
    }
    const session = JSON.parse(raw) as { accessToken?: string };
    return typeof session.accessToken === 'string' ? session.accessToken : null;
  } catch {
    return null;
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

  // Role and facility are taken from the signed token server-side; no tenant headers are sent.
  const response = await fetch(normalizePath(path), {
    ...options,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `API request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { error?: unknown };
      if (typeof body?.error === 'string') {
        message = body.error;
      }
    } catch {
      // Non-JSON error body; keep the status message.
    }
    throw new Error(message);
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
