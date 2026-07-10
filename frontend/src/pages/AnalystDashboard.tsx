// ──────────────────────────────────────────────────────────────────────────────
// LoanLens — Analyst Dashboard
// Review queue, risk analysis, decision history
// ──────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { useAuth } from '../hooks/useAuth';

const STATS = [
  { icon: '📥', label: 'In My Queue',      value: '18',   trend: '+3', dir: 'warn', bg: 'rgba(99,102,241,0.15)',  color: '#818cf8' },
  { icon: '✅', label: 'Closed Today',      value: '12',   trend: '+4', dir: 'up',   bg: 'rgba(34,197,94,0.15)',   color: '#4ade80' },
  { icon: '⚡', label: 'Auto-Routed Today', value: '8',    trend: '',   dir: 'flat', bg: 'rgba(56,189,248,0.15)',  color: '#38bdf8' },
  { icon: '⏱️', label: 'Avg Review Time',  value: '3.8h', trend: '-12%', dir: 'up', bg: 'rgba(245,158,11,0.15)', color: '#fbbf24' },
];

const QUEUE = [
  { id: 'APP-20041', name: 'Rahul Gupta',    type: 'Personal Loan',  amount: '₹5,00,000', score: 71, risk: 'low',    received: '30m ago',  can_decide: true },
  { id: 'APP-20040', name: 'Meena Krishnan', type: 'Home Loan',      amount: '₹18,00,000',score: 68, risk: 'low',    received: '1h ago',   can_decide: true },
  { id: 'APP-20038', name: 'Sanjay Verma',   type: 'Auto Loan',      amount: '₹7,50,000', score: 55, risk: 'medium', received: '2h ago',   can_decide: false },
  { id: 'APP-20036', name: 'Pooja Agarwal',  type: 'Education Loan', amount: '₹12,00,000',score: 82, risk: 'low',    received: '3h ago',   can_decide: true },
  { id: 'APP-20035', name: 'Ravi Pillai',    type: 'Business Loan',  amount: '₹9,00,000', score: 41, risk: 'high',   received: '3h ago',   can_decide: true },
  { id: 'APP-20033', name: 'Anita Joshi',    type: 'Two-Wheeler',    amount: '₹1,20,000', score: 77, risk: 'low',    received: '4h ago',   can_decide: true },
];

const DECISIONS_TODAY = [
  { id: 'APP-20030', name: 'Suresh Kumar',   decision: 'Approved',  score: 78, amount: '₹4,00,000',  time: '10:22 AM' },
  { id: 'APP-20028', name: 'Lakshmi Nair',   decision: 'Rejected',  score: 38, amount: '₹2,50,000',  time: '09:51 AM' },
  { id: 'APP-20025', name: 'Harish Menon',   decision: 'Approved',  score: 83, amount: '₹6,00,000',  time: '09:18 AM' },
  { id: 'APP-20023', name: 'Kavitha Rao',    decision: 'Escalated', score: 57, amount: '₹14,00,000', time: '08:45 AM' },
  { id: 'APP-20020', name: 'Nitin Shah',     decision: 'Approved',  score: 91, amount: '₹3,50,000',  time: '08:30 AM' },
];

const SCORE_DIST = [
  { range: '> 75 (Auto-Approve zone)',  count: 34, color: 'var(--color-success)' },
  { range: '65–75 (Analyst approve)',   count: 28, color: '#4ade80' },
  { range: '45–65 (Grey zone)',         count: 19, color: 'var(--color-warning)' },
  { range: '< 45 (Analyst reject)',     count: 16, color: 'var(--color-danger)' },
];

const riskClass: Record<string, string> = {
  low: 'badge risk-low', medium: 'badge risk-medium', high: 'badge risk-high',
};
const decClass: Record<string, string> = {
  Approved: 'badge badge-success', Rejected: 'badge badge-danger', Escalated: 'badge badge-warning',
};

