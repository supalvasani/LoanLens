import { useState } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { useAuth } from '../contexts/AuthContext';

const MY_APPLICATIONS = [
  {
    id: 'APP-20041',
    type: 'Personal Loan',
    amount: '₹5,00,000',
    status: 'pending',
    statusLabel: 'Under Review',
    submittedAt: '29 Jun 2026, 10:30 AM',
    purpose: 'Home renovation',
    steps: [
      { label: 'Submitted',     done: true },
      { label: 'Document Check',done: true },
      { label: 'Credit Scoring',done: true },
      { label: 'Analyst Review',done: false, active: true },
      { label: 'Decision',      done: false },
    ],
  },
  {
    id: 'APP-19987',
    type: 'Home Loan',
    amount: '₹22,00,000',
    status: 'rejected',
    statusLabel: 'Rejected',
    submittedAt: '12 Jun 2026, 2:15 PM',
    purpose: 'Property purchase in Pune',
    steps: [
      { label: 'Submitted',     done: true },
      { label: 'Document Check',done: true },
      { label: 'Credit Scoring',done: true },
      { label: 'Analyst Review',done: true },
      { label: 'Decision',      done: true },
    ],
  },
];

const LOAN_TYPES = [
  { emoji: '🏠', name: 'Home Loan',      max: '₹1 Cr',  rate: '8.5%' },
  { emoji: '👤', name: 'Personal Loan',  max: '₹20 L',  rate: '12%' },
  { emoji: '🚗', name: 'Auto Loan',      max: '₹30 L',  rate: '9.5%' },
  { emoji: '🎓', name: 'Education Loan', max: '₹50 L',  rate: '8%' },
  { emoji: '🛵', name: 'Two-Wheeler',    max: '₹2 L',   rate: '11%' },
  { emoji: '💼', name: 'Business Loan',  max: '₹75 L',  rate: '13%' },
];

const CREDIT_SCORE = 712;
const CREDIT_MAX   = 900;

function CreditScoreRing({ score }: { score: number }) {
  const pct = score / CREDIT_MAX;
  const color = score < 550 ? 'var(--color-danger)' : score < 680 ? 'var(--color-warning)' : 'var(--color-success)';
  const label = score < 550 ? 'Poor' : score < 650 ? 'Fair' : score < 720 ? 'Good' : 'Excellent';
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ position: 'relative', width: 140, height: 140 }}>
        <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" />
          <circle
            cx="70" cy="70" r={r}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeDasharray={`${circ}`}
            strokeDashoffset={`${offset}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease', filter: `drop-shadow(0 0 8px ${color})` }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>/ 900</div>
        </div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Updated today</div>
    </div>
  );
}

const statusStyle: Record<string, { cls: string; icon: string }> = {
  pending:  { cls: 'badge status-pending',  icon: '⏳' },
  approved: { cls: 'badge status-approved', icon: '✅' },
  rejected: { cls: 'badge status-rejected', icon: '❌' },
};

export default function ApplicantDashboard() {
  const { user } = useAuth();
  const [showApply, setShowApply] = useState(false);

  return (
    <DashboardShell
      title="My Dashboard"
      subtitle={`Hello, ${user?.name?.split(' ')[0]} 👋 — here's your loan overview`}
      actions={
        <div className="flex items-center gap-2">
          <span className="badge badge-applicant">Applicant</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowApply(true)}>
            ➕ Apply for Loan
          </button>
        </div>
      }
    >
      {/* Quick apply modal (simplified overlay) */}
      {showApply && (
        <div
          onClick={() => setShowApply(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card animate-slideup"
            style={{ width: '100%', maxWidth: 500, padding: 32 }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 4 }}>Apply for a Loan</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 24 }}>Choose the loan type that fits your need</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              {LOAN_TYPES.map((lt) => (
                <button key={lt.name} className="btn btn-ghost" style={{ flexDirection: 'column', height: 80, gap: 6, fontSize: 13 }}>
                  <span style={{ fontSize: 22 }}>{lt.emoji}</span>
                  <span style={{ fontWeight: 600 }}>{lt.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Up to {lt.max} · {lt.rate} p.a.</span>
                </button>
              ))}
            </div>
            <button className="btn btn-ghost btn-full" onClick={() => setShowApply(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Credit score */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', alignSelf: 'flex-start' }}>💳 Credit Score</div>
          <CreditScoreRing score={CREDIT_SCORE} />
          <div style={{ width: '100%', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Max eligible loan</span>
              <span style={{ fontWeight: 700, color: '#4ade80' }}>₹15,00,000</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Risk tier</span>
              <span className="badge risk-low" style={{ fontSize: 10 }}>Low</span>
            </div>
          </div>
        </div>

        {/* Active apps */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 16 }}>📋 My Applications</div>
          {MY_APPLICATIONS.map((app) => (
            <div key={app.id} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border-subtle)' }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <code style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{app.id}</code>
                    <span className={statusStyle[app.status].cls}>{statusStyle[app.status].icon} {app.statusLabel}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{app.type} · {app.amount}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{app.purpose} · {app.submittedAt}</div>
                </div>
              </div>
              {/* Step tracker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                {app.steps.map((step, i) => (
                  <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: step.done ? 'var(--color-success)' : step.active ? 'var(--color-brand-primary)' : 'rgba(255,255,255,0.06)',
                        border: `2px solid ${step.done ? 'var(--color-success)' : step.active ? 'var(--color-brand-primary)' : 'rgba(255,255,255,0.1)'}`,
                        fontSize: 12, color: '#fff',
                        boxShadow: step.active ? '0 0 12px rgba(99,102,241,0.5)' : 'none',
                        flexShrink: 0,
                        animation: step.active ? 'pulse-glow 2s ease-in-out infinite' : 'none',
                      }}>
                        {step.done ? '✓' : step.active ? '⟳' : i + 1}
                      </div>
                      <div style={{ fontSize: 9, color: step.done ? '#4ade80' : step.active ? '#818cf8' : 'var(--color-text-muted)', marginTop: 4, textAlign: 'center', lineHeight: 1.2 }}>
                        {step.label}
                      </div>
                    </div>
                    {i < app.steps.length - 1 && (
                      <div style={{ height: 2, flex: 1, background: step.done ? 'var(--color-success)' : 'rgba(255,255,255,0.06)', marginBottom: 18, minWidth: 8 }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button className="btn btn-primary btn-sm" onClick={() => setShowApply(true)}>➕ Apply for Another Loan</button>
        </div>
      </div>

      {/* Loan types available */}
      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 16 }}>🏦 Available Loan Products</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {LOAN_TYPES.map((lt) => (
            <div key={lt.name} className="card" style={{ padding: '16px', cursor: 'pointer', border: '1px solid var(--color-border-subtle)' }} onClick={() => setShowApply(true)}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>{lt.emoji}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-primary)', marginBottom: 4 }}>{lt.name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Up to {lt.max}</div>
              <div style={{ fontSize: 12, color: '#38bdf8', marginTop: 2 }}>{lt.rate} per annum</div>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 10, width: '100%', fontSize: 12 }}>Apply →</button>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
