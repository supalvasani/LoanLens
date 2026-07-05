import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import type { AnalystQueueItem } from '../../services/loanService';
import { useAnalystQueue } from '../../hooks/useAnalystQueue';
import { useLoanAction } from '../../hooks/useLoanAction';

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score === null) return 'var(--t3)';
  if (score > 65) return '#2E7D32';
  if (score >= 45) return '#d97706';
  return '#C62828';
}

function scoreBg(score: number | null): string {
  if (score === null) return 'transparent';
  if (score > 65) return 'var(--ok-b)';
  if (score >= 45) return '#FFF8E1';
  return 'var(--bad-b)';
}

const STATUS_BADGE: Record<string, string> = {
  pending:      'badge-warn',
  under_review: 'badge-warn',
  approved:     'badge-ok',
  rejected:     'badge-bad',
  escalated:    'badge-warn',
};

// ── Inline action component ───────────────────────────────────────────────────

function InlineActions({
  app,
  onDone,
}: {
  app: AnalystQueueItem;
  onDone: (id: string, action: string) => void;
}) {
  const [open, setOpen]     = useState(false);
  const [notes, setNotes]   = useState('');
  const [mode, setMode]     = useState<'approve' | 'reject' | 'escalate' | null>(null);
  const { submitting: busy, error: err, clearError, submitAnalyst } = useLoanAction();

  const score    = app.score;
  const hasFraud = app.has_fraud_flags;
  const canApprove = !hasFraud && score !== null && score > 65;
  const canReject  = !hasFraud && score !== null && score < 45;

  async function submit() {
    if (!mode) return;
    const actionMode = mode === 'approve' ? 'approved'
      : mode === 'reject' ? 'rejected'
      : 'escalated';
    const ok = await submitAnalyst(app.application_id, actionMode, notes || undefined);
    if (ok) onDone(app.application_id, mode);
  }

  if (!open) {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          className="btn btn-ghost btn-sm"
          title={canApprove ? 'Approve' : 'Cannot approve at this score or fraud status'}
          disabled={!canApprove}
          style={{ color: canApprove ? '#2E7D32' : undefined }}
          onClick={e => { e.stopPropagation(); setMode('approve'); setOpen(true); }}
        >
          ✓
        </button>
        <button
          className="btn btn-ghost btn-sm"
          title={canReject ? 'Reject' : 'Cannot reject at this score or fraud status'}
          disabled={!canReject}
          style={{ color: canReject ? 'var(--bad)' : undefined }}
          onClick={e => { e.stopPropagation(); setMode('reject'); setOpen(true); }}
        >
          ✗
        </button>
        <button
          className="btn btn-ghost btn-sm"
          title="Escalate to Bank Manager"
          style={{ color: '#d97706' }}
          onClick={e => { e.stopPropagation(); setMode('escalate'); setOpen(true); }}
        >
          ↑
        </button>
      </div>
    );
  }

  return (
    <div
      style={{ minWidth: 280 }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t2)', marginBottom: 4, textTransform: 'capitalize' }}>
        {mode} — {app.application_id.slice(0, 8)}…
      </div>
      <textarea
        className="form-input"
        rows={2}
        placeholder={mode === 'escalate' ? 'Escalation reason (min 10 chars)…' : 'Optional notes…'}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        style={{ fontSize: 12, resize: 'none', fontFamily: 'var(--font)' }}
      />
      {err && <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 4 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button
          className="btn btn-primary btn-sm"
          disabled={busy}
          onClick={submit}
          style={{ fontSize: 12 }}
        >
          {busy ? <span className="spinner" /> : 'Confirm'}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { setOpen(false); setNotes(''); clearError(); }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface QueueTableProps {
  rows: AnalystQueueItem[];
  emptyMsg: string;
  navigate: (path: string) => void;
  markDone: (id: string, action: string) => void;
}

function QueueTable({ rows, emptyMsg, navigate, markDone }: QueueTableProps) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Applicant</th>
          <th>Loan Type</th>
          <th>Amount</th>
          <th>Score</th>
          <th>Risk</th>
          <th>Status</th>
          <th>Submitted</th>
          <th>Quick Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>{emptyMsg}</td></tr>
        ) : rows.map(app => (
          <tr
            key={app.application_id}
            style={{ cursor: 'pointer', background: app.has_fraud_flags ? 'var(--bad-b)' : undefined }}
            onClick={() => navigate(`/analyst/applications/${app.application_id}`)}
          >
            {/* Applicant */}
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {app.has_fraud_flags && <span style={{ color: 'var(--bad)' }} title="Fraud flagged">⚠</span>}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {app.applicant_name ?? `…${app.application_id.slice(-6)}`}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'monospace' }}>
                    {app.application_id.slice(0, 8)}…
                  </div>
                </div>
              </div>
            </td>

            {/* Loan type */}
            <td style={{ textTransform: 'capitalize', fontSize: 13 }}>
              {app.loan_type.replace(/_/g, ' ')}
            </td>

            {/* Amount */}
            <td style={{ fontVariantNumeric: 'tabular-nums' }}>
              ₹{Number(app.amount_requested).toLocaleString('en-IN')}
            </td>

            {/* Score badge */}
            <td>
              {app.score !== null ? (
                <span style={{
                  display: 'inline-block', padding: '2px 8px',
                  borderRadius: 4, fontWeight: 700, fontSize: 13,
                  background: scoreBg(app.score),
                  color: scoreColor(app.score),
                }}>
                  {app.score.toFixed(1)}
                </span>
              ) : <span style={{ color: 'var(--t3)' }}>—</span>}
            </td>

            {/* Risk */}
            <td>
              {app.risk_tier ? (
                <span className={`badge ${app.risk_tier === 'high' ? 'badge-bad' : app.risk_tier === 'medium' ? 'badge-warn' : 'badge-ok'}`}>
                  {app.risk_tier}
                </span>
              ) : <span style={{ color: 'var(--t3)' }}>—</span>}
            </td>

            {/* Status */}
            <td>
              <span className={`badge ${STATUS_BADGE[app.status] ?? ''}`}>
                {app.status.replace(/_/g, ' ')}
              </span>
            </td>

            {/* Submitted */}
            <td style={{ color: 'var(--t3)', fontSize: 12 }}>
              {new Date(app.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </td>

            {/* Inline actions */}
            <td onClick={e => e.stopPropagation()}>
              {['pending', 'under_review'].includes(app.status) ? (
                <InlineActions app={app} onDone={markDone} />
              ) : (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => navigate(`/analyst/applications/${app.application_id}`)}
                >
                  View →
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AnalystQueue() {
  const navigate = useNavigate();

  const { filtered, loading, error, search, setSearch, markDone } = useAnalystQueue();

  const pending = filtered.filter((a: AnalystQueueItem) => ['pending', 'under_review'].includes(a.status));
  const other   = filtered.filter((a: AnalystQueueItem) => !['pending', 'under_review'].includes(a.status));


  return (
    <DashboardShell
      title="Review Queue"
      subtitle="Priority sorted — fraud-flagged first, then lowest score"
      actions={
        <input
          type="text"
          className="form-input"
          placeholder="Search by name, ID or type…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
          id="queue-search"
        />
      }
    >
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          <span>⚠</span><span>{error}</span>
        </div>
      )}

      {/* Pending / under-review section */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>
            Pending Action
          </span>
          <span style={{ fontSize: 12, color: 'var(--t3)' }}>
            {loading ? '…' : `${pending.length} application${pending.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>
            <span className="spinner" style={{ marginRight: 8 }} />Loading…
          </div>
        ) : (
          <QueueTable rows={pending} emptyMsg="No pending applications. Queue is clear!" navigate={navigate} markDone={markDone} />
        )}
      </div>

      {/* Closed cases section */}
      {other.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Recently Closed</span>
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>{other.length} case{other.length !== 1 ? 's' : ''}</span>
          </div>
          <QueueTable rows={other} emptyMsg="" navigate={navigate} markDone={markDone} />
        </div>
      )}
    </DashboardShell>
  );
}
