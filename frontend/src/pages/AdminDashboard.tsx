// ──────────────────────────────────────────────────────────────────────────────
// LoanLens — Admin Dashboard
// Full system overview: users, loans, revenue, decisions, audit trail
// ──────────────────────────────────────────────────────────────────────────────


import { DashboardShell } from '../components/DashboardShell';
import { useAuth } from '../hooks/useAuth';

function getStatIcon(label: string) {
  switch (label) {
    case 'Total Users':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'Active Loans':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case 'Portfolio Value':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case 'Escalated Today':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'Approved (30d)':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case 'Rejected (30d)':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case 'Auto-Decisions':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
          <rect x="9" y="9" width="6" height="6" />
          <line x1="9" y1="1" x2="9" y2="4" />
          <line x1="15" y1="1" x2="15" y2="4" />
          <line x1="9" y1="20" x2="9" y2="23" />
          <line x1="15" y1="20" x2="15" y2="23" />
          <line x1="20" y1="9" x2="23" y2="9" />
          <line x1="20" y1="15" x2="23" y2="15" />
        </svg>
      );
    case 'Avg Review Time':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    default:
      return null;
  }
}

const STATS = [
  { label: 'Total Users',     value: '1,248',  trend: '+12%', dir: 'up'   },
  { label: 'Active Loans',    value: '3,841',  trend: '+8%',  dir: 'up'   },
  { label: 'Portfolio Value', value: '₹48.2Cr',trend: '+15%', dir: 'up'   },
  { label: 'Escalated Today', value: '23',     trend: '-5%',  dir: 'down' },
  { label: 'Approved (30d)', value: '687',     trend: '+3%',  dir: 'up'   },
  { label: 'Rejected (30d)', value: '214',     trend: '-2%',  dir: 'down' },
  { label: 'Auto-Decisions', value: '78%',     trend: '+2%',  dir: 'up'   },
  { label: 'Avg Review Time', value: '4.2h',   trend: '-18%', dir: 'up'   },
];

const RECENT_ACTIVITY = [
  { time: '11:02 AM', user: 'Priya Analyst', action: 'Approved', app: 'APP-20041', amount: '₹5,00,000', risk: 'low' },
  { time: '10:47 AM', user: 'Rajesh Manager', action: 'Escalated', app: 'APP-20039', amount: '₹28,00,000', risk: 'high' },
  { time: '10:31 AM', user: 'Priya Analyst', action: 'Rejected', app: 'APP-20038', amount: '₹1,50,000', risk: 'high' },
  { time: '10:15 AM', user: 'Priya Analyst', action: 'Approved', app: 'APP-20037', amount: '₹7,50,000', risk: 'medium' },
  { time: '09:58 AM', user: 'Rajesh Manager', action: 'Approved', app: 'APP-20034', amount: '₹45,00,000', risk: 'low' },
  { time: '09:40 AM', user: 'System', action: 'Auto-Approved', app: 'APP-20033', amount: '₹2,00,000', risk: 'low' },
];

const ROLE_DIST = [
  { role: 'Applicants', count: 1198, pct: 96, color: '#4F46E5' },
  { role: 'Analysts', count: 32, pct: 2.6, color: '#0891B2' },
  { role: 'Managers', count: 12, pct: 1, color: '#059669' },
  { role: 'Admins', count: 6, pct: 0.4, color: '#475569' },
];

const LOAN_TYPES = [
  { type: 'Home Loan', value: '₹21.4Cr', pct: 44 },
  { type: 'Personal Loan', value: '₹12.8Cr', pct: 27 },
  { type: 'Business Loan', value: '₹8.2Cr', pct: 17 },
  { type: 'Auto Loan', value: '₹3.9Cr', pct: 8 },
  { type: 'Education Loan', value: '₹1.5Cr', pct: 3 },
  { type: 'Two-Wheeler', value: '₹0.4Cr', pct: 1 },
];

const actionClass: Record<string, string> = {
  'Approved': 'badge badge-success',
  'Rejected': 'badge badge-danger',
  'Escalated': 'badge badge-warning',
  'Auto-Approved': 'badge badge-info',
};

const riskClass: Record<string, string> = {
  low: 'badge risk-low', medium: 'badge risk-medium', high: 'badge risk-high',
};

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <DashboardShell
      title="System Overview"
      subtitle={`Welcome back, ${user?.name} — ${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
      actions={
        <div className="flex items-center gap-2">
          <span className="badge badge-admin">Admin</span>
          <button className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export
          </button>
          <button className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            Config
          </button>
        </div>
      }
    >
      {/* Stats grid */}
      <div className="stats-grid">
        {STATS.map((s) => (
          <div key={s.label} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 'var(--r-sm)',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--t2)',
                  flexShrink: 0,
                }}
              >
                {getStatIcon(s.label)}
              </div>
              <span className={`stat-trend ${s.dir === 'up' ? 'up' : 'down'}`}>
                {s.dir === 'up' ? '↑' : '↓'} {s.trend}
              </span>
            </div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
        {/* Recent Activity */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="flex items-center justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <div>
              <div className="font-semibold text-primary">Recent Decisions</div>
              <div className="text-muted text-xs mt-1">Live activity across all analysts & managers</div>
            </div>
            <button className="btn btn-ghost btn-sm">View All →</button>
          </div>
          <div className="table-wrapper" style={{ borderRadius: 0, border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Officer</th>
                  <th>Application</th>
                  <th>Amount</th>
                  <th>Risk</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {RECENT_ACTIVITY.map((row) => (
                  <tr key={row.app}>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{row.time}</td>
                    <td style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{row.user}</td>
                    <td><code style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{row.app}</code></td>
                    <td style={{ fontWeight: 500 }}>{row.amount}</td>
                    <td><span className={riskClass[row.risk]}>{row.risk}</span></td>
                    <td><span className={actionClass[row.action]}>{row.action}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Role distribution */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 16 }}>User Distribution by Role</div>
            {ROLE_DIST.map((r) => (
              <div key={r.role} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, color: 'var(--t2)' }}>{r.role}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{r.count}</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg)', borderRadius: 9999, overflow: 'hidden', border: '1px solid var(--border-s)' }}>
                  <div style={{ height: '100%', width: `${r.pct}%`, background: 'var(--t1)', borderRadius: 9999, transition: 'width .5s ease' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Loan type breakdown */}
          <div className="card">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 16 }}>Portfolio by Loan Type</div>
            {LOAN_TYPES.map((l) => (
              <div key={l.type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--t2)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: 'var(--t2)' }}>{l.type}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 80, height: 3, background: 'var(--bg)', borderRadius: 9999, overflow: 'hidden', border: '1px solid var(--border-s)' }}>
                    <div style={{ height: '100%', width: `${l.pct}%`, background: 'var(--t2)', borderRadius: 9999 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', minWidth: 50, textAlign: 'right' }}>{l.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System health */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>System Health</span>
        </div>
        <div className="grid-3" style={{ gap: 10 }}>
          {[
            { label: 'API Latency',    value: '42ms',     status: 'ok' },
            { label: 'DB Connections', value: '18/100',   status: 'ok' },
            { label: 'Rate Limit',     value: '3 today',  status: 'ok' },
            { label: 'Failed Logins',  value: '7 today',  status: 'warn' },
            { label: 'Log Rotation',   value: 'Hourly ✓', status: 'ok' },
            { label: 'Queue Depth',    value: '141 apps', status: 'warn' },
          ].map((h) => (
            <div
              key={h.label}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                padding: '11px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--t2)' }}>{h.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: h.status === 'ok' ? 'var(--ok)' : 'var(--warn)' }}>{h.value}</span>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
