import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const AUTH_SESSION_KEY = 'nyx-auth-session';
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;

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

  const loginSession = (payload: LoginSessionInput) => {
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
  };

  const touchActivity = () => {
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
  };

  const logout = () => {
    setSession(null);
    localStorage.removeItem(AUTH_SESSION_KEY);
  };

  useEffect(() => {
    if (!session) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const events: Array<keyof WindowEventMap> = ['click', 'keydown', 'mousemove', 'touchstart'];
    const handler = () => touchActivity();
    events.forEach((eventName) => window.addEventListener(eventName, handler, { passive: true }));

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, handler));
    };
  }, [session]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const inactiveTooLong = now - session.lastActivityAt > INACTIVITY_LIMIT_MS;
    const tokenExpired = now >= session.expiresAt;
    if (inactiveTooLong || tokenExpired) {
      logout();
    }
  }, [session, now]);

  const sessionRemainingMs = session ? Math.max(0, Math.min(session.expiresAt, session.lastActivityAt + INACTIVITY_LIMIT_MS) - now) : 0;

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    isAuthenticated: !!session,
    accessToken: session?.accessToken ?? null,
    expiresAt: session?.expiresAt ?? null,
    sessionRemainingMs,
    loginSession,
    touchActivity,
    logout,
  }), [session, sessionRemainingMs]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
