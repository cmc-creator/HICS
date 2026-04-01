import { createContext, useContext, useMemo, useState } from 'react';

const AUTH_USER_KEY = 'nyx-auth-user';

export interface AuthUser {
  fullName: string;
  email: string;
  organization: string;
  mfaEnabled: boolean;
  plan: 'enterprise' | 'trial';
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (payload: AuthUser, remember: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthUser;
    if (!parsed.email || !parsed.organization) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  const login = (payload: AuthUser, remember: boolean) => {
    setUser(payload);
    if (remember) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(payload));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_USER_KEY);
  };

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: !!user,
    login,
    logout,
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
