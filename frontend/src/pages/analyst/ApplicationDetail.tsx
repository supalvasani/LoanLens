// ─────────────────────────────────────────────────────────────────────────────
// LoanLens — Analyst: Application Detail & Review
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { loanService } from '../../services/loanService';
import type { ApplicationFull, DecisionType, RiskTier } from '../../types/loan';

const RISK_COLOR: Record<RiskTier, string> = {
  very_low: 'var(--ok)',
  low:      'var(--ok)',
  medium:   'var(--warn)',
  high:     'var(--bad)',
  very_high:'var(--bad)',
};

const STATUS_BADGE: Record<string, string> = {
  pending:      'badge-warn',
  under_review: 'badge-warn',
  escalated:    'badge-warn',
  approved:     'badge-ok',
  rejected:     'badge-bad',
};

function ScoreGauge({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = score >= 70 ? 'var(--ok)' : score >= 45 ? 'var(--warn)' : 'var(--bad)';
  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{ fontSize: 48, fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1 }}>
        {score}
      </div>
      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.08em' }}>
        Credit Score
      </div>
      <div style={{ marginTop: 12, height: 6, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width .6s ease' }} />
      </div>
    </div>
  );
}

function MetricRow({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-s)' }}>
      <span style={{ fontSize: 12, color: 'var(--t2)' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{value}</span>
        {note && <div style={{ fontSize: 11, color: 'var(--t3)' }}>{note}</div>}
      </div>
    </div>
  );
}

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData]       = useState<ApplicationFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [notes, setNotes]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionDone, setActionDone] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loanService.getApplication(id)
      .then(setData)
      .catch(() => setError('Failed to load application.'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDecision(decision: DecisionType) {
    if (!id) return;
    if (decision === 'escalated' && !notes.trim()) {
      alert('Please add a reason before escalating.');
      return;
    }
    setSubmitting(true);
    try {
      if (decision === 'escalated') {
        await loanService.escalate(id, notes);
      } else {
        await loanService.decideAnalyst(id, decision, notes);
      }
      setActionDone(decision);
    } catch {
      setError('Failed to submit decision. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <DashboardShell title="Loading…" subtitle="Fetching application">
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--t3)' }}>
        <span className="spinner" style={{ fontSize: 24 }} /> Loading application…
      </div>
    </DashboardShell>
  );

  if (error) return (
    <DashboardShell title="Error">
      <div className="alert alert-error"><span>⚠</span><span>{error}</span></div>
      <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate('/analyst/queue')}>← Back to Queue</button>
    </DashboardShell>
  );

  if (actionDone) return (
    <DashboardShell title="Decision Submitted">
      <div className="alert alert-success" style={{ marginBottom: 20 }}>
        <span>✓</span>
        <span>
          Application <strong>{id?.slice(0, 8)}…</strong> has been{' '}
          <strong>{actionDone === 'escalated' ? 'escalated to manager' : actionDone}</strong>.
        </span>
      </div>
      <button className="btn btn-secondary" onClick={() => navigate('/analyst/queue')}>← Back to Queue</button>
    </DashboardShell>
  );

  const { application: app, credit_score, fraud_flags, eligibility, underwriter_report } = data!;
  const canDecide = ['pending', 'under_review'].includes(app.status);

  return (
    <DashboardShell
      title={`Review: ${app.loan_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`}
      subtitle={`App ID: ${app.application_id.slice(0, 8)}… · Submitted ${new Date(app.submitted_at).toLocaleDateString('en-IN')}`}
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`badge ${STATUS_BADGE[app.status] ?? ''}`}>{app.status.replace(/_/g, ' ')}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/analyst/queue')}>← Queue</button>
        </div>
      }
    >
      {/* Top row: Application + Credit Score */}
      <div className="grid-2" style={{ marginBottom: 20 }}>

        {/* Application summary */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 14 }}>
            Application Details
          </div>
          <MetricRow label="Loan Type"        value={app.loan_type.replace(/_/g, ' ')} />
          <MetricRow label="Amount Requested" value={`₹${Number(app.amount_requested).toLocaleString('en-IN')}`} />
          <MetricRow label="Purpose"          value={app.purpose} />
          <MetricRow label="Current Status"   value={app.status.replace(/_/g, ' ')} />
          <MetricRow label="Submitted"        value={new Date(app.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
        </div>

        {/* Credit score */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 14 }}>
            Credit Assessment
          </div>
          {credit_score ? (
            <>
              <ScoreGauge score={credit_score.final_score} />
              <div style={{ marginTop: 16 }}>
                <MetricRow label="Risk Tier"        value={credit_score.risk_tier.replace(/_/g, ' ')} />
                <MetricRow label="Income Stability" value={`${credit_score.income_stability_score}/100`} />
                <MetricRow label="EMI Burden"       value={`${credit_score.emi_burden_score}/100`} />
                <MetricRow label="Bounce Rate"      value={`${credit_score.bounce_rate_score}/100`} />
                <MetricRow label="Balance Stability" value={`${credit_score.balance_stability_score}/100`} />
              </div>
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--t2)' }}>
                💡 {credit_score.recommendation}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)', fontSize: 13 }}>
              No credit score available yet.
            </div>
          )}
        </div>
      </div>

      {/* Second row: Underwriter + Eligibility */}
      <div className="grid-2" style={{ marginBottom: 20 }}>

        {/* Underwriter report */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 14 }}>
            Underwriter Report
          </div>
          {underwriter_report ? (
            <>
              <MetricRow label="Monthly Income"      value={`₹${Number(underwriter_report.monthly_income).toLocaleString('en-IN')}`} />
              <MetricRow label="Monthly Obligations" value={`₹${Number(underwriter_report.monthly_obligations).toLocaleString('en-IN')}`} />
              <MetricRow label="EMI-to-Income Ratio" value={`${(underwriter_report.emi_to_income_ratio * 100).toFixed(1)}%`}
                note={underwriter_report.emi_to_income_ratio > 0.5 ? '⚠ High burden' : '✓ Acceptable'} />
              <MetricRow label="Avg Monthly Balance" value={`₹${Number(underwriter_report.avg_monthly_balance).toLocaleString('en-IN')}`} />
              <MetricRow label="Bounce Rate"         value={`${(underwriter_report.bounce_rate * 100).toFixed(1)}%`}
                note={underwriter_report.bounce_rate > 0.2 ? '⚠ Elevated' : '✓ Low'} />
              <MetricRow label="Max Eligible EMI"    value={`₹${Number(underwriter_report.max_eligible_emi).toLocaleString('en-IN')}`} />
              <div style={{ marginTop: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: RISK_COLOR[underwriter_report.risk_segment as RiskTier] ?? 'var(--t2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  ● {underwriter_report.risk_segment.replace(/_/g, ' ')} Risk
                </span>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)', fontSize: 13 }}>No underwriter data available.</div>
          )}
        </div>

        {/* Eligibility + Fraud flags */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 14 }}>
              Loan Eligibility
            </div>
            {eligibility ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: 'var(--t2)' }}>Eligible?</span>
                  <span className={`badge ${eligibility.is_eligible ? 'badge-ok' : 'badge-bad'}`}>
                    {eligibility.is_eligible ? '✓ Eligible' : '✗ Not Eligible'}
                  </span>
                </div>
                <MetricRow label="Applied Amount"   value={`₹${Number(eligibility.applied_amount).toLocaleString('en-IN')}`} />
                <MetricRow label="Eligible Amount"  value={`₹${Number(eligibility.eligible_amount).toLocaleString('en-IN')}`} />
                {eligibility.gap_amount > 0 && (
                  <MetricRow label="Gap"            value={`₹${Number(eligibility.gap_amount).toLocaleString('en-IN')}`} note={eligibility.gap_reason ?? ''} />
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--t3)', fontSize: 13 }}>No eligibility data.</div>
            )}
          </div>

          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 14 }}>
              Fraud Flags {fraud_flags.length > 0 && <span className="badge badge-bad" style={{ marginLeft: 6 }}>{fraud_flags.length}</span>}
            </div>
            {fraud_flags.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--ok)' }}>✓ No fraud signals detected.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fraud_flags.map(f => (
                  <div key={f.flag_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bad-b)', borderRadius: 'var(--r-sm)', border: '1px solid rgba(198,40,40,.15)' }}>
                    <span style={{ fontSize: 12, color: 'var(--bad)' }}>{f.flag_type.replace(/_/g, ' ')}</span>
                    <span className="badge badge-bad">{f.severity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Decision panel */}
      <div className="card">
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 16 }}>
          Decision
        </div>
        {!canDecide ? (
          <div className="alert alert-warn">
            <span>ℹ</span>
            <span>This application is <strong>{app.status}</strong> — no further action required from analyst.</span>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label className="form-label">Notes / Reason</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Add decision notes (required for escalation)…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ resize: 'vertical', fontFamily: 'var(--font)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                className="btn btn-primary"
                disabled={submitting}
                onClick={() => handleDecision('approved')}
              >
                {submitting ? <span className="spinner" /> : '✓'} Approve
              </button>
              <button
                className="btn btn-danger"
                disabled={submitting}
                onClick={() => handleDecision('rejected')}
              >
                {submitting ? <span className="spinner" /> : '✗'} Reject
              </button>
              <button
                className="btn btn-secondary"
                disabled={submitting}
                onClick={() => handleDecision('escalated')}
                style={{ marginLeft: 'auto' }}
              >
                {submitting ? <span className="spinner" /> : '↑'} Escalate to Manager
              </button>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
