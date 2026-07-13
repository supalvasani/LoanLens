// ──────────────────────────────────────────────────────────────────────────────
// LoanLens — Manager Dashboard
// Escalation pipeline, portfolio, approvals, branch performance
// ──────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { DashboardShell } from '../components/DashboardShell';

const STATS = [
  { icon: '🚨', label: 'Pending Escalations', value: '23',      trend: '+3', dir: 'warn',  bg: 'rgba(239,68,68,0.15)',   color: '#f87171' },
  { icon: '✅', label: 'Approved This Month',  value: '187',     trend: '+12%', dir: 'up', bg: 'rgba(34,197,94,0.15)',   color: '#4ade80' },
  { icon: '💰', label: 'High-Value Portfolio', value: '₹31.4Cr', trend: '+9%',  dir: 'up', bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24' },
  { icon: '⏳', label: 'Avg Resolution Time',  value: '6.1h',    trend: '-22%', dir: 'up', bg: 'rgba(99,102,241,0.15)',  color: '#818cf8' },
];

const ESCALATIONS = [
  { id: 'APP-20039', applicant: 'Vikram Nair',   type: 'Business Loan',  amount: '₹28,00,000', score: 58, reason: 'Grey zone (58)',      since: '2h ago',   urgency: 'high' },
  { id: 'APP-20031', applicant: 'Sunita Reddy',  type: 'Home Loan',      amount: '₹65,00,000', score: 72, reason: 'Amount threshold',    since: '4h ago',   urgency: 'high' },
  { id: 'APP-20027', applicant: 'Arjun Mehta',   type: 'Personal Loan',  amount: '₹8,00,000',  score: 52, reason: 'Fraud flag raised',   since: '5h ago',   urgency: 'critical' },
  { id: 'APP-20022', applicant: 'Deepa Thomas',  type: 'Auto Loan',      amount: '₹12,00,000', score: 61, reason: 'Grey zone (61)',      since: '8h ago',   urgency: 'medium' },
  { id: 'APP-20019', applicant: 'Kiran Sharma',  type: 'Education Loan', amount: '₹15,00,000', score: 48, reason: 'Grey zone (48)',      since: '11h ago',  urgency: 'medium' },
];

const PIPELINE = [
  { stage: 'Received',     count: 141, pct: 100, color: '#818cf8' },
  { stage: 'Under Review', count: 89,  pct: 63,  color: '#38bdf8' },
  { stage: 'Escalated',    count: 23,  pct: 16,  color: '#fbbf24' },
  { stage: 'Decided',      count: 29,  pct: 21,  color: '#4ade80' },
];

const urgencyClass: Record<string, string> = {
  critical: 'badge badge-danger',
  high: 'badge badge-warning',
  medium: 'badge badge-info',
};

export default function ManagerDashboard() {
  const [selectedApp, setSelectedApp] = useState<string | null>(null);

  return (
    <DashboardShell
      title="Escalation Pipeline"
      subtitle={`Manager view — ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`}
      actions={
        <div className="flex items-center gap-2">
          <span className="badge badge-manager">Bank Manager</span>
          <button className="btn btn-ghost btn-sm">📊 Reports</button>
        </div>
      }
    >
      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {STATS.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between">
              <div className="stat-icon" style={{ background: s.bg, color: s.color }}>{s.icon}</div>
              <span className={`stat-trend ${s.dir === 'up' ? 'up' : 'down'}`}>
                {s.trend.startsWith('-') ? '↓' : '↑'} {s.trend}
              </span>
            </div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
        {/* Escalation queue */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', gridColumn: 'span 1' }}>
          <div className="flex items-center justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
            <div>
              <div className="font-semibold text-primary">🚨 Escalation Queue</div>
              <div className="text-muted text-xs mt-1">Requires manager decision</div>
            </div>
            <span className="badge badge-danger">23 pending</span>
          </div>
          <div style={{ padding: '8px 0' }}>
            {ESCALATIONS.map((esc) => (
              <button
                type="button"
                key={esc.id}
                onClick={() => setSelectedApp(selectedApp === esc.id ? null : esc.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  font: 'inherit',
                  color: 'inherit',
                  padding: '12px 20px',
                  border: 'none',
                  borderBottom: '1px solid var(--color-border-subtle)',
                  cursor: 'pointer',
                  background: selectedApp === esc.id ? 'rgba(99,102,241,0.08)' : 'transparent',
                  transition: 'background 0.15s ease',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <code style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{esc.id}</code>
                    <span className={urgencyClass[esc.urgency]}>{esc.urgency}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{esc.since}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>{esc.applicant}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 1 }}>{esc.type} · {esc.amount}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: esc.score < 50 ? 'var(--color-danger)' : 'var(--color-warning)', fontVariantNumeric: 'tabular-nums' }}>{esc.score}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Credit Score</div>
                  </div>
                </div>
                {selectedApp === esc.id && (
                  <div
                    className="flex gap-2"
                    style={{ marginTop: 10 }}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }}>✅ Approve</button>
                    <button className="btn btn-danger btn-sm" style={{ flex: 1 }}>❌ Reject</button>
                    <button className="btn btn-ghost btn-sm">📄 View Full</button>
                  </div>
                )}
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--color-warning)', background: 'rgba(245,158,11,0.08)', padding: '3px 8px', borderRadius: 4 }}>
                  ⚡ Reason: {esc.reason}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* Pipeline funnel */}
          <div className="card">
            <div className="font-semibold text-primary mb-4">📊 Decision Pipeline (Today)</div>
            {PIPELINE.map((p) => (
              <div key={p.stage} style={{ marginBottom: 14 }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-secondary">{p.stage}</span>
                  <span className="font-semibold text-sm" style={{ color: p.color }}>{p.count}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${p.pct}%`, background: p.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* Risk tier split */}
          <div className="card">
            <div className="font-semibold text-primary mb-4">🎯 Risk Tier Distribution</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { tier: 'Low',    count: 58, color: 'var(--color-success)',   icon: '🟢' },
                { tier: 'Medium', count: 43, color: 'var(--color-warning)',   icon: '🟡' },
                { tier: 'High',   count: 40, color: 'var(--color-danger)',    icon: '🔴' },
              ].map((t) => (
                <div key={t.tier} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border-subtle)', borderRadius: 10, padding: '14px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{t.icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: t.color }}>{t.count}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{t.tier} Risk</div>
                </div>
              ))}
            </div>
          </div>

          {/* My decisions today */}
          <div className="card">
            <div className="font-semibold text-primary mb-3">My Decisions Today</div>
            {[
              { id: 'APP-20015', action: 'Approved', amount: '₹45L', time: '9:10 AM' },
              { id: 'APP-20009', action: 'Rejected', amount: '₹18L', time: '8:45 AM' },
              { id: 'APP-20003', action: 'Approved', amount: '₹72L', time: '8:12 AM' },
            ].map((d) => (
              <div key={d.id} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <div className="flex items-center gap-2">
                  <span className={d.action === 'Approved' ? 'badge badge-success' : 'badge badge-danger'}>{d.action}</span>
                  <code style={{ fontSize: 11, color: '#818cf8' }}>{d.id}</code>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{d.amount}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{d.time}</div>
                </div>
              </div>
            ))}
            <div className="text-center text-muted text-xs" style={{ marginTop: 10 }}>3 decisions made today</div>
          </div>
        </div>
      </div>

      {/* Threshold configuration reminder */}
      <div className="card" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.05)' }}>
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 22 }}>⚙️</span>
          <div>
            <div className="font-semibold text-primary">Manager Threshold Settings</div>
            <div className="text-muted text-xs mt-1">
              Current auto-escalation thresholds: Home Loan &gt; ₹50L · Personal Loan &gt; ₹10L · Business Loan &gt; ₹25L · Score grey-zone: 45–65
            </div>
          </div>
          <button className="btn btn-ghost btn-sm ml-auto" style={{ flexShrink: 0 }}>Edit Thresholds →</button>
        </div>
      </div>
    </DashboardShell>
  );
}
