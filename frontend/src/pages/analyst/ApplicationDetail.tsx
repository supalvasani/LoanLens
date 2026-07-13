import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { useApplication } from '../../hooks/useApplication';
import { useLoanAction } from '../../hooks/useLoanAction';
import { useApplicationDetailData } from '../../hooks/useApplicationDetailData';
import { ApplicationDetailReport } from '../../components/application-detail/ApplicationDetailReport';
import {
  SectionHeader,
  DetailLoadingState,
  DetailErrorState,
  DetailActionDoneState,
} from '../../components/application-detail/ApplicationDetailShared';
import type { DecisionType } from '../../types/loan';

function getActionMode(decision: DecisionType): 'approved' | 'rejected' | 'escalated' {
  if (decision === 'approved') return 'approved';
  if (decision === 'rejected') return 'rejected';
  return 'escalated';
}

function getApproveButtonTitle(canApprove: boolean, hasFraud: boolean, score: number | null): string {
  if (canApprove) return 'Approve this application';
  if (hasFraud) return 'Cannot approve: fraud flags present';
  return `Score ${score?.toFixed(1)} ≤ 65 — must escalate`;
}

function getRejectButtonTitle(canReject: boolean, hasFraud: boolean, score: number | null): string {
  if (canReject) return 'Reject this application';
  if (hasFraud) return 'Cannot reject: fraud flags present';
  return `Score ${score?.toFixed(1)} ≥ 45 — must escalate`;
}

