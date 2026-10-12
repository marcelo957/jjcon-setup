import type { Person, Session } from './types';

const KEY = 'jjcon.session';
export const KEEP_SIGNED_IN_DAYS = 30;

export function createSession(person: Person & { email: string }, keep: boolean, now = new Date()): Session {
  return {
    personId: person.id,
    name: person.name,
    email: person.email,
    role: person.role,
    keep,
    expiresAt: keep ? new Date(now.getTime() + KEEP_SIGNED_IN_DAYS * 86_400_000).toISOString() : null
  };
}

function read(storage: Storage): Session | null {
  try {
    const raw = storage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/** A kept session lives in localStorage for 30 days; otherwise sessionStorage, which ends with the browser. */
export function saveSession(session: Session) {
  clearSession();
  (session.keep ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(session));
}

export function loadSession(now = new Date()): Session | null {
  const s = read(sessionStorage) ?? read(localStorage);
  if (!s) return null;
  if (s.expiresAt && new Date(s.expiresAt) <= now) {
    clearSession();
    return null;
  }
  return s;
}

export function clearSession() {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}
