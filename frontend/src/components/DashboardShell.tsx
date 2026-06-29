// ──────────────────────────────────────────────────────────────────────────────
// LoanLens — Dashboard Shell (Sidebar + Topbar layout)
// ──────────────────────────────────────────────────────────────────────────────

import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { Role } from '../types/auth';

// ── Nav item definitions per role ────────────────────────────────────────────

interface NavItem {
  icon: string;
  label: string;
  key: string;
}

const navByRole: Record<Role, NavItem[]> = {
  admin: [
    { icon: '⬡', label: 'Overview',       key: 'overview' },
    { icon: '👥', label: 'Users',          key: 'users' },
    { icon: '📋', label: 'Applications',   key: 'applications' },
    { icon: '⚖️', label: 'Decisions',      key: 'decisions' },
    { icon: '📊', label: 'Reports',        key: 'reports' },
    { icon: '⚙️', label: 'System Config',  key: 'config' },
    { icon: '📜', label: 'Audit Logs',     key: 'audit' },
  ],
  manager: [
    { icon: '⬡',  label: 'Overview',       key: 'overview' },
    { icon: '🚨',  label: 'Escalations',    key: 'escalations' },
    { icon: '📋',  label: 'Pipeline',       key: 'pipeline' },
    { icon: '📈',  label: 'Portfolio',      key: 'portfolio' },
    { icon: '🏦',  label: 'Branch Stats',   key: 'branch' },
  ],
  analyst: [
    { icon: '⬡',  label: 'Overview',       key: 'overview' },
    { icon: '📥',  label: 'Review Queue',   key: 'queue' },
    { icon: '🔬',  label: 'Assessments',    key: 'assessments' },
    { icon: '📊',  label: 'Risk Analysis',  key: 'risk' },
    { icon: '✅',  label: 'My Decisions',   key: 'decisions' },
  ],
  applicant: [
    { icon: '⬡',  label: 'My Dashboard',   key: 'overview' },
    { icon: '📝',  label: 'Apply Now',      key: 'apply' },
    { icon: '📋',  label: 'My Applications',key: 'applications' },
    { icon: '💳',  label: 'Credit Score',   key: 'credit' },
    { icon: '📄',  label: 'Documents',      key: 'documents' },
  ],
};

const roleBadgeClass: Record<Role, string> = {
  admin:     'badge badge-admin',
  manager:   'badge badge-manager',
  analyst:   'badge badge-analyst',
  applicant: 'badge badge-applicant',
};

const roleLabel: Record<Role, string> = {
  admin:     'Admin',
  manager:   'Bank Manager',
  analyst:   'Credit Analyst',
  applicant: 'Applicant',
};

// ── Sidebar ───────────────────────────────────────────────────────────────────

interface SidebarProps {
  activeKey: string;
  onNavChange: (key: string) => void;
}

function Sidebar({ activeKey, onNavChange }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = (user?.role ?? 'applicant') as Role;
  const navItems = navByRole[role] ?? [];
  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '??';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🏦</div>
        <span className="sidebar-logo-text">LoanLens</span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Menu</div>
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`nav-item ${activeKey === item.key ? 'active' : ''}`}
            onClick={() => onNavChange(item.key)}
            type="button"
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name}
            </div>
            <div className={roleBadgeClass[role]} style={{ marginTop: 3 }}>
              {roleLabel[role]}
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
            title="Logout"
            type="button"
            style={{ padding: '5px 8px', flexShrink: 0 }}
          >
            ⏻
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────

interface TopbarProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

function Topbar({ title, subtitle, actions }: TopbarProps) {
  return (
    <header className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        {subtitle && (
          <div className="text-muted text-xs mt-1">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </header>
  );
}

// ── DashboardShell ────────────────────────────────────────────────────────────

interface DashboardShellProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  topbarActions?: ReactNode;
  activeNav?: string;
  onNavChange?: (key: string) => void;
}

export function DashboardShell({
  children,
  title,
  subtitle,
  topbarActions,
  activeNav = 'overview',
  onNavChange,
}: DashboardShellProps) {
  return (
    <div className="dashboard-layout">
      <Sidebar activeKey={activeNav} onNavChange={onNavChange ?? (() => {})} />
      <div className="dashboard-main">
        <Topbar title={title} subtitle={subtitle} actions={topbarActions} />
        <main className="dashboard-content animate-fadeIn">
          {children}
        </main>
      </div>
    </div>
  );
}