function AnalystFraudAlert({ fraudFlags }: Readonly<{ fraudFlags: { flag_type: string; flag_detail: string; severity: string }[] }>) {
  return (
    <div style={{
      marginBottom: 20, padding: '14px 18px',
      background: 'var(--bad-b)', border: '1px solid rgba(198,40,40,.25)',
      borderRadius: 'var(--r-md)',
    }}>
      <div style={{ fontWeight: 700, color: 'var(--bad)', marginBottom: 8, fontSize: 13 }}>
        ⚠ Fraud Signals Detected — Escalation Required
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {fraudFlags.map((f) => (
          <div key={f.flag_type} style={{
            padding: '6px 12px', background: '#fff',
            border: '1px solid rgba(198,40,40,.2)', borderRadius: 'var(--r-sm)',
            fontSize: 12,
          }}>
            <span style={{ fontWeight: 600, color: 'var(--bad)' }}>
              {f.flag_type.replaceAll('_', ' ')}
            </span>
            <span className="badge badge-bad" style={{ marginLeft: 8 }}>{f.severity}</span>
            {f.flag_detail && (
              <div style={{ color: 'var(--t2)', marginTop: 2 }}>{f.flag_detail}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DecisionExplanation({ hasFraud, score }: Readonly<{ hasFraud: boolean; score: number | null }>) {
  if (hasFraud) return <div>⚠ Fraud flags detected — only escalation is allowed.</div>;
  if (score !== null && score >= 45 && score <= 65) {
    return <div>⚠ Score {score.toFixed(1)} is in the grey zone (45–65) — escalation required.</div>;
  }
  if (score !== null && score > 65) {
    return <div>✓ Score qualifies for approval. Rejection not available at this score.</div>;
  }
  if (score !== null && score < 45) {
    return <div>✓ Score qualifies for rejection. Approval not available at this score.</div>;
  }
  return null;
}

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, loading, error } = useApplication(id, 'analyst');
  const { submitting, error: decisionError, clearError: clearDecisionError, submitAnalyst } = useLoanAction();
  const [notes, setNotes]           = useState('');
  const [actionDone, setActionDone] = useState<string | null>(null);

  const { score, hasFraud } = useApplicationDetailData(data);

  async function handleDecision(decision: DecisionType) {
    if (!id) return;
    clearDecisionError();
    const ok = await submitAnalyst(id, getActionMode(decision), notes || undefined);
    if (ok) setActionDone(decision);
  }

  if (loading) return <DetailLoadingState />;
  if (error || !data) return <DetailErrorState error={error || 'Application not found'} onBack={() => navigate(-1)} />;
  if (actionDone) {
    return (
      <DetailActionDoneState
        id={id}
        actionDone={actionDone}
        onQueue={() => navigate('/analyst/queue')}
        onDashboard={() => navigate('/analyst/dashboard')}
      />
    );
  }

  const { application: app, fraud_flags } = data;
  const canDecide = ['pending', 'under_review'].includes(app.status);
  const canApprove = canDecide && !hasFraud && score !== null && score > 65;
  const canReject  = canDecide && !hasFraud && score !== null && score < 45;

  const statusBadge: Record<string, string> = {
    pending: 'badge-warn', under_review: 'badge-warn',
    escalated: 'badge-warn', approved: 'badge-ok', rejected: 'badge-bad',
  };

  return (
    <DashboardShell
      title={`Review: ${app.loan_type.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}`}
      subtitle={`App ID: ${app.application_id.slice(0, 8)}… · Submitted ${new Date(app.submitted_at).toLocaleDateString('en-IN')}`}
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasFraud && (
            <span className="badge badge-bad" style={{ gap: 4 }}>⚠ Fraud Flagged</span>
          )}
          <span className={`badge ${statusBadge[app.status] ?? ''}`}>
            {app.status.replaceAll('_', ' ')}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/analyst/queue')}>
            ← Queue
          </button>
        </div>
      }
    >
      {hasFraud && <AnalystFraudAlert fraudFlags={fraud_flags} />}

      {/* Credit Report Details & Visualizations */}
      <ApplicationDetailReport detail={data} role="analyst" />

      {/* Decision Panel */}
      <div className="card" style={{ marginTop: 20, border: '1px solid var(--border)', boxShadow: 'var(--sh-md)' }}>
        <SectionHeader>Make a Decision</SectionHeader>

        {!canDecide ? (
          <div className="alert alert-warn">
            <span>ℹ</span>
            <span>This application is <strong>{app.status}</strong> — no further analyst action required.</span>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--t2)' }}>
              <strong>Rules:</strong>{' '}
              Approve requires score &gt;65 and no fraud flags.{' '}
              Reject requires score &lt;45 and no fraud flags.{' '}
              Grey zone (45–65), fraud, or above-threshold amounts must be escalated.
            </div>

            {decisionError && (
              <div className="alert alert-error" style={{ marginBottom: 12 }}>
                <span>⚠</span><span>{decisionError}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="decision-notes">
                Notes / Reason <span style={{ color: 'var(--t3)' }}>(required for escalation, min 10 chars)</span>
              </label>
              <textarea
                id="decision-notes"
                className="form-input"
                rows={3}
                placeholder="Describe your reasoning — mandatory for escalation…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ resize: 'vertical', fontFamily: 'var(--font)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                id="btn-approve"
                className="btn btn-primary"
                disabled={submitting || !canApprove}
                title={getApproveButtonTitle(canApprove, hasFraud, score)}
                onClick={() => handleDecision('approved')}
                style={{ background: canApprove ? '#2E7D32' : undefined, borderColor: canApprove ? '#2E7D32' : undefined }}
              >
                {submitting ? <span className="spinner" /> : '✓'} Approve
              </button>

              <button
                id="btn-reject"
                className="btn btn-danger"
                disabled={submitting || !canReject}
                title={getRejectButtonTitle(canReject, hasFraud, score)}
                onClick={() => handleDecision('rejected')}
              >
                {submitting ? <span className="spinner" /> : '✗'} Reject
              </button>

              <button
                id="btn-escalate"
                className="btn btn-secondary"
                disabled={submitting}
                onClick={() => handleDecision('escalated')}
                style={{ marginLeft: 'auto' }}
                title="Escalate to Bank Manager (notes required)"
              >
                {submitting ? <span className="spinner" /> : '↑'} Escalate to Manager
              </button>
            </div>

            {(!canApprove || !canReject) && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--t2)' }}>
                <DecisionExplanation hasFraud={hasFraud} score={score} />
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
