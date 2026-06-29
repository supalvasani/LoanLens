import { DashboardShell } from '../../components/DashboardShell';

export default function AnalystDashboard() {
  return (
    <DashboardShell title="Analyst Dashboard" subtitle="Your credit review workload">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div className="grid-3">
          <div className="card"><div className="kpi">
            <div className="kpi-label">Pending Reviews</div>
            <div className="kpi-value">12</div>
          </div></div>
          <div className="card"><div className="kpi">
            <div className="kpi-label">Escalated Today</div>
            <div className="kpi-value">3</div>
          </div></div>
          <div className="card"><div className="kpi">
            <div className="kpi-label">Avg Processing</div>
            <div className="kpi-value">45m</div>
          </div></div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>
            Application Queue
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>App ID</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--t3)' }}>
                  No applications pending. Check the Review Queue tab.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </DashboardShell>
  );
}
