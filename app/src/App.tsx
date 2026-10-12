import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { AccessIndex } from './pages/AccessIndex';
import { AcceptInvitation } from './pages/AcceptInvitation';
import { ForgotPassword } from './pages/ForgotPassword';
import { Home } from './pages/Home';
import { ResetPassword } from './pages/ResetPassword';
import { RolesReference } from './pages/RolesReference';
import { SignIn } from './pages/SignIn';

function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const location = useLocation();
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return children;
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
      <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
