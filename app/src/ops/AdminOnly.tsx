import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useMe } from './access';

/** People management is admin only. Anyone else never sees it, and a typed URL lands on the dashboard. */
export function AdminOnly({ children }: { children: ReactNode }) {
  const me = useMe();
  return me.canManagePeople ? children : <Navigate to="/prep" replace />;
}
