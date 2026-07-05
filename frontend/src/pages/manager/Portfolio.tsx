import { useState, useEffect } from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  PieChart, Pie, Legend
} from 'recharts';
import { managerService } from '../../services/managerService';
import type { PortfolioData } from '../../services/managerService';

export default function ManagerPortfolio() {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    managerService.getPortfolio()
      .then((data) => {
        setPortfolio(data);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load portfolio analytics.');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <DashboardShell title="Branch Portfolio" subtitle="Capital allocation and risk insights">
      <div style={{ textAlign: 'center', padding: 80, color: 'var(--t3)' }}>
        <span className="spinner" style={{ fontSize: 20, marginRight: 8 }} />
        Loading portfolio analytics…
      </div>
    </DashboardShell>
  );

  if (error || !portfolio) return (
    <DashboardShell title="Branch Portfolio">
      <div className="alert alert-error"><span>⚠</span><span>{error || 'No portfolio data'}</span></div>
    </DashboardShell>
  );

  // Approval Rate Donut Chart Data
  const approvalData = [
    { name: 'Approved', value: portfolio.approval_rate, color: '#2E7D32' },
    { name: 'Rejected/Pending', value: Math.max(0, 100 - portfolio.approval_rate), color: 'var(--border)' },
  ];

  return (
    <DashboardShell title="Branch Portfolio" subtitle="Capital allocation and risk insights">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="fade-up">
        {/* KPI Grid */}
        <div className="grid-4">
          <div className="card">
            <div className="kpi">
              <div className="kpi-label">Total Applications</div>
              <div className="kpi-value">{portfolio.total_applications}</div>
              <div className="kpi-sub">Overall submission volume</div>
            </div>
          </div>
          <div className="card">
            <div className="kpi">
              <div className="kpi-label">Approval Rate</div>
              <div className="kpi-value">{portfolio.approval_rate}%</div>
              <div className="kpi-sub">Total approved vs decided</div>
            </div>
          </div>
          <div className="card">
            <div className="kpi">
              <div className="kpi-label">Escalated Applications</div>
              <div className="kpi-value">{portfolio.escalated_count}</div>
              <div className="kpi-sub">Awaiting decision</div>
            </div>
          </div>
          <div className="card">
            <div className="kpi">
              <div className="kpi-label">Avg EMI to Income</div>
              <div className="kpi-value">{(portfolio.avg_emi_to_income_ratio * 100).toFixed(1)}%</div>
              <div className="kpi-sub">Branch credit safety limit</div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid-2">
          {/* Score distribution bar chart */}
          <div className="card" style={{ height: 350 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 20 }}>
              Credit Score Distribution
            </div>
            <ResponsiveContainer width="100%" height="80%">
              <BarChart data={portfolio.score_distribution} margin={{ top: 4, right: 16, bottom: 4, left: -20 }}>
                <CartesianGrid stroke="#E2DDD6" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="score_bucket" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--t3)' }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--t3)' }} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #E2DDD6', borderRadius: 4, fontSize: 13 }}
                  itemStyle={{ color: 'var(--ink)', fontWeight: 600 }}
                  labelStyle={{ color: 'var(--t3)', fontSize: 11 }}
                  cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                />
                <Bar dataKey="count" fill="var(--ink)" radius={[3, 3, 0, 0]} barSize={44}>
                  {portfolio.score_distribution.map((entry, index) => {
                    // Custom colors per bucket
                    let color = '#C62828'; // bad for low scores
                    if (entry.score_bucket === '81-100' || entry.score_bucket === '61-80') {
                      color = '#2E7D32';
                    } else if (entry.score_bucket === '41-60') {
                      color = '#d97706';
                    }
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Donut chart for approval rate */}
          <div className="card" style={{ height: 350, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 20 }}>
              Approval vs Rejection Ratio
            </div>
            <div style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={approvalData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {approvalData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
                  <Legend wrapperStyle={{ fontSize: 11, marginTop: 10 }} />
                </PieChart>
              </ResponsiveContainer>
              {/* Text in the middle of Donut */}
              <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--ok)' }}>{portfolio.approval_rate}%</span>
                <span style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Approved</span>
              </div>
            </div>
          </div>
        </div>

        {/* Risk segment breakdown */}
        <div className="card">
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 16 }}>
            Risk Tier Segmentation Breakdown
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            <div style={{ padding: '16px 20px', background: 'var(--ok-b)', borderRadius: 'var(--r-md)', border: '1px solid rgba(46,125,50,.15)' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--ok)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Low Risk</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--ok)' }}>{portfolio.risk_breakdown.low_count}</span>
                <span style={{ fontSize: 13, color: 'var(--t2)' }}>applicants</span>
              </div>
            </div>

            <div style={{ padding: '16px 20px', background: 'var(--warn-b)', borderRadius: 'var(--r-md)', border: '1px solid rgba(230,81,0,.15)' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Medium Risk</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--warn)' }}>{portfolio.risk_breakdown.medium_count}</span>
                <span style={{ fontSize: 13, color: 'var(--t2)' }}>applicants</span>
              </div>
            </div>

            <div style={{ padding: '16px 20px', background: 'var(--bad-b)', borderRadius: 'var(--r-md)', border: '1px solid rgba(198,40,40,.15)' }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--bad)', textTransform: 'uppercase', letterSpacing: '.05em' }}>High Risk</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--bad)' }}>{portfolio.risk_breakdown.high_count}</span>
                <span style={{ fontSize: 13, color: 'var(--t2)' }}>applicants</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
