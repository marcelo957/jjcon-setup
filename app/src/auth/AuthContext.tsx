import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { clearSession, loadSession, saveSession } from './session';
import type { AuthService, Session } from './types';

interface AuthContextValue {
  service: AuthService;
  session: Session | null;
  /** Store a session returned by the service and mark the person signed in. */
  startSession(session: Session): void;
  signOut(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ service, children }: { service: AuthService; children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  const startSession = useCallback((s: Session) => {
    saveSession(s);
    setSession(s);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const value = useMemo(() => ({ service, session, startSession, signOut }), [service, session, startSession, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
