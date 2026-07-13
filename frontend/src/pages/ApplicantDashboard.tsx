import { useState } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { useAuth } from '../hooks/useAuth';

function getStepBg(done: boolean, active: boolean): string {
  if (done) return 'var(--color-success)';
  if (active) return 'var(--color-brand-primary)';
  return 'rgba(255,255,255,0.06)';
}

function getStepBorder(done: boolean, active: boolean): string {
  let color = 'rgba(255,255,255,0.1)';
  if (done) {
    color = 'var(--color-success)';
  } else if (active) {
    color = 'var(--color-brand-primary)';
  }
  return `2px solid ${color}`;
}

function getStepContent(done: boolean, active: boolean, index: number): React.ReactNode {
  if (done) return '✓';
  if (active) return '⟳';
  return index + 1;
}

function getStepTextColor(done: boolean, active: boolean): string {
  if (done) return '#4ade80';
  if (active) return '#818cf8';
  return 'var(--color-text-muted)';
}

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

function getCreditColor(score: number): string {
  if (score < 550) return 'var(--color-danger)';
  if (score < 680) return 'var(--color-warning)';
  return 'var(--color-success)';
}

function getCreditLabel(score: number): string {
  if (score < 550) return 'Poor';
  if (score < 650) return 'Fair';
  if (score < 720) return 'Good';
  return 'Excellent';
}

function CreditScoreRing({ score }: Readonly<{ score: number }>) {
  const pct = score / CREDIT_MAX;
  const color = getCreditColor(score);
  const label = getCreditLabel(score);
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
                  <span style={{ fontSize: 20 }}>{lt.emoji}</span>
                  <span>{lt.name}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowApply(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Active applications list */}
        <div className="card">
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 16 }}>📋 Active Applications</div>
          {MY_APPLICATIONS.map((app) => (
            <div key={app.id} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text-primary)' }}>{app.type}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8 }}>({app.id})</span>
                </div>
                <span className={statusStyle[app.status]?.cls}>
                  {statusStyle[app.status]?.icon} {app.statusLabel}
                </span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
                Amount: <strong style={{ color: 'var(--color-text-primary)' }}>{app.amount}</strong> — {app.purpose}
              </div>
              {/* Progress bar steps */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {app.steps.map((st, i) => (
                  <div key={st.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%',
                      background: getStepBg(st.done, !!st.active),
                      border: getStepBorder(st.done, !!st.active),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, color: '#fff',
                    }}>
                      {getStepContent(st.done, !!st.active, i)}
                    </div>
                    <span style={{ fontSize: 10, color: getStepTextColor(st.done, !!st.active), textAlign: 'center' }}>
                      {st.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button className="btn btn-primary btn-sm" onClick={() => setShowApply(true)}>➕ Apply for Another Loan</button>
        </div>

        {/* Credit score overview card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 20, alignSelf: 'flex-start' }}>
            🎯 My Credit Score
          </div>
          <CreditScoreRing score={CREDIT_SCORE} />
        </div>
      </div>

      {/* Loan types available */}
      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 16 }}>🏦 Available Loan Products</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {LOAN_TYPES.map((lt) => (
            <button
              key={lt.name}
              type="button"
              className="card text-left"
              style={{ padding: '16px', cursor: 'pointer', border: '1px solid var(--color-border-subtle)', background: 'transparent', textAlign: 'left', display: 'block' }}
              onClick={() => setShowApply(true)}
            >
              <div style={{ fontSize: 26, marginBottom: 8 }}>{lt.emoji}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-primary)', marginBottom: 4 }}>{lt.name}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Up to {lt.max}</div>
              <div style={{ fontSize: 12, color: '#38bdf8', marginTop: 2 }}>{lt.rate} per annum</div>
              <span className="btn btn-ghost btn-sm" style={{ marginTop: 10, width: '100%', fontSize: 12, display: 'block', textAlign: 'center' }}>Apply →</span>
            </button>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
