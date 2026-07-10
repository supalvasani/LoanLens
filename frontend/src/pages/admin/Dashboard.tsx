import { DashboardShell } from '../../components/DashboardShell';

export default function AdminDashboard() {
  return (
    <DashboardShell title="Admin Dashboard" subtitle="System health and platform overview">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div className="grid-4">
          <div className="card"><div className="kpi">
            <div className="kpi-label">Active Users</div>
            <div className="kpi-value">4</div>
          </div></div>
          <div className="card"><div className="kpi">
            <div className="kpi-label">API Status</div>
            <div className="kpi-value" style={{ color: 'var(--ok)', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
              <span>Online</span>
            </div>
          </div></div>
          <div className="card"><div className="kpi">
            <div className="kpi-label">Pipeline</div>
            <div className="kpi-value" style={{ fontSize: 18, color: 'var(--t2)' }}>Idle</div>
          </div></div>
          <div className="card"><div className="kpi">
            <div className="kpi-label">Applications</div>
            <div className="kpi-value">0</div>
          </div></div>
        </div>

        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 14 }}>
            System Log
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: 12, color: 'var(--t2)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '14px 16px', lineHeight: 1.8 }}>
            [OK] LoanLens API — online on :8000<br/>
            [OK] PostgreSQL 16 — healthy on :5432<br/>
            [OK] Alembic head: 20260630_0003<br/>
            [OK] Seed users: 4 accounts verified<br/>
            [—] dbt mart: not yet run
          </div>
        </div>

      </div>
    </DashboardShell>
  );
}
