import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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
    void service.signOut?.();
  }, [service]);

  // Re-check the session when the app opens and whenever the tab comes back: a role change
  // applies on the next page, and deactivation or "sign out of all devices" ends it.
  const sessionKey = session ? `${session.personId}|${session.issuedAt}` : '';
  useEffect(() => {
    if (!session) return;
    let live = true;
    const check = () => {
      const current = loadSession();
      if (!current) return;
      service.checkSession(current).then((next) => {
        if (!live) return;
        if (!next) { clearSession(); setSession(null); }
        else if (next !== current) { saveSession(next); setSession(next); }
      });
    };
    check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { live = false; document.removeEventListener('visibilitychange', onVisible); };
  }, [service, sessionKey]);

  const value = useMemo(() => ({ service, session, startSession, signOut }), [service, session, startSession, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
