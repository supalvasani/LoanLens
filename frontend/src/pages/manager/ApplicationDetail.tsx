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

export default function ManagerApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: detail, loading, error } = useApplication(id, 'manager');
  const { submitting, error: decisionError, submitManager } = useLoanAction();

  const [notes, setNotes] = useState('');
  const [actionDone, setActionDone] = useState<string | null>(null);

  const { hasFraud } = useApplicationDetailData(detail);

  async function handleDecision(decision: 'approved' | 'rejected') {
    if (!id || !notes.trim()) return;
    const ok = await submitManager(id, decision, notes);
    if (ok) setActionDone(decision);
  }

  if (loading) return <DetailLoadingState />;
  if (error || !detail) return <DetailErrorState error={error || 'Application not found'} onBack={() => navigate(-1)} />;

  if (actionDone) {
    return (
      <DetailActionDoneState
        id={id}
        actionDone={actionDone}
        onQueue={() => navigate('/manager/queue')}
        onDashboard={() => navigate('/manager/dashboard')}
      />
    );
  }

  const { application: app, fraud_flags } = detail;
  const canDecide = app.status === 'escalated';

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
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/manager/queue')}>
            ← Queue
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="fade-up">
        {/* Escalation context card */}
        <div className="card" style={{ borderLeft: '4px solid var(--warn)', padding: '16px 20px' }}>
          <SectionHeader>Escalation Information</SectionHeader>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 13 }}>
            <div>
              <span style={{ color: 'var(--t2)', display: 'block', marginBottom: 2 }}>Escalated By</span>
              <strong>{detail.escalated_by_name || 'Credit Analyst'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--t2)', display: 'block', marginBottom: 2 }}>Escalated Date</span>
              <strong>{detail.escalated_at ? new Date(detail.escalated_at).toLocaleString('en-IN') : '—'}</strong>
            </div>
          </div>
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border-s)', paddingTop: 10 }}>
            <span style={{ color: 'var(--t2)', display: 'block', marginBottom: 4, fontSize: 12 }}>Analyst Reason / Notes:</span>
            <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 'var(--r-sm)', fontStyle: 'italic', color: 'var(--ink-soft)' }}>
              "{detail.escalation_reason || 'No notes provided'}"
            </div>
          </div>
        </div>

        {/* Fraud flags alerts list */}
        {hasFraud && (
          <div className="card" style={{ borderColor: 'var(--bad)' }}>
            <div style={{ fontWeight: 700, color: 'var(--bad)', marginBottom: 12, fontSize: 13 }}>
              ⚠ Active Fraud Flags
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fraud_flags.map((f) => (
                <div key={f.flag_type} style={{
                  padding: '10px 14px', background: 'var(--bad-b)',
                  border: '1px solid rgba(198,40,40,.2)', borderRadius: 'var(--r-md)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <strong>{f.flag_type.replaceAll('_', ' ')}</strong>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{f.flag_detail}</div>
                  </div>
                  <span className="badge badge-bad">{f.severity.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shared Credit Report Details & Visualizations */}
        <ApplicationDetailReport detail={detail} role="manager" />

        {/* Manager Decision Panel (final authority) */}
        <div className="card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--sh-md)' }}>
          <SectionHeader>Bank Manager Action — Final Decision</SectionHeader>
          
          {!canDecide ? (
            <div className="alert alert-success">
              <span>✓</span>
              <span>This application is already resolved with status <strong>{app.status.toUpperCase()}</strong>.</span>
            </div>
          ) : (
            <>
              {decisionError && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  <span>⚠</span><span>{decisionError}</span>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" htmlFor="manager-decision-notes">
                  Decision Notes <span style={{ color: 'var(--bad)' }}>* (mandatory)</span>
                </label>
                <textarea
                  id="manager-decision-notes"
                  className="form-input"
                  rows={4}
                  placeholder="Explain why you are approving or rejecting this application..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ resize: 'vertical', fontFamily: 'var(--font)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="btn btn-primary btn-lg"
                  style={{ background: '#2E7D32', borderColor: '#2E7D32', flex: 1 }}
                  disabled={submitting || !notes.trim()}
                  onClick={() => handleDecision('approved')}
                >
                  {submitting ? <span className="spinner" /> : '✓'} Approve Application
                </button>
                <button
                  className="btn btn-danger btn-lg"
                  style={{ flex: 1 }}
                  disabled={submitting || !notes.trim()}
                  onClick={() => handleDecision('rejected')}
                >
                  {submitting ? <span className="spinner" /> : '✗'} Reject Application
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
