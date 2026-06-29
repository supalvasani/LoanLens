import { DashboardShell } from '../../components/DashboardShell';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const DIST = [
  { segment: '< 45', count: 120, label: 'Reject Zone' },
  { segment: '45–55', count: 210, label: 'High Risk' },
  { segment: '56–65', count: 340, label: 'Med Risk' },
  { segment: '66–80', count: 480, label: 'Low Risk' },
  { segment: '> 80',  count: 150, label: 'Very Low Risk' },
];

export default function ManagerPortfolio() {
  return (
    <DashboardShell title="Branch Portfolio" subtitle="Risk distribution and capital overview">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div className="grid-3">
          <div className="card"><div className="kpi">
            <div className="kpi-label">Total Capital</div>
            <div className="kpi-value">₹42.5 Cr</div>
          </div></div>
          <div className="card"><div className="kpi">
            <div className="kpi-label">Approval Rate</div>
            <div className="kpi-value">78%</div>
          </div></div>
          <div className="card"><div className="kpi">
            <div className="kpi-label">30+ DPD Rate</div>
            <div className="kpi-value">1.2%</div>
          </div></div>
        </div>

        <div className="card" style={{ height: 380 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 20 }}>
            Score Distribution
          </div>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={DIST} margin={{ top: 4, right: 16, bottom: 4, left: -20 }}>
              <CartesianGrid stroke="#E2DDD6" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="segment" axisLine={false} tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--t3)' }} dy={8} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--t3)' }} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #E2DDD6', borderRadius: 4, fontSize: 13 }}
                itemStyle={{ color: 'var(--ink)', fontWeight: 600 }}
                labelStyle={{ color: 'var(--t3)', fontSize: 11 }}
                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
              />
              <Bar dataKey="count" fill="var(--ink)" radius={[3, 3, 0, 0]} barSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
    </DashboardShell>
  );
}
