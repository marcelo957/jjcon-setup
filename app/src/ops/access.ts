import { useAuth } from '../auth/AuthContext';
import { can } from '../auth/permissions';
import type { Sector } from './data/types';

/** The signed-in person and what their role lets them do here. Anything they can't do is left out of the page. */
export function useMe() {
  const { session, signOut } = useAuth();
  if (!session) throw new Error('useMe needs a signed-in session');
  const role = session.role;
  const leads = (s: Sector) => s.leadId === session.personId || s.ownerId === session.personId;
  return {
    session, signOut, id: session.personId, role,
    canManageSectors: can(role, 'manageSectors'),
    canEditSector: (s: Sector) => can(role, 'editSectorContent', { leadsSector: leads(s) }),
    canCheckOff: can(role, 'checkOff'),
    /** Mark a written block final, or unlock it: the responsible person, or an admin. */
    canMarkFinal: (who: string) => can(role, 'markFinal', { isOwnTask: who === session.personId }),
    canSetDeadline: (who: string) => can(role, 'changeDeadline', { isOwnTask: who === session.personId }),
    canReassign: can(role, 'reassignTasks'),
    canManagePeople: can(role, 'managePeople')
  };
}
