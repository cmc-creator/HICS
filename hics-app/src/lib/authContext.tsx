import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AppUserRole } from '../types';

// The access token lives in sessionStorage (per tab, cleared when the tab closes).
// The refresh token never reaches JavaScript: the API keeps it in an httpOnly cookie.
const AUTH_SESSION_KEY = 'nyx-auth-session';
// Non-secret hint that a refresh cookie may exist, so anonymous visitors skip the restore call.
const SESSION_HINT_KEY = 'nyx-has-session';
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const REFRESH_LEEWAY_MS = 4 * 60 * 1000;

function authApiPath(path: string): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  if (!base) {
    return path;
  }

  const left = base.endsWith('/') ? base.slice(0, -1) : base;
  const right = path.startsWith('/') ? path : `/${path}`;
  return `${left}${right}`;
}

export interface AuthUser {
  fullName: string;
  email: string;
  organization: string;
  mfaEnabled: boolean;
  plan: 'enterprise' | 'trial';
}

type AuthMethod = 'password' | 'entra-oidc' | 'okta-oidc';

interface AuthSession {
  user: AuthUser;
  accessToken: string;
  authMethod: AuthMethod;
  role?: AppUserRole;
  facility?: string;
  expiresAt: number;
  lastActivityAt: number;
}

/** Shape returned by /auth/local-login, /auth/exchange, and /auth/refresh. */
export interface SessionResponse {
  accessToken: string;
  expiresIn: number;
  email: string;
  fullName: string;
  organization: string;
  role: AppUserRole;
  facility: string;
  authMethod?: AuthMethod;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isRestoring: boolean;
  accessToken: string | null;
  role: AppUserRole | null;
  facility: string | null;
  expiresAt: number | null;
  sessionRemainingMs: number;
  loginSession: (payload: SessionResponse, authMethod: AuthMethod) => void;
  touchActivity: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function safeStorage<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function readStoredSession(): AuthSession | null {
  const raw = safeStorage(() => sessionStorage.getItem(AUTH_SESSION_KEY), null);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.user?.email || !parsed.user?.organization || !parsed.accessToken || !parsed.expiresAt) {
      return null;
    }
    if (parsed.expiresAt <= Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function persistSession(session: AuthSession | null) {
  safeStorage(() => {
    if (session) {
      sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
      localStorage.setItem(SESSION_HINT_KEY, '1');
    } else {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      localStorage.removeItem(SESSION_HINT_KEY);
    }
  }, undefined);
}

function sessionFromResponse(payload: SessionResponse, authMethod: AuthMethod): AuthSession {
  return {
    user: {
      fullName: payload.fullName,
      email: payload.email,
      organization: payload.organization,
      mfaEnabled: true,
      plan: 'enterprise',
    },
    accessToken: payload.accessToken,
    authMethod: payload.authMethod ?? authMethod,
    role: payload.role,
    facility: payload.facility,
    expiresAt: Date.now() + payload.expiresIn * 1000,
    lastActivityAt: Date.now(),
  };
}

type RefreshResult = { ok: true; payload: SessionResponse } | { ok: false; retryable: boolean };

async function requestRefresh(): Promise<RefreshResult> {
  const send = () => fetch(authApiPath('/auth/refresh'), {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    let response = await send();
    if (response.status === 409) {
      // Another tab rotated the cookie a moment ago; the browser now holds the new one.
      await new Promise((resolve) => setTimeout(resolve, 400));
      response = await send();
    }

    if (!response.ok) {
      return { ok: false, retryable: response.status >= 500 || response.status === 409 || response.status === 429 };
    }

    const payload = (await response.json()) as SessionResponse;
    if (!payload?.accessToken || !payload?.expiresIn) {
      return { ok: false, retryable: false };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, retryable: true };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [isRestoring, setIsRestoring] = useState(
    () => !readStoredSession() && safeStorage(() => localStorage.getItem(SESSION_HINT_KEY) === '1', false),
  );
  const [now, setNow] = useState(() => Date.now());
  const sessionRef = useRef<AuthSession | null>(session);
  const refreshInFlightRef = useRef<Promise<RefreshResult> | null>(null);
  const lastRefreshAttemptRef = useRef(0);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const loginSession = useCallback((payload: SessionResponse, authMethod: AuthMethod) => {
    const nextSession = sessionFromResponse(payload, authMethod);
    setSession(nextSession);
    setNow(Date.now());
    persistSession(nextSession);
  }, []);

  const touchActivity = useCallback(() => {
    setSession((prev) => {
      if (!prev) {
        return prev;
      }

      const next = { ...prev, lastActivityAt: Date.now() };
      persistSession(next);
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    if (sessionRef.current) {
      // Revoke the refresh cookie server-side to terminate the session chain.
      void fetch(authApiPath('/auth/logout'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {
        // Best-effort logout revocation.
      });
    }

    setSession(null);
    persistSession(null);
  }, []);

  const refreshSession = useCallback(async (): Promise<RefreshResult> => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const refreshPromise = requestRefresh().then((result) => {
      if (result.ok) {
        setSession((prev) => {
          const base = sessionFromResponse(result.payload, prev?.authMethod ?? 'password');
          const next = prev ? { ...base, lastActivityAt: prev.lastActivityAt } : base;
          persistSession(next);
          return next;
        });
        setNow(Date.now());
      }
      return result;
    }).finally(() => {
      refreshInFlightRef.current = null;
    });

    refreshInFlightRef.current = refreshPromise;
    return refreshPromise;
  }, []);

  // Restore a session from the refresh cookie after a reload or in a new tab.
  useEffect(() => {
    if (!isRestoring) {
      return;
    }

    void refreshSession().then((result) => {
      if (!result.ok && !result.retryable) {
        persistSession(null);
      }
      setIsRestoring(false);
    });
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [session]);

  // Derive a stable boolean so this effect only fires on login/logout, not on every activity event.
  const isAuthenticated = !!session;

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const events: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove', 'touchstart'];
    const handler = () => touchActivity();
    events.forEach((eventName) => window.addEventListener(eventName, handler, { passive: true }));

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handler));
    };
  }, [isAuthenticated, touchActivity]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const inactiveTooLong = now - session.lastActivityAt > INACTIVITY_LIMIT_MS;
    if (inactiveTooLong) {
      logout();
      return;
    }

    const tokenExpired = now >= session.expiresAt;
    const tokenNearExpiry = session.expiresAt - now <= REFRESH_LEEWAY_MS;

    if (tokenExpired || tokenNearExpiry) {
      // Retry transient failures every 30s rather than on every 1s tick.
      if (refreshInFlightRef.current || now - lastRefreshAttemptRef.current < 30 * 1000) {
        return;
      }
      lastRefreshAttemptRef.current = now;
      void refreshSession().then((result) => {
        if (!result.ok && (tokenExpired || !result.retryable)) {
          logout();
        }
      });
    }
  }, [session, now, refreshSession, logout]);

  const sessionRemainingMs = session ? Math.max(0, Math.min(session.expiresAt, session.lastActivityAt + INACTIVITY_LIMIT_MS) - now) : 0;

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    isAuthenticated,
    isRestoring,
    accessToken: session?.accessToken ?? null,
    role: session?.role ?? null,
    facility: session?.facility ?? null,
    expiresAt: session?.expiresAt ?? null,
    sessionRemainingMs,
    loginSession,
    touchActivity,
    logout,
  }), [session, isAuthenticated, isRestoring, sessionRemainingMs, loginSession, touchActivity, logout]);


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Provider and hook share a module by design; fast refresh reloads this file fully.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
