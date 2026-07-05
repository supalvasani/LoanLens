import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import { RequireAuth, RequireRole } from './utils/routeGuard';

import LoginPage    from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// ── Portal (Applicant) ────────────────────────────────────────────────────────────────────────────────
const PortalDashboard   = lazy(() => import('./pages/portal/Dashboard'));
const PortalApply       = lazy(() => import('./pages/portal/Apply'));
const PortalScore       = lazy(() => import('./pages/portal/Score'));
const PortalEligibility = lazy(() => import('./pages/portal/Eligibility'));
const PortalChatbot     = lazy(() => import('./pages/portal/Chatbot'));
const PortalStatements  = lazy(() => import('./pages/portal/Statements'));

// ── Admin ────────────────────────────────────────────────────────────────────
import AdminDashboard   from './pages/AdminDashboard';
import AdminUsers       from './pages/admin/Users';
import AdminConfig      from './pages/admin/Config';
import AdminAuditLog    from './pages/admin/AuditLog';

// ── Manager ──────────────────────────────────────────────────────────────────
import ManagerDashboard from './pages/manager/Dashboard';
import ManagerPortfolio from './pages/manager/Portfolio';
import ManagerQueue     from './pages/manager/Queue';
import ManagerApplicationDetail from './pages/manager/ApplicationDetail';
import ManagerConfig     from './pages/manager/Config';

// ── Analyst ──────────────────────────────────────────────────────────────────
import AnalystDashboard       from './pages/analyst/Dashboard';
import AnalystQueue           from './pages/analyst/Queue';
import ApplicationDetail      from './pages/analyst/ApplicationDetail';
import AnalystChatbot         from './pages/analyst/Chatbot';

// ── Root redirect ─────────────────────────────────────────────────────────────
function RootRedirect() {
  const { isAuthenticated, user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  return <Navigate to={roleRedirect[user.role] ?? '/login'} replace />;
}

import { type Role, roleRedirect } from './types/auth';


// ── Route wrapper helper ───────────────────────────────────────────────────────
function R({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  return (
    <RequireAuth>
      <RequireRole allowedRoles={roles}>{children}</RequireRole>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* ── Portal (Applicant) ── */}
          <Route path="/portal/dashboard"  element={<R roles={['applicant']}><Suspense fallback={null}><PortalDashboard /></Suspense></R>} />
          <Route path="/portal/apply"      element={<R roles={['applicant']}><Suspense fallback={null}><PortalApply /></Suspense></R>} />
          <Route path="/portal/score"      element={<R roles={['applicant']}><Suspense fallback={null}><PortalScore /></Suspense></R>} />
          <Route path="/portal/eligibility" element={<R roles={['applicant']}><Suspense fallback={null}><PortalEligibility /></Suspense></R>} />
          <Route path="/portal/chatbot"    element={<R roles={['applicant']}><Suspense fallback={null}><PortalChatbot /></Suspense></R>} />
          <Route path="/portal/statements" element={<R roles={['applicant']}><Suspense fallback={null}><PortalStatements /></Suspense></R>} />

          {/* ── Admin ── */}
          <Route path="/admin/dashboard"   element={<R roles={['admin']}><AdminDashboard /></R>} />
          <Route path="/admin/users"       element={<R roles={['admin']}><AdminUsers /></R>} />
          <Route path="/admin/config"      element={<R roles={['admin']}><AdminConfig /></R>} />
          <Route path="/admin/audit"       element={<R roles={['admin']}><AdminAuditLog /></R>} />
          {/* Fallback for unbuilt admin sub-pages */}
          <Route path="/admin/*"           element={<R roles={['admin']}><AdminDashboard /></R>} />

          {/* ── Manager ── */}
          <Route path="/manager/dashboard" element={<R roles={['manager']}><ManagerDashboard /></R>} />
          <Route path="/manager/portfolio" element={<R roles={['manager']}><ManagerPortfolio /></R>} />
          <Route path="/manager/queue"     element={<R roles={['manager']}><ManagerQueue /></R>} />
          <Route path="/manager/applications/:id" element={<R roles={['manager']}><ManagerApplicationDetail /></R>} />
          <Route path="/manager/config"    element={<R roles={['manager']}><ManagerConfig /></R>} />
          <Route path="/manager/*"         element={<R roles={['manager']}><ManagerDashboard /></R>} />

          {/* ── Analyst ── */}
          <Route path="/analyst/dashboard"              element={<R roles={['analyst']}><AnalystDashboard /></R>} />
          <Route path="/analyst/queue"                  element={<R roles={['analyst']}><AnalystQueue /></R>} />
          <Route path="/analyst/applications/:id"       element={<R roles={['analyst']}><ApplicationDetail /></R>} />
          <Route path="/analyst/chatbot"                element={<R roles={['analyst']}><AnalystChatbot /></R>} />
          <Route path="/analyst/*"                      element={<R roles={['analyst']}><AnalystDashboard /></R>} />

          {/* Root */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
