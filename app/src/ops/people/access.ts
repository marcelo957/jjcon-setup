import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { ROLE_LABEL } from '../../auth/permissions';
import type { AccessInfo, LoginState } from '../../auth/types';
import { dateLabel } from '../data/selectors';
import type { Person } from '../data/types';

/** Login info for everyone, from the auth service. `refresh` after any access action. */
export function useAccessList() {
  const { service } = useAuth();
  const [list, setList] = useState<AccessInfo[] | null>(null);
  const refresh = useCallback(() => { service.access.listAccess().then(setList, () => setList([])); }, [service]);
  useEffect(() => { refresh(); }, [refresh]);
  return { list, refresh, admin: service.access };
}

export interface AccessView {
  state: LoginState;
  label: string;
  sub: string;
  /** Has a role worth showing: can sign in, or invited. */
  hasRole: boolean;
}

const time = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export function accessOf(p: Person, a: AccessInfo | undefined): AccessView {
  if (!p.active) return { state: 'deactivated', label: 'Login removed', sub: 'Deactivated. Cannot sign in; history is kept.', hasRole: false };
  if (a?.login === 'active') {
    return { state: 'active', label: 'Can sign in', sub: a.lastSignInAt ? `Last signed in ${dateLabel(a.lastSignInAt)} ${time(a.lastSignInAt)}` : 'Has not signed in yet', hasRole: true };
  }
  if (a?.login === 'invited' && a.invitation) {
    const i = a.invitation;
    return {
      state: 'invited', label: 'Invited', hasRole: true,
      sub: `Sent ${dateLabel(i.sentAt)} by ${i.sentBy} · ${i.expired ? `expired ${dateLabel(i.expiresAt)}` : `expires ${dateLabel(i.expiresAt)}`}`
    };
  }
  return { state: 'none', label: 'No login', sub: p.email ? 'Assignable only. Not invited yet.' : 'Assignable only. No email on file.', hasRole: false };
}

export const ROLE_DESC = {
  admin: 'Full access. Creates and edits sectors, uploads PDFs, manages people, sends invitations and assigns roles.',
  editor: 'Edits the sectors they lead: PDFs, material lists, instructions and their own task deadlines. Cannot manage people or create sectors.',
  crew: 'Read-only. Checks off material items and instruction steps, and marks their own tasks done.'
} as const;

export { ROLE_LABEL };
