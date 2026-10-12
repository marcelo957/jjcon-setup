import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AccessIndex } from './pages/AccessIndex';
import { AcceptInvitation } from './pages/AcceptInvitation';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { RolesReference } from './pages/RolesReference';
import { SignIn } from './pages/SignIn';

// The console (and the Bushido bundle it uses) loads after sign-in, so the sign-in and
// invitation pages stay light on a phone.
const Shell = lazy(() => import('./ops/Shell').then((m) => ({ default: m.Shell })));
const PrepDashboard = lazy(() => import('./ops/screens/PrepDashboard').then((m) => ({ default: m.PrepDashboard })));
const SectorIndex = lazy(() => import('./ops/screens/SectorIndex').then((m) => ({ default: m.SectorIndex })));
const SectorPage = lazy(() => import('./ops/screens/SectorPage').then((m) => ({ default: m.SectorPage })));
const TasksPage = lazy(() => import('./ops/screens/TasksPage').then((m) => ({ default: m.TasksPage })));
const TeamPage = lazy(() => import('./ops/screens/TeamPage').then((m) => ({ default: m.TeamPage })));
const PeoplePage = lazy(() => import('./ops/people/PeoplePage').then((m) => ({ default: m.PeoplePage })));
const PersonPage = lazy(() => import('./ops/people/PersonPage').then((m) => ({ default: m.PersonPage })));
const AdminOnly = lazy(() => import('./ops/AdminOnly').then((m) => ({ default: m.AdminOnly })));
const SectorForm = lazy(() => import('./ops/screens/SectorForm').then((m) => ({ default: m.SectorForm })));

function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search + location.hash }} />;
  return <Suspense fallback={<div style={{ padding: 24 }} role="status">Loading JJCON SetUp…</div>}>{children}</Suspense>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/invite/:token" element={<AcceptInvitation />} />
      <Route path="/access" element={<AccessIndex />} />
      <Route path="/access/roles" element={<RolesReference />} />
      <Route element={<RequireAuth><Shell /></RequireAuth>}>
        <Route path="/prep" element={<PrepDashboard />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/people" element={<AdminOnly><PeoplePage /></AdminOnly>} />
        <Route path="/people/:id" element={<AdminOnly><PersonPage /></AdminOnly>} />
        <Route path="/sectors" element={<SectorIndex />} />
        <Route path="/sectors/new" element={<SectorForm mode="create" />} />
        <Route path="/sectors/:id" element={<SectorPage />} />
        <Route path="/sectors/:id/edit" element={<SectorForm mode="edit" />} />
      </Route>
      <Route path="*" element={<Navigate to="/prep" replace />} />
    </Routes>
  );
}
