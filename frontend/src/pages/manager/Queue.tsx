import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { managerService } from '../../services/managerService';
import type { ManagerQueueItem } from '../../services/managerService';

function getQueueScoreColor(score: number | null): string {
  if (score === null) return 'var(--t3)';
  if (score >= 70) return 'var(--ok)';
  if (score >= 45) return 'var(--warn)';
  return 'var(--bad)';
}

function renderQueueTableRows(
  loading: boolean,
  queue: ManagerQueueItem[],
  navigate: (path: string) => void
) {
  if (loading) {
    return (
      <tr>
        <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>
          <span className="spinner" style={{ marginRight: 8 }}></span> Loading queue…
        </td>
      </tr>
    );
  }
  if (queue.length === 0) {
    return (
      <tr>
        <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>
          No escalated applications in queue.
        </td>
      </tr>
    );
  }
  return queue.map((app) => {
    const score = app.score;
    const scoreColor = getQueueScoreColor(score);
    const hasFraud = app.fraud_flags && app.fraud_flags.length > 0;

    return (
      <tr
        key={app.application_id}
        style={{ cursor: 'pointer' }}
        onClick={() => navigate(`/manager/applications/${app.application_id}`)}
      >
        <td style={{ fontWeight: 600 }}>
          {app.applicant_name || 'Unknown'}
        </td>
        <td style={{ textTransform: 'capitalize' }}>
          {app.loan_type.replaceAll('_', ' ')}
        </td>
        <td>₹{Number(app.amount_requested).toLocaleString('en-IN')}</td>
        <td style={{ fontWeight: 700, color: scoreColor }}>
          {score !== null ? score : '—'}
        </td>
        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--t2)' }}>
          {app.escalation_reason || 'No note'}
        </td>
        <td>
          {hasFraud ? (
            <span className="badge badge-bad">
              {app.fraud_flags[0].severity.toUpperCase()}
            </span>
          ) : (
            <span className="badge badge-ok">Clear</span>
          )}
        </td>
        <td style={{ color: 'var(--t3)', fontSize: 12 }}>
          {app.escalated_at ? new Date(app.escalated_at).toLocaleDateString('en-IN') : '—'}
        </td>
        <td style={{ fontSize: 12 }}>
          {app.escalated_by_name || 'Analyst'}
        </td>
        <td>
          <button className="btn btn-primary btn-sm">
            Review →
          </button>
        </td>
      </tr>
    );
  });
}

export default function ManagerQueue() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<ManagerQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = () => {
    setLoading(true);
    managerService.getQueue()
      .then((data) => {
        setQueue(data);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load escalation queue. Please try again.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        fetchQueue();
      }
    });
    return () => { active = false; };
  }, []);

  return (
    <DashboardShell
      title="Escalation Queue"
      subtitle={`${queue.length} application(s) awaiting your decision`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="fade-up">
        {error && (
          <div className="alert alert-error">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>Escalated Applications Queue</span>
            <button className="btn btn-sm btn-secondary" onClick={fetchQueue} disabled={loading}>
              Refresh
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Applicant Name</th>
                  <th>Loan Type</th>
                  <th>Amount</th>
                  <th>Credit Score</th>
                  <th>Escalation Reason</th>
                  <th>Fraud Flag</th>
                  <th>Escalated Date</th>
                  <th>Escalated By</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {renderQueueTableRows(loading, queue, navigate)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
