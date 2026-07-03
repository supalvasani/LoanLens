import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { loanService } from '../../services/loanService';
import type { LoanApplication } from '../../types/loan';

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<LoanApplication[]>([]);
  const [scores, setScores] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    loanService.getApplications()
      .then(async (allApps) => {
        const escalated = allApps.filter((a) => a.status === 'escalated');
        setApps(escalated);

        // Fetch scores in the background for the escalated applications
        const scorePromises = escalated.map(async (app) => {
          try {
            const detail = await loanService.getApplication(app.application_id);
            return { id: app.application_id, score: detail.credit_score?.score ?? null };
          } catch {
            return { id: app.application_id, score: null };
          }
        });
        const resolvedScores = await Promise.all(scorePromises);
        const scoreMap: Record<string, number | null> = {};
        for (const item of resolvedScores) {
          scoreMap[item.id] = item.score;
        }
        setScores(scoreMap);
      })
      .catch(() => setError('Failed to load escalations'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell title="Manager Dashboard" subtitle="Branch overview and escalations">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {error && <div className="alert alert-error"><span>⚠</span><span>{error}</span></div>}

        <div className="grid-4">
          <div className="card"><div className="kpi">
            <div className="kpi-label">Escalations</div>
            <div className="kpi-value">{loading ? '...' : apps.length}</div>
            <div className="kpi-sub">Pending your decision</div>
          </div></div>
          <div className="card"><div className="kpi">
            <div className="kpi-label">Approval Rate</div>
            <div className="kpi-value">78%</div>
          </div></div>
          <div className="card"><div className="kpi">
            <div className="kpi-label">Avg Score</div>
            <div className="kpi-value">72</div>
          </div></div>
          <div className="card"><div className="kpi">
            <div className="kpi-label">Open Pipeline</div>
            <div className="kpi-value">34</div>
          </div></div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>
            Urgent Escalations
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>App ID</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Score</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>
                    Loading…
                  </td>
                </tr>
              ) : apps.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--t3)' }}>
                    All clear — no urgent escalations at the moment.
                  </td>
                </tr>
              ) : (
                apps.map((app) => {
                  const score = scores[app.application_id];
                  const scoreColor = score !== undefined && score !== null
                    ? (score >= 70 ? 'var(--ok)' : score >= 45 ? 'var(--warn)' : 'var(--bad)')
                    : 'var(--t3)';

                  return (
                    <tr
                      key={app.application_id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate('/manager/queue')}
                    >
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {app.application_id.slice(0, 8)}…
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>
                        {app.loan_type.replace(/_/g, ' ')}
                      </td>
                      <td>₹{Number(app.amount_requested).toLocaleString('en-IN')}</td>
                      <td style={{ fontWeight: 600, color: scoreColor }}>
                        {score !== undefined && score !== null ? score : '—'}
                      </td>
                      <td style={{ color: 'var(--t3)', fontSize: 12 }}>
                        {new Date(app.submitted_at).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>
    </DashboardShell>
  );
}

