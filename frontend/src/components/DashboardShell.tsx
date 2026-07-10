import { type ReactNode, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { Role } from '../types/auth';
import { ProfileModal } from './ProfileModal';

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
  const { user } = useAuth();
  const location = useLocation();
  const role = (user?.role ?? 'applicant') as Role;
  const items = navByRole[role] ?? [];
  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const [profileOpen, setProfileOpen] = useState(false);
  const tileRef = useRef<HTMLButtonElement>(null);

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
        {/* Clickable user tile opens profile modal */}
        <button
          ref={tileRef}
          id="user-profile-tile"
          className="user-tile"
          onClick={() => setProfileOpen((v) => !v)}
          title="View profile"
          style={{
            width: '100%',
            cursor: 'pointer',
            border: '1px solid var(--border)',
            background: profileOpen ? 'var(--surface)' : 'var(--bg)',
            outline: profileOpen ? '2px solid rgba(28,25,23,0.12)' : 'none',
            outlineOffset: 1,
            transition: 'outline 120ms',
            textAlign: 'left',
          }}
        >
          <div className="user-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name">{user?.name ?? '—'}</div>
            <div className="user-role">{roleLabel[role]}</div>
          </div>
          {/* chevron indicator */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              color: 'var(--t3)',
              flexShrink: 0,
              transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 180ms',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Profile modal */}
      {profileOpen && (
        <ProfileModal
          onClose={() => setProfileOpen(false)}
          anchorRef={tileRef as React.RefObject<HTMLElement | null>}
        />
      )}
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
