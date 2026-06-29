import { DashboardShell } from '../../components/DashboardShell';
import { useAuth } from '../../contexts/AuthContext';

export default function PortalDashboard() {
  const { user } = useAuth();

  return (
    <DashboardShell title="My Dashboard" subtitle="Overview of your loan applications">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Welcome */}
        <div className="card">
          <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 4 }}>Welcome back</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-.02em' }}>
            {user?.name ?? '—'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 8 }}>
            You have no active loan applications. Use <strong>Apply Now</strong> to get started.
          </div>
        </div>

        {/* KPIs */}
        <div className="grid-3">
          <div className="card">
            <div className="kpi">
              <div className="kpi-label">Applications</div>
              <div className="kpi-value">0</div>
            </div>
          </div>
          <div className="card">
            <div className="kpi">
              <div className="kpi-label">Credit Score</div>
              <div className="kpi-value">—</div>
              <div className="kpi-sub">Run dbt to compute</div>
            </div>
          </div>
          <div className="card">
            <div className="kpi">
              <div className="kpi-label">Max Eligible</div>
              <div className="kpi-value">—</div>
            </div>
          </div>
        </div>

        {/* Empty state */}
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 32, marginBottom: 12, color: 'var(--t3)' }}>◎</div>
          <div style={{ fontWeight: 600, color: 'var(--t1)', marginBottom: 6 }}>No applications yet</div>
          <div style={{ fontSize: 13, color: 'var(--t3)' }}>
            Click Apply Now in the sidebar to submit your first loan application.
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
