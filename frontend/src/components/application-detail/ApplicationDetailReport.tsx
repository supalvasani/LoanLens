import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, PieChart, Pie, Legend,
} from 'recharts';
import type { ApplicationFull } from '../../types/loan';
import { useApplicationDetailData } from '../../hooks/useApplicationDetailData';
import {
  SectionHeader,
  MetricRow,
  ScoreGauge,
} from './ApplicationDetailShared';
import {
  scoreColor,
  getRiskSegmentColor,
  getDecisionBadgeClass,
  PIE_COLORS,
} from '../../utils/creditHelpers';

interface ApplicationDetailReportProps {
  readonly detail: ApplicationFull;
  readonly role?: 'manager' | 'analyst';
}

export function ApplicationDetailReport({ detail, role = 'analyst' }: Readonly<ApplicationDetailReportProps>) {
  const {
    application: app,
    credit_score,
    eligibility,
    underwriter_report,
    risk_tier,
    decisions,
  } = detail;

  const {
    score,
    scoreBarData,
    trendData,
    pieData,
  } = useApplicationDetailData(detail);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Grid 1: Application details + Credit assessment */}
      <div className="grid-2">
        <div className="card">
          <SectionHeader>Application Details</SectionHeader>
          <MetricRow label="Loan Type"        value={app.loan_type.replaceAll('_', ' ')} />
          <MetricRow label="Amount Requested" value={`₹${Number(app.amount_requested).toLocaleString('en-IN')}`} />
          <MetricRow label="Purpose"          value={app.purpose} />
          <MetricRow label="Current Status"   value={app.status.replaceAll('_', ' ')} />
          <MetricRow label="Risk Tier"        value={risk_tier?.replaceAll('_', ' ') ?? '—'} />
          <MetricRow label="Submitted"        value={new Date(app.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
        </div>

        <div className="card">
          <SectionHeader>Credit Assessment</SectionHeader>
          {credit_score ? (
            <>
              <ScoreGauge score={credit_score.score ?? 0} role={role} />
              <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--bg)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--t2)' }}>
                💡 {credit_score.recommendation ?? 'No recommendation available.'}
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)', fontSize: 13 }}>
              No credit score yet.
            </div>
          )}
        </div>
      </div>

      {/* Grid 2: Charts (BarChart & LineChart) */}
      {credit_score && (
        <div className="grid-2">
          <div className="card">
            <SectionHeader>Score Component Breakdown</SectionHeader>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={scoreBarData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--t2)' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--t3)' }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}
                  formatter={(v: unknown) => [`${v}/100`, 'Score']}
                />
                <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                  {scoreBarData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.value >= 70 ? '#2E7D32' : entry.value >= 45 ? '#d97706' : '#C62828'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <SectionHeader>Monthly Credit Trend (6 months)</SectionHeader>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData} margin={{ top: 0, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--t2)' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--t3)' }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}
                    formatter={(v: unknown) => [`${v}`, 'Score']}
                  />
                  <Line
                    type="monotone" dataKey="score"
                    stroke={scoreColor(score)} strokeWidth={2.5}
                    dot={{ r: 4, fill: scoreColor(score) }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: 'var(--t3)', fontSize: 13 }}>
                No trend data.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grid 3: Underwriter Report + PieChart */}
      <div className="grid-2">
        <div className="card">
          <SectionHeader>Underwriter Report</SectionHeader>
          {underwriter_report ? (
            <>
              <MetricRow
                label="Avg Monthly Income"
                value={`₹${Number(underwriter_report.avg_monthly_income ?? 0).toLocaleString('en-IN')}`}
              />
              <MetricRow
                label="EMI Burden Ratio"
                value={`${((underwriter_report.emi_burden_ratio ?? 0) * 100).toFixed(1)}%`}
                note={(underwriter_report.emi_burden_ratio ?? 0) > 0.5 ? '⚠ High burden' : '✓ Acceptable'}
                alert={(underwriter_report.emi_burden_ratio ?? 0) > 0.5}
              />
              <MetricRow
                label="Savings Potential"
                value={`₹${Number(underwriter_report.savings_potential ?? 0).toLocaleString('en-IN')}`}
              />
              <MetricRow
                label="Bounce Count"
                value={underwriter_report.bounce_count ?? 0}
                alert={(underwriter_report.bounce_count ?? 0) > 3}
              />
              <MetricRow
                label="Bounce Rate"
                value={`${((underwriter_report.bounce_rate ?? 0) * 100).toFixed(1)}%`}
                note={(underwriter_report.bounce_rate ?? 0) > 0.2 ? '⚠ Elevated' : '✓ Low'}
                alert={(underwriter_report.bounce_rate ?? 0) > 0.2}
              />
              <div style={{ marginTop: 12 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em',
                  color: getRiskSegmentColor(underwriter_report.risk_segment),
                }}>
                  ● {underwriter_report.risk_segment?.replaceAll('_', ' ') ?? 'N/A'} Risk
                </span>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--t3)', fontSize: 13 }}>
              No underwriter data available.
            </div>
          )}
        </div>

        <div className="card">
          <SectionHeader>Score Breakdown Distribution</SectionHeader>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent ? percent * 100 : 0).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={PIE_COLORS[scoreBarData.findIndex(s => s.name === entry.name) % PIE_COLORS.length] || '#4F81C7'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: 'var(--t3)', fontSize: 13 }}>
              No score breakdown data.
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Eligibility Table */}
      <div className="card">
        <SectionHeader>Loan Eligibility — All Types</SectionHeader>
        {eligibility.length > 0 ? (
          <table className="tbl" style={{ marginTop: 0 }}>
            <thead>
              <tr>
                <th>Loan Type</th>
                <th>Eligible Amount</th>
                <th>Applied Amount</th>
                <th>Gap</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {eligibility.map(e => (
                <tr key={e.loan_type}>
                  <td style={{ textTransform: 'capitalize' }}>{e.loan_type.replaceAll('_', ' ')}</td>
                  <td>₹{Number(e.eligible_amount ?? 0).toLocaleString('en-IN')}</td>
                  <td>₹{Number(e.applied_amount ?? 0).toLocaleString('en-IN')}</td>
                  <td style={{ color: Number(e.gap_amount) > 0 ? 'var(--bad)' : 'var(--ok)' }}>
                    {Number(e.gap_amount ?? 0) > 0
                      ? `₹${Number(e.gap_amount).toLocaleString('en-IN')} gap`
                      : '✓ Covered'
                    }
                  </td>
                  <td>
                    <span className={`badge ${e.decision === 'eligible' ? 'badge-ok' : 'badge-bad'}`}>
                      {e.decision ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--t3)', fontSize: 13 }}>
            No eligibility data.
          </div>
        )}
      </div>

      {/* Row 5: Decision History */}
      {decisions.length > 0 && (
        <div className="card">
          <SectionHeader>Decision History</SectionHeader>
          {decisions.map(d => (
            <div key={d.decision_id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: '1px solid var(--border-s)',
            }}>
              <div>
                <span className={`badge ${getDecisionBadgeClass(d.decision)}`}>
                  {d.decision}
                </span>
                {d.notes && <span style={{ fontSize: 12, color: 'var(--t2)', marginLeft: 10 }}>{d.notes}</span>}
              </div>
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>
                {new Date(d.decided_at).toLocaleDateString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
