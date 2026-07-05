// ──────────────────────────────────────────────────────────────────────────────
// LoanLens — Route Guards
// RequireAuth, RequireRole, roleRedirect map
// ──────────────────────────────────────────────────────────────────────────────

import { Navigate, useLocation } from 'react-router-dom';
import { type Role, roleRedirect } from '../types/auth';
import { useAuth } from '../hooks/useAuth';


// ── RequireAuth ───────────────────────────────────────────────────────────────
// Blocks unauthenticated users — redirects to /login
interface RequireAuthProps { children: React.ReactNode }

export function RequireAuth({ children }: RequireAuthProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="flex flex-col items-center gap-4">
          <div className="spinner spinner-brand spinner-lg" />
          <span className="text-secondary text-sm">Loading session…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

// ── RequireRole ───────────────────────────────────────────────────────────────
// Ensures the logged-in user has one of the allowed roles
// If not — redirects to their correct dashboard (prevents URL probing)
interface RequireRoleProps {
  children: React.ReactNode;
  allowedRoles: Role[];
}

export function RequireRole({ children, allowedRoles }: RequireRoleProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="spinner spinner-brand spinner-lg" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!allowedRoles.includes(user.role)) {
    const home = roleRedirect[user.role] ?? '/login';
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}
