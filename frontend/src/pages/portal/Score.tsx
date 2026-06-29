import { DashboardShell } from '../../components/DashboardShell';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const TREND = [
  { month: 'Jan', score: 65 },
  { month: 'Feb', score: 66 },
  { month: 'Mar', score: 68 },
  { month: 'Apr', score: 71 },
  { month: 'May', score: 72 },
  { month: 'Jun', score: 74 },
];

const FACTORS = [
  { label: 'Income Stability',  score: 90, note: 'Strong' },
  { label: 'EMI Burden',        score: 65, note: 'Moderate' },
  { label: 'Bounce Rate',       score: 100, note: 'Excellent' },
  { label: 'Balance Stability', score: 50,  note: 'Fair' },
];

export default function PortalScore() {
  return (
    <DashboardShell title="Credit Score" subtitle="Your financial health and scoring metrics">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Top row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20 }}>

          {/* Score card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 12 }}>
              Credit Score
            </div>
            <div style={{ fontSize: 72, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.04em', lineHeight: 1 }}>
              74
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ok)', letterSpacing: '.06em', textTransform: 'uppercase', marginTop: 10 }}>
              Low Risk
            </div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 12, maxWidth: 180 }}>
              Score trending upward. Maintain low utilization for best results.
            </div>
          </div>

          {/* Factors */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 18 }}>
              Score Factors
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {FACTORS.map(f => (
                <div key={f.label} className="progress-row">
                  <div className="progress-header">
                    <span style={{ fontWeight: 600, color: 'var(--t1)', fontSize: 13 }}>{f.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--t2)' }}>{f.note} ({f.score}/100)</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${f.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="card" style={{ height: 300 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 16 }}>
            6-Month Trend
          </div>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={TREND} margin={{ top: 4, right: 16, bottom: 4, left: -20 }}>
              <CartesianGrid stroke="#E2DDD6" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--t3)' }} dy={8} />
              <YAxis axisLine={false} tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--t3)' }} domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #E2DDD6', borderRadius: 4, fontSize: 13 }}
                itemStyle={{ color: 'var(--ink)', fontWeight: 600 }}
                labelStyle={{ color: 'var(--t3)', fontSize: 11 }}
              />
              <Line type="monotone" dataKey="score" stroke="var(--ink)" strokeWidth={2.5}
                dot={{ r: 4, fill: 'var(--ink)', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: 'var(--ink)', strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>
    </DashboardShell>
  );
}
