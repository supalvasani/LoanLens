import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RequireAuth, RequireRole, roleRedirect } from './utils/routeGuard';

import LoginPage        from './pages/LoginPage';
import RegisterPage     from './pages/RegisterPage';

// Portal (Applicant)
import PortalDashboard from './pages/portal/Dashboard';
import PortalApply     from './pages/portal/Apply';
import PortalScore     from './pages/portal/Score';
import PortalEligibility from './pages/portal/Eligibility';

// Admin
import AdminDashboard from './pages/admin/Dashboard';

// Manager
import ManagerDashboard from './pages/manager/Dashboard';
import ManagerPortfolio from './pages/manager/Portfolio';

// Analyst
import AnalystDashboard from './pages/analyst/Dashboard';

// Root redirect
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
          {/* Public */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Portal (Applicant) */}
          <Route path="/portal/dashboard" element={<RequireAuth><RequireRole allowedRoles={['applicant']}><PortalDashboard /></RequireRole></RequireAuth>} />
          <Route path="/portal/apply"     element={<RequireAuth><RequireRole allowedRoles={['applicant']}><PortalApply /></RequireRole></RequireAuth>} />
          <Route path="/portal/score"     element={<RequireAuth><RequireRole allowedRoles={['applicant']}><PortalScore /></RequireRole></RequireAuth>} />
          <Route path="/portal/eligibility" element={<RequireAuth><RequireRole allowedRoles={['applicant']}><PortalEligibility /></RequireRole></RequireAuth>} />
          
          {/* Support Chat Placeholder */}
          <Route path="/portal/chatbot" element={<RequireAuth><RequireRole allowedRoles={['applicant']}><PortalDashboard /></RequireRole></RequireAuth>} />

          {/* Admin */}
          <Route path="/admin/dashboard" element={<RequireAuth><RequireRole allowedRoles={['admin']}><AdminDashboard /></RequireRole></RequireAuth>} />
          {/* Placeholders for admin sub-routes to avoid 404s for now */}
          <Route path="/admin/*" element={<RequireAuth><RequireRole allowedRoles={['admin']}><AdminDashboard /></RequireRole></RequireAuth>} />

          {/* Manager */}
          <Route path="/manager/dashboard" element={<RequireAuth><RequireRole allowedRoles={['manager']}><ManagerDashboard /></RequireRole></RequireAuth>} />
          <Route path="/manager/portfolio" element={<RequireAuth><RequireRole allowedRoles={['manager']}><ManagerPortfolio /></RequireRole></RequireAuth>} />
          {/* Placeholders for manager sub-routes */}
          <Route path="/manager/*" element={<RequireAuth><RequireRole allowedRoles={['manager']}><ManagerDashboard /></RequireRole></RequireAuth>} />

          {/* Analyst */}
          <Route path="/analyst/dashboard" element={<RequireAuth><RequireRole allowedRoles={['analyst']}><AnalystDashboard /></RequireRole></RequireAuth>} />
          {/* Placeholders for analyst sub-routes */}
          <Route path="/analyst/*" element={<RequireAuth><RequireRole allowedRoles={['analyst']}><AnalystDashboard /></RequireRole></RequireAuth>} />

          {/* Root */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
