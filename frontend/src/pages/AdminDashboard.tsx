// ──────────────────────────────────────────────────────────────────────────────
// LoanLens — Admin Dashboard
// Full system overview: users, loans, revenue, decisions, audit trail
// ──────────────────────────────────────────────────────────────────────────────


import { DashboardShell } from '../components/DashboardShell';
import { useAuth } from '../hooks/useAuth';

const STATS = [
  { icon: '👥', label: 'Total Users',       value: '1,248',  trend: '+12%', dir: 'up',   bg: 'rgba(99,102,241,0.15)',  color: '#818cf8' },
  { icon: '📋', label: 'Active Loans',      value: '3,841',  trend: '+8%',  dir: 'up',   bg: 'rgba(34,197,94,0.15)',   color: '#4ade80' },
  { icon: '💰', label: 'Portfolio Value',   value: '₹48.2Cr', trend: '+15%', dir: 'up',   bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24' },
  { icon: '⚠️', label: 'Escalated Today',  value: '23',     trend: '-5%',  dir: 'down', bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  { icon: '✅', label: 'Approved (30d)',    value: '687',    trend: '+3%',  dir: 'up',   bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8' },
  { icon: '❌', label: 'Rejected (30d)',   value: '214',    trend: '-2%',  dir: 'down', bg: 'rgba(139,92,246,0.15)', color: '#a78bfa' },
  { icon: '🤖', label: 'Auto-Decisions',   value: '78%',    trend: '+2%',  dir: 'up',   bg: 'rgba(99,102,241,0.15)',  color: '#818cf8' },
  { icon: '⏱️', label: 'Avg Review Time', value: '4.2h',   trend: '-18%', dir: 'up',   bg: 'rgba(34,197,94,0.15)',   color: '#4ade80' },
];

const RECENT_ACTIVITY = [
  { time: '11:02 AM', user: 'Priya Analyst',  action: 'Approved',  app: 'APP-20041', amount: '₹5,00,000',  risk: 'low' },
  { time: '10:47 AM', user: 'Rajesh Manager', action: 'Escalated', app: 'APP-20039', amount: '₹28,00,000', risk: 'high' },
  { time: '10:31 AM', user: 'Priya Analyst',  action: 'Rejected',  app: 'APP-20038', amount: '₹1,50,000',  risk: 'high' },
  { time: '10:15 AM', user: 'Priya Analyst',  action: 'Approved',  app: 'APP-20037', amount: '₹7,50,000',  risk: 'medium' },
  { time: '09:58 AM', user: 'Rajesh Manager', action: 'Approved',  app: 'APP-20034', amount: '₹45,00,000', risk: 'low' },
  { time: '09:40 AM', user: 'System',         action: 'Auto-Approved', app: 'APP-20033', amount: '₹2,00,000', risk: 'low' },
];

const ROLE_DIST = [
  { role: 'Applicants', count: 1198, pct: 96, color: 'var(--color-applicant)' },
  { role: 'Analysts',   count: 32,   pct: 2.6, color: 'var(--color-analyst)' },
  { role: 'Managers',   count: 12,   pct: 1,   color: 'var(--color-manager)' },
  { role: 'Admins',     count: 6,    pct: 0.4, color: 'var(--color-admin)' },
];

const LOAN_TYPES = [
  { type: 'Home Loan',      value: '₹21.4Cr', pct: 44 },
  { type: 'Personal Loan',  value: '₹12.8Cr', pct: 27 },
  { type: 'Business Loan',  value: '₹8.2Cr',  pct: 17 },
  { type: 'Auto Loan',      value: '₹3.9Cr',  pct: 8 },
  { type: 'Education Loan', value: '₹1.5Cr',  pct: 3 },
  { type: 'Two-Wheeler',    value: '₹0.4Cr',  pct: 1 },
];

const actionClass: Record<string, string> = {
  'Approved':     'badge badge-success',
  'Rejected':     'badge badge-danger',
  'Escalated':    'badge badge-warning',
  'Auto-Approved':'badge badge-info',
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
          <button className="btn btn-ghost btn-sm">📥 Export</button>
          <button className="btn btn-primary btn-sm">⚙️ Config</button>
        </div>
      }
    >
      {/* Stats grid */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        {STATS.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between">
              <div className="stat-icon" style={{ background: s.bg, color: s.color }}>
                {s.icon}
              </div>
              <span className={`stat-trend ${s.dir === 'up' ? 'up' : s.dir === 'down' && s.label.includes('Reject') ? 'up' : 'down'}`}>
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
            <div className="font-semibold text-primary mb-4">User Distribution by Role</div>
            {ROLE_DIST.map((r) => (
              <div key={r.role} style={{ marginBottom: 14 }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-secondary">{r.role}</span>
                  <span className="text-sm font-semibold" style={{ color: r.color }}>{r.count}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${r.pct}%`, background: r.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* Loan type breakdown */}
          <div className="card">
            <div className="font-semibold text-primary mb-4">Portfolio by Loan Type</div>
            {LOAN_TYPES.map((l, i) => (
              <div key={l.type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div className="flex items-center gap-2">
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: `hsl(${240 + i * 30}, 70%, 65%)`, flexShrink: 0 }} />
                  <span className="text-sm text-secondary">{l.type}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="progress-bar" style={{ width: 80, height: 4 }}>
                    <div className="progress-fill" style={{ width: `${l.pct}%`, background: `hsl(${240 + i * 30}, 70%, 65%)` }} />
                  </div>
                  <span className="text-xs font-semibold text-secondary" style={{ minWidth: 50, textAlign: 'right' }}>{l.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System health */}
      <div className="card">
        <div className="font-semibold text-primary mb-4">🟢 System Health</div>
        <div className="grid-3" style={{ gap: 12 }}>
          {[
            { label: 'API Latency',     value: '42ms',   status: 'ok' },
            { label: 'DB Connections',  value: '18/100',  status: 'ok' },
            { label: 'Rate Limit Hits', value: '3 today', status: 'ok' },
            { label: 'Failed Logins',   value: '7 today', status: 'warn' },
            { label: 'Log Rotation',    value: 'Hourly ✓', status: 'ok' },
            { label: 'Queue Depth',     value: '141 apps', status: 'warn' },
          ].map((h) => (
            <div key={h.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border-subtle)', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="text-sm text-secondary">{h.label}</span>
              <span className={h.status === 'ok' ? 'text-success font-semibold text-sm' : 'text-warning font-semibold text-sm'}>{h.value}</span>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