export default function AnalystDashboard() {
  const { user } = useAuth();
  const [decidedApps, setDecidedApps] = useState<Record<string, string>>({});

  const decide = (id: string, decision: string) => {
    setDecidedApps((prev) => ({ ...prev, [id]: decision }));
  };

  return (
    <DashboardShell
      title="Review Queue"
      subtitle={`Welcome, ${user?.name} — Credit Analyst`}
      actions={
        <div className="flex items-center gap-2">
          <span className="badge badge-analyst">Credit Analyst</span>
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 20, padding: '3px 10px', fontSize: 12, color: '#4ade80' }}>
            🟢 Online
          </div>
        </div>
      }
    >
      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {STATS.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between">
              <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
              {s.trend && <span className={`stat-trend ${s.dir === 'up' ? 'up' : 'down'}`}>{s.dir === 'up' ? '↑' : '↓'} {s.trend}</span>}
            </div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Escalation routing reminder */}
      <div className="card mb-4" style={{ borderColor: 'rgba(56,189,248,0.3)', background: 'rgba(56,189,248,0.04)', padding: '12px 20px', marginBottom: 20 }}>
        <div className="flex items-center gap-4" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#7dd3fc' }}>📌 Escalation Routing Rules:</div>
          <span className="badge badge-success">Score &gt; 65 → Approve</span>
          <span className="badge badge-danger">Score &lt; 45 → Reject</span>
          <span className="badge badge-warning">Score 45–65 → Escalate to Manager</span>
          <span className="badge badge-danger">Any fraud flag → Escalate</span>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
        {/* Queue */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="flex items-center justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <div>
              <div className="font-semibold text-primary">📥 My Review Queue</div>
              <div className="text-xs text-muted mt-1">Tap to review & decide</div>
            </div>
            <span className="badge badge-info">18 open</span>
          </div>
          <div>
            {QUEUE.map((app) => {
              const decided = decidedApps[app.id];
              return (
                <div key={app.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--color-border-subtle)', opacity: decided ? 0.5 : 1 }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <code style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{app.id}</code>
                      <span className={riskClass[app.risk]}>{app.risk}</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{app.received}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{app.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{app.type} · {app.amount}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: app.score > 65 ? 'var(--color-success)' : app.score < 45 ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                        {app.score}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Score</div>
                    </div>
                  </div>
                  {!decided ? (
                    <div className="flex gap-2" style={{ marginTop: 10 }}>
                      {app.score > 65 ? (
                        <>
                          <button onClick={() => decide(app.id, 'Approved')} className="btn btn-primary btn-sm" style={{ flex: 1 }}>✅ Approve</button>
                          <button onClick={() => decide(app.id, 'Escalated')} className="btn btn-ghost btn-sm">⬆ Escalate</button>
                        </>
                      ) : app.score < 45 ? (
                        <>
                          <button onClick={() => decide(app.id, 'Rejected')} className="btn btn-danger btn-sm" style={{ flex: 1 }}>❌ Reject</button>
                          <button onClick={() => decide(app.id, 'Escalated')} className="btn btn-ghost btn-sm">⬆ Escalate</button>
                        </>
                      ) : (
                        <button onClick={() => decide(app.id, 'Escalated')} className="btn btn-ghost btn-sm" style={{ flex: 1, color: 'var(--color-warning)', borderColor: 'rgba(245,158,11,0.3)' }}>
                          ⬆ Must Escalate (Grey Zone)
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginTop: 10 }}>
                      <span className={decided === 'Approved' ? 'badge badge-success' : decided === 'Rejected' ? 'badge badge-danger' : 'badge badge-warning'}>
                        {decided} — recorded
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Score distribution */}
          <div className="card">
            <div className="font-semibold text-primary mb-4">📊 Score Distribution (Today's Queue)</div>
            {SCORE_DIST.map((s) => (
              <div key={s.range} style={{ marginBottom: 14 }}>
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{s.range}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.count}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(s.count / 97) * 100}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* My decisions today */}
          <div className="card">
            <div className="font-semibold text-primary mb-3">My Decisions Today</div>
            <div>
              {DECISIONS_TODAY.map((d) => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={decClass[d.decision]}>{d.decision}</span>
                      <code style={{ fontSize: 11, color: '#818cf8' }}>{d.id}</code>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{d.name} · {d.time}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-primary)' }}>{d.amount}</div>
                    <div style={{ fontSize: 12, color: d.score > 65 ? 'var(--color-success)' : d.score < 45 ? 'var(--color-danger)' : 'var(--color-warning)', fontWeight: 700 }}>
                      {d.score}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, padding: '8px 0', borderTop: '1px solid var(--color-border-subtle)' }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Closure rate</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>83% (auto-eligible)</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
