import type { Role } from './types';

/**
 * What each role can do. Anything a role can't do is left out of the page entirely:
 * no greyed-out Edit buttons, no locked menu items, no empty Settings group.
 */
export type Capability =
  | 'view'
  | 'checkOff'
  | 'markFinal'
  | 'changeDeadline'
  | 'editSectorContent'
  | 'reassignTasks'
  | 'manageSectors'
  | 'managePeople';

/** `all`: everything. `own`: tasks assigned to them. `led`: sectors they lead. */
export type Scope = 'all' | 'own' | 'led';

export interface Grant {
  scope: Scope;
  /** Label for the roles reference table. Defaults to "Yes". */
  label?: string;
}

export const ROLES: Role[] = ['admin', 'editor', 'crew'];

export const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', editor: 'Editor', crew: 'Crew' };

export const PERMISSIONS: { capability: Capability; label: string; grants: Record<Role, Grant | null> }[] = [
  {
    capability: 'view',
    label: 'View dashboard, sectors, tasks, team and print packets',
    grants: { admin: { scope: 'all' }, editor: { scope: 'all' }, crew: { scope: 'all' } }
  },
  {
    capability: 'checkOff',
    label: 'Check off material items and instruction steps',
    grants: { admin: { scope: 'all' }, editor: { scope: 'all' }, crew: { scope: 'all' } }
  },
  {
    capability: 'markFinal',
    label: 'Mark a list or instructions final (locks it), or unlock it',
    grants: {
      admin: { scope: 'all', label: 'Any task' },
      editor: { scope: 'own', label: 'Own tasks' },
      crew: { scope: 'own', label: 'Own tasks' }
    }
  },
  {
    capability: 'changeDeadline',
    label: 'Change a task deadline',
    grants: { admin: { scope: 'all', label: 'Any task' }, editor: { scope: 'own', label: 'Own tasks' }, crew: null }
  },
  {
    capability: 'editSectorContent',
    label: 'Upload and remove PDFs, write material lists, instructions and information',
    grants: { admin: { scope: 'all', label: 'All sectors' }, editor: { scope: 'led', label: 'Sectors they lead' }, crew: null }
  },
  {
    capability: 'reassignTasks',
    label: 'Reassign tasks, bulk reassign',
    grants: { admin: { scope: 'all' }, editor: null, crew: null }
  },
  {
    capability: 'manageSectors',
    label: 'Create, edit structure, archive and delete sectors',
    grants: { admin: { scope: 'all' }, editor: null, crew: null }
  },
  {
    capability: 'managePeople',
    label: 'People page: add, invite, deactivate, change roles',
    grants: { admin: { scope: 'all' }, editor: null, crew: null }
  }
];

const BY_CAPABILITY = new Map(PERMISSIONS.map((p) => [p.capability, p.grants]));

/**
 * Whether `role` may perform `capability`. For scoped grants pass what you know about the target:
 * `isOwnTask` for tasks, `leadsSector` for sector content. Without context, scoped grants answer
 * "somewhere" (true) — use that only to decide whether a whole page or menu item exists.
 */
export function can(role: Role, capability: Capability, ctx?: { isOwnTask?: boolean; leadsSector?: boolean }): boolean {
  const grant = BY_CAPABILITY.get(capability)?.[role];
  if (!grant) return false;
  if (grant.scope === 'all' || !ctx) return true;
  if (grant.scope === 'own') return !!ctx.isOwnTask;
  return !!ctx.leadsSector;
}
