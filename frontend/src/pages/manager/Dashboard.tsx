import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { managerService } from '../../services/managerService';
import type { ManagerQueueItem, PortfolioData } from '../../services/managerService';

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const [queue, setQueue] = useState<ManagerQueueItem[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      managerService.getQueue(),
      managerService.getPortfolio()
    ])
      .then(([queueData, portfolioData]) => {
        setQueue(queueData);
        setPortfolio(portfolioData);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load dashboard data. Please try again.');
      })
      .finally(() => setLoading(false));
  }, []);

  const pendingEscalationsCount = queue.length;
  const recentEscalations = queue.slice(0, 5);
  const hasFraudEscalations = queue.some((item) => item.fraud_flags && item.fraud_flags.length > 0);

  // Compute average score from distribution if needed, or get it from portfolio
  // The portfolio API doesn't directly return average score, let's see. Wait!
  // The portfolio response had:
  // "approval_rate, score_distribution, risk_breakdown, avg_emi_to_income_ratio, total_applications, escalated_count"
  // Let's compute average score from the distribution or show a placeholder if unavailable. Or since we have the score_distribution,
  // we can calculate a rough weighted average, or fetch it.
  // Wait, let's look at the score distribution:
  // score_distribution is a list of {score_bucket: "0-20", count: N}.
  // Let's show the total applications, approval rate %, average EMI-to-income, and escalated count as KPIs.
  // Wait, the prompt lists the dashboard KPI cards:
  // "total applications, approval rate %, average score, average EMI-to-income ratio"
  // Let's calculate the average score from the queue scores, or from score_distribution!
  // If we calculate it from queue scores, it would be the average of escalated cases. But for the whole portfolio,
  // we can estimate it from the score distribution:
  // 0-20 -> midpoint 10
  // 21-40 -> midpoint 30
  // 41-60 -> midpoint 50
  // 61-80 -> midpoint 70
  // 81-100 -> midpoint 90
  // Average score = sum(midpoint * count) / sum(count)
  let calculatedAvgScore = 0;
  if (portfolio && portfolio.score_distribution) {
    let totalScore = 0;
    let totalCount = 0;
    const midpoints: Record<string, number> = {
      '0-20': 10,
      '21-40': 30,
      '41-60': 50,
      '61-80': 70,
      '81-100': 90,
    };
    for (const bucket of portfolio.score_distribution) {
      const mid = midpoints[bucket.score_bucket] ?? 50;
      totalScore += mid * bucket.count;
      totalCount += bucket.count;
    }
    calculatedAvgScore = totalCount > 0 ? Math.round(totalScore / totalCount) : 0;
  }

  return (
    <DashboardShell title="Manager Dashboard" subtitle="Branch overview and escalations">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="fade-up">
        {error && (
          <div className="alert alert-error">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Fraud Flag Alert */}
        {hasFraudEscalations && (
          <div className="alert alert-error" style={{ display: 'flex', alignItems: 'center', justifyContent: 'between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>⚠</span>
              <div>
                <strong>Fraud Alert:</strong> There are applications in the queue with active fraud flags.
                Please review them immediately.
              </div>
            </div>
            <button
              className="btn btn-sm btn-danger"
              style={{ marginLeft: 'auto' }}
              onClick={() => navigate('/manager/queue')}
            >
              View Queue
            </button>
          </div>
        )}

        {/* KPI Grid */}
        <div className="grid-4">
          <div className="card">
            <div className="kpi">
              <div className="kpi-label">Total Applications</div>
              <div className="kpi-value">{loading ? '...' : portfolio?.total_applications ?? 0}</div>
              <div className="kpi-sub">Across all segments</div>
            </div>
          </div>
          <div className="card">
            <div className="kpi">
              <div className="kpi-label">Approval Rate</div>
              <div className="kpi-value">
                {loading ? '...' : `${portfolio?.approval_rate ?? 0}%`}
              </div>
              <div className="kpi-sub">Approved vs total decided</div>
            </div>
          </div>
          <div className="card">
            <div className="kpi">
              <div className="kpi-label">Avg Credit Score</div>
              <div className="kpi-value">{loading ? '...' : calculatedAvgScore || '—'}</div>
              <div className="kpi-sub">Weighted portfolio average</div>
            </div>
          </div>
          <div className="card">
            <div className="kpi">
              <div className="kpi-label">Avg EMI to Income</div>
              <div className="kpi-value">
                {loading ? '...' : `${((portfolio?.avg_emi_to_income_ratio ?? 0) * 100).toFixed(1)}%`}
              </div>
              <div className="kpi-sub">Monthly burden ratio</div>
            </div>
          </div>
        </div>

        {/* Action Callout if Pending Escalations */}
        {pendingEscalationsCount > 0 && (
          <div
            style={{
              background: 'linear-gradient(135deg, var(--ink) 0%, #333 100%)',
              color: '#fff',
              padding: '24px 28px',
              borderRadius: 'var(--r-lg)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: 'var(--sh-md)',
            }}
          >
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                Review Pending Escalations
              </h3>
              <p style={{ color: 'var(--t3)', fontSize: 13 }}>
                You have <span style={{ color: '#fff', fontWeight: 600 }}>{pendingEscalationsCount}</span> application{pendingEscalationsCount > 1 ? 's' : ''} awaiting your final decision.
              </p>
            </div>
            <button className="btn btn-secondary" onClick={() => navigate('/manager/queue')}>
              Open Escalation Queue
            </button>
          </div>
        )}

        {/* Recent Escalations Table */}
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
            <span style={{ fontWeight: 600, fontSize: 14 }}>Recent Escalations (Last 5)</span>
            <span
              style={{
                background: 'var(--bg)',
                padding: '2px 8px',
                borderRadius: 2,
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--t2)',
                border: '1px solid var(--border)',
              }}
            >
              {queue.length} Pending Total
            </span>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Applicant Name</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Score</th>
                <th>Fraud Flag</th>
                <th>Escalation Note</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>
                    <span className="spinner" style={{ marginRight: 8 }}></span> Loading escalations…
                  </td>
                </tr>
              ) : recentEscalations.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--t3)' }}>
                    All clear — no urgent escalations at the moment.
                  </td>
                </tr>
              ) : (
                recentEscalations.map((app) => {
                  const score = app.score;
                  const scoreColor = score !== null
                    ? (score >= 70 ? 'var(--ok)' : score >= 45 ? 'var(--warn)' : 'var(--bad)')
                    : 'var(--t3)';

                  const hasFraud = app.fraud_flags && app.fraud_flags.length > 0;

                  return (
                    <tr
                      key={app.application_id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/manager/applications/${app.application_id}`)}
                    >
                      <td style={{ fontWeight: 500 }}>
                        {app.applicant_name || 'Unknown Applicant'}
                      </td>
                      <td style={{ textTransform: 'capitalize' }}>
                        {app.loan_type.replace(/_/g, ' ')}
                      </td>
                      <td>₹{Number(app.amount_requested).toLocaleString('en-IN')}</td>
                      <td style={{ fontWeight: 600, color: scoreColor }}>
                        {score !== null ? score : '—'}
                      </td>
                      <td>
                        {hasFraud ? (
                          <span className="badge badge-bad">Active Flag</span>
                        ) : (
                          <span className="badge badge-ok">Clear</span>
                        )}
                      </td>
                      <td
                        style={{
                          maxWidth: 200,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: 'var(--t2)',
                        }}
                      >
                        {app.escalation_reason || 'No note provided'}
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/manager/applications/${app.application_id}`);
                          }}
                        >
                          Review
                        </button>
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
