// ─────────────────────────────────────────────────────────────────────────────
// LoanLens — Manager: Escalations Queue
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { loanService } from '../../services/loanService';
import type { LoanApplication, ApplicationFull, DecisionType } from '../../types/loan';

function ReviewPanel({
  app,
  detail,
  onDecide,
  submitting,
}: {
  app: LoanApplication;
  detail: ApplicationFull | null;
  onDecide: (d: DecisionType, notes: string) => void;
  submitting: boolean;
}) {
  const [notes, setNotes] = useState('');
  const score = detail?.credit_score?.final_score;
  const scoreColor = score != null ? (score >= 70 ? 'var(--ok)' : score >= 45 ? 'var(--warn)' : 'var(--bad)') : 'var(--t3)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { label: 'Amount',     value: `₹${Number(app.amount_requested).toLocaleString('en-IN')}` },
          { label: 'Loan Type',  value: app.loan_type.replace(/_/g, ' ') },
          { label: 'Credit Score', value: score != null ? String(score) : 'N/A', color: scoreColor },
        ].map(({ label, value, color }) => (
          <div key={label} className="card" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--t3)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: color ?? 'var(--t1)', letterSpacing: '-.02em' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Underwriter summary */}
      {detail?.underwriter_report && (
        <div className="card" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--t3)', marginBottom: 10 }}>Underwriter Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 24px' }}>
            {[
              ['Monthly Income',      `₹${Number(detail.underwriter_report.monthly_income).toLocaleString('en-IN')}`],
              ['Monthly Obligations', `₹${Number(detail.underwriter_report.monthly_obligations).toLocaleString('en-IN')}`],
              ['EMI/Income Ratio',    `${(detail.underwriter_report.emi_to_income_ratio * 100).toFixed(1)}%`],
              ['Risk Segment',        detail.underwriter_report.risk_segment.replace(/_/g, ' ')],
            ].map(([l, v]) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-s)' }}>
                <span style={{ fontSize: 12, color: 'var(--t2)' }}>{l}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fraud flags */}
      {detail?.fraud_flags && detail.fraud_flags.length > 0 && (
        <div className="alert alert-warn">
          <span>⚠</span>
          <span>{detail.fraud_flags.length} fraud flag(s): {detail.fraud_flags.map(f => f.flag_type.replace(/_/g, ' ')).join(', ')}</span>
        </div>
      )}

      {/* Decision */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--t3)', marginBottom: 10 }}>Manager Decision</div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">Decision Notes (required)</label>
          <textarea
            className="form-input"
            rows={2}
            placeholder="Reason for your decision…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'var(--font)' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" disabled={submitting || !notes.trim()} onClick={() => onDecide('approved', notes)}>
            {submitting ? <span className="spinner" /> : '✓'} Approve
          </button>
          <button className="btn btn-danger btn-sm"  disabled={submitting || !notes.trim()} onClick={() => onDecide('rejected', notes)}>
            {submitting ? <span className="spinner" /> : '✗'} Reject
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManagerQueue() {
  const navigate = useNavigate();
  const [apps, setApps]           = useState<LoanApplication[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [selected, setSelected]   = useState<string | null>(null);
  const [detail, setDetail]       = useState<ApplicationFull | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]           = useState<Record<string, string>>({});

  useEffect(() => {
    loanService.getApplications()
      .then(all => setApps(all.filter(a => a.status === 'escalated')))
      .catch(() => setError('Failed to load escalations.'))
      .finally(() => setLoading(false));
  }, []);

  function selectApp(id: string) {
    setSelected(id); setDetail(null); setLoadingDetail(true);
    loanService.getApplication(id)
      .then(setDetail)
      .catch(() => setError('Failed to load application detail.'))
      .finally(() => setLoadingDetail(false));
  }

  async function handleDecide(decision: DecisionType, notes: string) {
    if (!selected) return;
    setSubmitting(true);
    try {
      await loanService.decideManager(selected, decision, notes);
      setDone(p => ({ ...p, [selected]: decision }));
      setSelected(null);
    } catch { setError('Failed to submit decision.'); }
    finally { setSubmitting(false); }
  }

  const pending = apps.filter(a => !done[a.application_id]);

  return (
    <DashboardShell
      title="Escalation Queue"
      subtitle={`${pending.length} application(s) awaiting your decision`}
    >
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}><span>⚠</span><span>{error}</span></div>}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '380px 1fr' : '1fr', gap: 20 }}>
        {/* Left: list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}><span className="spinner" /></div>
          ) : pending.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--ok)', fontSize: 13 }}>
              ✓ All escalations resolved!
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/manager/dashboard')}>← Dashboard</button>
              </div>
            </div>
          ) : pending.map(app => (
            <div
              key={app.application_id}
              className="card"
              style={{ padding: '14px 18px', cursor: 'pointer', borderColor: selected === app.application_id ? 'var(--ink)' : 'var(--border)', transition: 'border-color 150ms' }}
              onClick={() => selectApp(app.application_id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--t3)' }}>
                  {app.application_id.slice(0, 8)}…
                </span>
                <span className="badge badge-warn">escalated</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--t1)', marginBottom: 2 }}>
                {app.loan_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </div>
              <div style={{ fontSize: 13, color: 'var(--t2)' }}>
                ₹{Number(app.amount_requested).toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>
                {new Date(app.submitted_at).toLocaleDateString('en-IN')}
              </div>
            </div>
          ))}
        </div>

        {/* Right: detail */}
        {selected && (
          <div>
            {loadingDetail ? (
              <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}><span className="spinner" /> Loading detail…</div>
            ) : (
              <ReviewPanel
                app={apps.find(a => a.application_id === selected)!}
                detail={detail}
                onDecide={handleDecide}
                submitting={submitting}
              />
            )}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
