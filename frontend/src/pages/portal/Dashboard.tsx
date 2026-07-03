// ─────────────────────────────────────────────────────────────────────────────
// LoanLens — /portal/dashboard
// Real data: applications list, credit score summary, eligibility snapshot
// ─────────────────────────────────────────────────────────────────────────────

import { useNavigate, Link } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { useAuth } from '../../contexts/AuthContext';
import { usePortalData } from '../../hooks/usePortalData';

const STATUS_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  pending:      { bg: 'rgba(148,163,184,.12)', color: '#64748b', label: 'Pending Review' },
  under_review: { bg: 'rgba(245,158,11,.12)',  color: '#d97706', label: 'Under Review' },
  escalated:    { bg: 'rgba(245,158,11,.12)',  color: '#d97706', label: 'Escalated' },
  approved:     { bg: 'rgba(34,197,94,.12)',   color: '#16a34a', label: 'Approved' },
  rejected:     { bg: 'rgba(239,68,68,.12)',   color: '#dc2626', label: 'Rejected' },
};

const LOAN_LABELS: Record<string, string> = {
  personal_loan:  'Personal Loan',
  home_loan:      'Home Loan',
  business_loan:  'Business Loan',
  vehicle_loan:   'Vehicle Loan',
  education_loan: 'Education Loan',
  gold_loan:      'Gold Loan',
  auto_loan:      'Auto Loan',
  two_wheeler_loan: 'Two-Wheeler Loan',
};

function QuickCard({ icon, label, path, desc }: { icon: React.ReactNode; label: string; path: string; desc: string }) {
  const navigate = useNavigate();
  return (
    <div
      className="card"
      style={{ cursor: 'pointer', transition: 'box-shadow 150ms', padding: '18px 20px' }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--sh-md)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--sh)')}
      onClick={() => navigate(path)}
    >
      <div style={{ color: 'var(--ink)', marginBottom: 10, display: 'flex', alignItems: 'center' }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--t1)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'var(--t3)' }}>{desc}</div>
    </div>
  );
}

export default function PortalDashboard() {
  const { user } = useAuth();
  const { apps, score, eligibility, loading } = usePortalData();

  const latestApp = apps[0] ?? null;
  const statusInfo = latestApp ? (STATUS_COLOR[latestApp.status] ?? STATUS_COLOR.pending) : null;
  const bestAmount = eligibility?.best_eligible_amount;

  const scoreNum = score?.score;
  const scoreColor = scoreNum == null ? 'var(--t3)'
    : scoreNum >= 70 ? 'var(--ok)'
    : scoreNum >= 45 ? 'var(--warn)'
    : 'var(--bad)';

  return (
    <DashboardShell
      title="My Dashboard"
      subtitle={`Welcome back, ${user?.name ?? '—'}`}
      actions={
        <Link to="/portal/apply" className="btn btn-primary btn-sm">+ Apply for Loan</Link>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--t3)' }}>
          <span className="spinner" style={{ fontSize: 20 }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* KPI row */}
          <div className="grid-3">
            {/* Credit Score */}
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--t3)', marginBottom: 10 }}>Credit Score</div>
              <div style={{ fontSize: 52, fontWeight: 800, color: scoreColor, letterSpacing: '-.04em', lineHeight: 1 }}>
                {scoreNum != null ? scoreNum.toFixed(0) : '—'}
              </div>
              {score?.risk_tier && (
                <div style={{ fontSize: 11, fontWeight: 600, color: scoreColor, marginTop: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {score.risk_tier.replace(/_/g, ' ')}
                </div>
              )}
              {!score?.has_data && (
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>Upload bank statement to compute</div>
              )}
            </div>

            {/* Max Eligible */}
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--t3)', marginBottom: 10 }}>Max Eligible Amount</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-.02em', lineHeight: 1 }}>
                {bestAmount != null ? `₹${Number(bestAmount).toLocaleString('en-IN')}` : '—'}
              </div>
              {!eligibility?.has_data && (
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>Run dbt pipeline to compute</div>
              )}
            </div>

            {/* Applications */}
            <div className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--t3)', marginBottom: 10 }}>Total Applications</div>
              <div style={{ fontSize: 52, fontWeight: 800, color: 'var(--t1)', letterSpacing: '-.04em', lineHeight: 1 }}>{apps.length}</div>
              {latestApp && (
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 6 }}>
                  Latest: {new Date(latestApp.submitted_at).toLocaleDateString('en-IN')}
                </div>
              )}
            </div>
          </div>

          {/* Latest application status */}
          {latestApp && statusInfo && (
            <div className="card" style={{ padding: '18px 24px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--t3)', marginBottom: 14 }}>
                Latest Application
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--t1)', marginBottom: 4 }}>
                    {LOAN_LABELS[latestApp.loan_type] ?? latestApp.loan_type.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--t2)' }}>
                    ₹{Number(latestApp.amount_requested).toLocaleString('en-IN')} · {(latestApp.purpose ?? '').slice(0, 80)}{(latestApp.purpose ?? '').length > 80 ? '…' : ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>
                    Submitted {new Date(latestApp.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    display: 'inline-block',
                    padding: '8px 18px',
                    borderRadius: 6,
                    background: statusInfo.bg,
                    color: statusInfo.color,
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: '.02em',
                  }}>
                    {statusInfo.label}
                  </div>
                  {latestApp.status === 'rejected' && (
                    <div style={{ marginTop: 8, textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--bad)', fontWeight: 600 }}>
                        Reason: {latestApp.primary_rejection_reason ?? 'Not specified'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
                        See LoanBot for improvement tips →
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Applications history */}
          {apps.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 13 }}>
                Application History
              </div>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map(app => {
                    const si = STATUS_COLOR[app.status] ?? STATUS_COLOR.pending;
                    return (
                      <tr key={app.application_id}>
                        <td style={{ fontWeight: 500 }}>{LOAN_LABELS[app.loan_type] ?? app.loan_type.replace(/_/g, ' ')}</td>
                        <td>₹{Number(app.amount_requested).toLocaleString('en-IN')}</td>
                        <td>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 3, background: si.bg, color: si.color }}>
                            {si.label}
                          </span>
                        </td>
                        <td style={{ color: 'var(--t3)', fontSize: 12 }}>
                          {new Date(app.submitted_at).toLocaleDateString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Quick actions */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--t3)', marginBottom: 12 }}>Quick Actions</div>
            <div className="grid-4">
              <QuickCard
                icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>}
                label="Apply for Loan"
                path="/portal/apply"
                desc="Submit a new application"
              />
              <QuickCard
                icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>}
                label="Credit Score"
                path="/portal/score"
                desc="View your score breakdown"
              />
              <QuickCard
                icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>}
                label="Loan Eligibility"
                path="/portal/eligibility"
                desc="See what you qualify for"
              />
              <QuickCard
                icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>}
                label="Ask LoanBot"
                path="/portal/chatbot"
                desc="Get personalised guidance"
              />
            </div>
          </div>

        </div>
      )}
    </DashboardShell>
  );
}
