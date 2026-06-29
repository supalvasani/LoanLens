import { DashboardShell } from '../../components/DashboardShell';

export default function ManagerDashboard() {
  return (
    <DashboardShell title="Manager Dashboard" subtitle="Branch overview and escalations">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div className="grid-4">
          <div className="card"><div className="kpi">
            <div className="kpi-label">Escalations</div>
            <div className="kpi-value">5</div>
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
                <th>Applicant</th>
                <th>Score</th>
                <th>Reason</th>
                <th>Escalated</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--t3)' }}>
                  All clear — no urgent escalations at the moment.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </DashboardShell>
  );
}
