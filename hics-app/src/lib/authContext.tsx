import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const AUTH_SESSION_KEY = 'nyx-auth-session';
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

interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  authMethod: 'password' | 'entra-oidc' | 'okta-oidc';
  expiresAt: number;
  lastActivityAt: number;
}

interface LoginSessionInput {
  user: AuthUser;
  accessToken: string;
  refreshToken?: string;
  authMethod: AuthSession['authMethod'];
  expiresInSeconds: number;
  remember: boolean;
}

interface RefreshSessionResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  expiresAt: number | null;
  sessionRemainingMs: number;
  loginSession: (payload: LoginSessionInput) => void;
  touchActivity: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): AuthSession | null {
  const raw = localStorage.getItem(AUTH_SESSION_KEY);
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => readStoredSession());
  const [now, setNow] = useState(() => Date.now());
  const sessionRef = useRef<AuthSession | null>(session);
  const refreshInFlightRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const loginSession = useCallback((payload: LoginSessionInput) => {
    const nextSession: AuthSession = {
      user: payload.user,
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      authMethod: payload.authMethod,
      expiresAt: Date.now() + payload.expiresInSeconds * 1000,
      lastActivityAt: Date.now(),
    };

    setSession(nextSession);
    setNow(Date.now());

    if (payload.remember) {
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(nextSession));
    } else {
      localStorage.removeItem(AUTH_SESSION_KEY);
    }
  }, []);

  const touchActivity = useCallback(() => {
    setSession((prev) => {
      if (!prev) {
        return prev;
      }

      const next = { ...prev, lastActivityAt: Date.now() };
      if (localStorage.getItem(AUTH_SESSION_KEY)) {
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(next));
      }
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    const refreshToken = sessionRef.current?.refreshToken;
    if (refreshToken) {
      void fetch(authApiPath('/auth/logout'), {
        // Revoke refresh token server-side to terminate session chain.
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {
        // Best-effort logout revocation.
      });
    }

    setSession(null);
    localStorage.removeItem(AUTH_SESSION_KEY);
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    const current = sessionRef.current;
    if (!current?.refreshToken) {
      return false;
    }

    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const refreshPromise = (async () => {
      try {
        const response = await fetch(authApiPath('/auth/refresh'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });

        if (!response.ok) {
          return false;
        }

        const payload = (await response.json()) as RefreshSessionResponse;
        if (!payload?.accessToken || !payload?.expiresIn) {
          return false;
        }

        setSession((prev) => {
          if (!prev) {
            return prev;
          }

          const nextSession: AuthSession = {
            ...prev,
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken || prev.refreshToken,
            expiresAt: Date.now() + payload.expiresIn * 1000,
            lastActivityAt: Date.now(),
          };

          if (localStorage.getItem(AUTH_SESSION_KEY)) {
            localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(nextSession));
          }

          return nextSession;
        });

        setNow(Date.now());
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlightRef.current = null;
      }
    })();

    refreshInFlightRef.current = refreshPromise;
    return refreshPromise;
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

    if ((tokenExpired || tokenNearExpiry) && session.refreshToken) {
      void refreshSession().then((ok) => {
        if (!ok && tokenExpired) {
          logout();
        }
      });
      return;
    }

    if (tokenExpired) {
      logout();
    }
  }, [session, now, refreshSession, logout]);

  const sessionRemainingMs = session ? Math.max(0, Math.min(session.expiresAt, session.lastActivityAt + INACTIVITY_LIMIT_MS) - now) : 0;

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    isAuthenticated,
    accessToken: session?.accessToken ?? null,
    expiresAt: session?.expiresAt ?? null,
    sessionRemainingMs,
    loginSession,
    touchActivity,
    logout,
  }), [session, isAuthenticated, sessionRemainingMs, loginSession, touchActivity, logout]);


  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
