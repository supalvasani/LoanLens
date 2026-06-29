// ──────────────────────────────────────────────────────────────────────────────
// LoanLens — App Entry: React Router + Auth Guards
// ──────────────────────────────────────────────────────────────────────────────

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RequireAuth, RequireRole, roleRedirect } from './utils/routeGuard';

import LoginPage        from './pages/LoginPage';
import RegisterPage     from './pages/RegisterPage';
import AdminDashboard   from './pages/AdminDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import AnalystDashboard from './pages/AnalystDashboard';
import ApplicantDashboard from './pages/ApplicantDashboard';

// Root redirect — authenticated users go to their role's home
function RootRedirect() {
  const { isAuthenticated, user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  return <Navigate to={roleRedirect[user.role] ?? '/login'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Role-protected dashboard routes */}
          <Route
            path="/dashboard/admin"
            element={
              <RequireAuth>
                <RequireRole allowedRoles={['admin']}>
                  <AdminDashboard />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/manager"
            element={
              <RequireAuth>
                <RequireRole allowedRoles={['manager']}>
                  <ManagerDashboard />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/analyst"
            element={
              <RequireAuth>
                <RequireRole allowedRoles={['analyst']}>
                  <AnalystDashboard />
                </RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/dashboard/applicant"
            element={
              <RequireAuth>
                <RequireRole allowedRoles={['applicant']}>
                  <ApplicantDashboard />
                </RequireRole>
              </RequireAuth>
            }
          />

          {/* Root → smart redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* 404 catch-all → root */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
