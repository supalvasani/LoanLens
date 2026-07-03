import { type ReactNode } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../types/auth';

const navByRole: Record<Role, { icon: string; label: string; path: string }[]> = {
  admin: [
    { icon: '◈', label: 'Dashboard',    path: '/admin/dashboard' },
    { icon: '◉', label: 'Users',        path: '/admin/users' },
    { icon: '◎', label: 'Applications', path: '/admin/applications' },
    { icon: '◇', label: 'Config',       path: '/admin/config' },
    { icon: '◈', label: 'Audit Logs',   path: '/admin/audit' },
    { icon: '◉', label: 'Pipeline',     path: '/admin/pipeline' },
  ],
  manager: [
    { icon: '◈', label: 'Dashboard',   path: '/manager/dashboard' },
    { icon: '◉', label: 'Escalations', path: '/manager/queue' },
    { icon: '◎', label: 'Portfolio',   path: '/manager/portfolio' },
    { icon: '◇', label: 'Thresholds',  path: '/manager/config' },
  ],
  analyst: [
    { icon: '◈', label: 'Dashboard',     path: '/analyst/dashboard' },
    { icon: '◉', label: 'Review Queue',  path: '/analyst/queue' },
    { icon: '◎', label: 'LoanBot',       path: '/analyst/chatbot' },
  ],
  applicant: [
    { icon: '◈', label: 'My Dashboard', path: '/portal/dashboard' },
    { icon: '◉', label: 'Apply Now',    path: '/portal/apply' },
    { icon: '◎', label: 'Credit Score', path: '/portal/score' },
    { icon: '◇', label: 'Eligibility',  path: '/portal/eligibility' },
    { icon: '◈', label: 'Statements',   path: '/portal/statements' },
    { icon: '◉', label: 'Support',      path: '/portal/chatbot' },
  ],
};

const roleLabel: Record<Role, string> = {
  admin:     'Administrator',
  manager:   'Bank Manager',
  analyst:   'Credit Analyst',
  applicant: 'Applicant',
};

function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = (user?.role ?? 'applicant') as Role;
  const items = navByRole[role] ?? [];
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-mark">L</div>
        <span className="sidebar-brand-name">LoanLens</span>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-label">Menu</div>
        {items.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item${location.pathname.startsWith(item.path) ? ' active' : ''}`}
          >
            <span className="nav-item-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-tile">
          <div className="user-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name">{user?.name ?? '—'}</div>
            <div className="user-role">{roleLabel[role]}</div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            title="Sign out"
            style={{ padding: '4px 8px', flexShrink: 0 }}
            onClick={() => { logout(); navigate('/login', { replace: true }); }}
          >
            ⏻
          </button>
        </div>
      </div>
    </aside>
  );
}

interface ShellProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function DashboardShell({ children, title, subtitle, actions }: ShellProps) {
  return (
    <div className="layout">
      <Sidebar />
      <div className="dash-main">
        <header className="topbar">
          <div>
            <div className="topbar-title">{title}</div>
            {subtitle && <div className="topbar-sub">{subtitle}</div>}
          </div>
          {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{actions}</div>}
        </header>
        <main className="page-body fade-up">{children}</main>
      </div>
    </div>
  );
}
