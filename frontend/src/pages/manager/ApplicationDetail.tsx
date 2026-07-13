import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, PieChart, Pie, Legend,
} from 'recharts';
import { DashboardShell } from '../../components/DashboardShell';
import { managerService } from '../../services/managerService';
import type { ApplicationFull } from '../../types/loan';

function scoreColor(score: number | null): string {
  if (score === null) return 'var(--t3)';
  if (score > 65)  return '#2E7D32';
  if (score >= 45) return '#d97706';
  return '#C62828';
}

const PIE_COLORS = ['#4F81C7', '#2E7D32', '#d97706', '#C62828', '#7C3AED', '#0891b2'];

function SectionHeader({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 700, letterSpacing: '.08em',
      textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

function MetricRow({ label, value, note, alert }: Readonly<{
  label: string; value: string | number; note?: string; alert?: boolean;
}>) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0', borderBottom: '1px solid var(--border-s)',
    }}>
      <span style={{ fontSize: 12, color: 'var(--t2)' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: alert ? 'var(--bad)' : 'var(--t1)' }}>{value}</span>
        {note && <div style={{ fontSize: 11, color: alert ? 'var(--bad)' : 'var(--t3)' }}>{note}</div>}
      </div>
    </div>
  );
}

function getManagerScoreGaugeLabel(score: number): string {
  if (score > 65) return 'High Score';
  if (score >= 45) return 'Grey Zone';
  return 'Low Score';
}

function ScoreGauge({ score }: Readonly<{ score: number }>) {
  const color = scoreColor(score);
  const label = getManagerScoreGaugeLabel(score);
  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <div style={{ fontSize: 64, fontWeight: 900, color, letterSpacing: '-0.05em', lineHeight: 1 }}>
        {score.toFixed(0)}
      </div>
      <div style={{ fontSize: 12, color, fontWeight: 600, marginTop: 6 }}>{label}</div>
      <div style={{ marginTop: 14, height: 8, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${Math.min(100, score)}%`,
          background: color, borderRadius: 99, transition: 'width .8s ease',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--t3)' }}>
        <span>0</span><span>45</span><span>65</span><span>100</span>
      </div>
    </div>
  );
}

function getRiskSegmentColor(segment?: string | null): string {
  if (segment === 'high') return 'var(--bad)';
  if (segment === 'medium') return '#d97706';
  return 'var(--ok)';
}

function getDecisionHistoryBadgeClass(decision: string): string {
  if (decision === 'approved') return 'badge-ok';
  if (decision === 'rejected') return 'badge-bad';
  return 'badge-warn';
}

function ManagerDetailLoading() {
  return (
    <DashboardShell title="Loading…" subtitle="Fetching credit report">
      <div style={{ textAlign: 'center', padding: 80, color: 'var(--t3)' }}>
        <span className="spinner" style={{ fontSize: 20, marginRight: 8 }} />{' '}
        Loading application…
      </div>
    </DashboardShell>
  );
}

function ManagerDetailError({ error, onBack }: Readonly<{ error: string; onBack: () => void }>) {
  return (
    <DashboardShell title="Error">
      <div className="alert alert-error"><span>⚠</span><span>{error}</span></div>
      <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={onBack}>
        ← Back
      </button>
    </DashboardShell>
  );
}

function ManagerDetailActionDone({
  id,
  actionDone,
  onQueue,
  onDashboard,
}: Readonly<{
  id?: string;
  actionDone: string;
  onQueue: () => void;
  onDashboard: () => void;
}>) {
  return (
    <DashboardShell title="Decision Recorded">
      <div className="alert alert-success" style={{ marginBottom: 20 }}>
        <span>✓</span>
        <span>
          Application <strong>{id?.slice(0, 8)}…</strong> has been{' '}
          <strong>{actionDone === 'approved' ? 'Approved' : 'Rejected'}</strong>.
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" onClick={onQueue}>
          ← Back to Queue
        </button>
        <button className="btn btn-ghost" onClick={onDashboard}>
          Dashboard
        </button>
      </div>
    </DashboardShell>
  );
}

export default function ManagerApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<(ApplicationFull & {
    escalation_reason: string | null;
    escalated_by_name: string | null;
    escalated_at: string | null;
  }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [actionDone, setActionDone] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setLoading(true);
      managerService.getApplication(id)
        .then((data) => {
          if (!active) return;
          setDetail(data);
          setError(null);
        })
        .catch((err) => {
          if (!active) return;
          setError(err.response?.data?.detail || 'Failed to load application');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });
    return () => { active = false; };
  }, [id]);

  async function handleDecision(decision: 'approved' | 'rejected') {
    if (!id || !notes.trim()) return;
    setSubmitting(true);
    setDecisionError(null);

    managerService.submitDecision(id, { decision, notes })
      .then(() => {
        setActionDone(decision);
      })
      .catch((err: unknown) => {
        console.error(err);
        const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setDecisionError(detail || 'Failed to submit decision.');
      })
      .finally(() => setSubmitting(false));
  }

  if (loading) return <ManagerDetailLoading />;

  if (error || !detail) return <ManagerDetailError error={error || 'Application not found'} onBack={() => navigate(-1)} />;

  if (actionDone) {
    return (
      <ManagerDetailActionDone
        id={id}
        actionDone={actionDone}
        onQueue={() => navigate('/manager/queue')}
        onDashboard={() => navigate('/manager/dashboard')}
      />
    );
  }

  const {
    application: app,
    credit_score, fraud_flags, eligibility,
    underwriter_report, monthly_trend, risk_tier, decisions,
    escalation_reason, escalated_by_name, escalated_at,
  } = detail;

  const score      = credit_score?.score ?? null;
  const hasFraud   = fraud_flags.length > 0;
  const canDecide  = app.status === 'escalated';

  const scoreBarData = [
    { name: 'Income Stability', value: credit_score?.income_stability_score ?? 0 },
    { name: 'EMI Burden',       value: credit_score?.emi_burden_score ?? 0 },
    { name: 'Bounce Rate',      value: credit_score?.bounce_score ?? 0 },
    { name: 'Balance',          value: credit_score?.balance_score ?? 0 },
  ];

  const trendData = [...monthly_trend]
    .reverse()
    .map(p => ({ month: p.month?.slice(0, 7) ?? '', score: p.score }));

  const breakdownRaw = credit_score?.score_breakdown_json as Record<string, unknown> | null;
  const pieData = breakdownRaw
    ? Object.entries(breakdownRaw)
        .filter(([, v]) => typeof v === 'number' && v > 0)
        .map(([k, v]) => ({ name: k.replaceAll('_', ' '), value: Number(v) }))
    : [];

  const statusBadge: Record<string, string> = {
    pending: 'badge-warn', under_review: 'badge-warn',
    escalated: 'badge-warn', approved: 'badge-ok', rejected: 'badge-bad',
  };

  return (
    <DashboardShell
      title={`Review: ${app.loan_type.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}`}
      subtitle={`App ID: ${app.application_id.slice(0, 8)}… · Submitted ${new Date(app.submitted_at).toLocaleDateString('en-IN')}`}
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {hasFraud && (
            <span className="badge badge-bad" style={{ gap: 4 }}>⚠ Fraud Flagged</span>
          )}
          <span className={`badge ${statusBadge[app.status] ?? ''}`}>
            {app.status.replaceAll('_', ' ')}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/manager/queue')}>
            ← Queue
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="fade-up">
        {/* Escalation context card */}
        <div className="card" style={{ borderLeft: '4px solid var(--warn)', padding: '16px 20px' }}>
          <SectionHeader>Escalation Information</SectionHeader>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: 13 }}>
            <div>
              <span style={{ color: 'var(--t2)', display: 'block', marginBottom: 2 }}>Escalated By</span>
              <strong>{escalated_by_name || 'Credit Analyst'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--t2)', display: 'block', marginBottom: 2 }}>Escalated Date</span>
              <strong>{escalated_at ? new Date(escalated_at).toLocaleString('en-IN') : '—'}</strong>
            </div>
          </div>
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border-s)', paddingTop: 10 }}>
            <span style={{ color: 'var(--t2)', display: 'block', marginBottom: 4, fontSize: 12 }}>Analyst Reason / Notes:</span>
            <div style={{ background: 'var(--bg)', padding: '10px 12px', borderRadius: 'var(--r-sm)', fontStyle: 'italic', color: 'var(--ink-soft)' }}>
              "{escalation_reason || 'No notes provided'}"
            </div>
          </div>
        </div>

        {/* Fraud flags alerts list */}
        {hasFraud && (
          <div className="card" style={{ borderColor: 'var(--bad)' }}>
            <div style={{ fontWeight: 700, color: 'var(--bad)', marginBottom: 12, fontSize: 13 }}>
              ⚠ Active Fraud Flags
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fraud_flags.map((f) => (
                <div key={f.flag_type} style={{
                  padding: '10px 14px', background: 'var(--bad-b)',
                  border: '1px solid rgba(198,40,40,.2)', borderRadius: 'var(--r-md)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div>
                    <strong>{f.flag_type.replaceAll('_', ' ')}</strong>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>{f.flag_detail}</div>
                  </div>
                  <span className="badge badge-bad">{f.severity.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Grid Section */}
        <div className="grid-2">
          {/* Application details */}
          <div className="card">
            <SectionHeader>Application Details</SectionHeader>
            <MetricRow label="Loan Type"        value={app.loan_type.replaceAll('_', ' ')} />
            <MetricRow label="Amount Requested" value={`₹${Number(app.amount_requested).toLocaleString('en-IN')}`} />
            <MetricRow label="Purpose"          value={app.purpose} />
            <MetricRow label="Current Status"   value={app.status.replaceAll('_', ' ')} />
            <MetricRow label="Risk Tier"        value={risk_tier?.replaceAll('_', ' ') ?? '—'} />
            <MetricRow label="Submitted"        value={new Date(app.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
          </div>

          {/* Credit score */}
          <div className="card">
            <SectionHeader>Credit Assessment</SectionHeader>
            {credit_score ? (
              <>
                <ScoreGauge score={credit_score.score ?? 0} />
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

        {/* Charts Section */}
        {credit_score && (
          <div className="grid-2">
            {/* Score breakdown bar chart */}
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

            {/* Monthly credit trend line chart */}
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

        <div className="grid-2">
          {/* Underwriter report */}
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

          {/* Score breakdown pie chart */}
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

        {/* Eligibility (all 6 loan types) */}
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

        {/* Decision history */}
        {decisions.length > 0 && (
          <div className="card">
            <SectionHeader>Decision History</SectionHeader>
            {decisions.map(d => (
              <div key={d.decision_id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: '1px solid var(--border-s)',
              }}>
                <div>
                  <span className={`badge ${getDecisionHistoryBadgeClass(d.decision)}`}>
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

        {/* Manager Decision Panel (final authority) */}
        <div className="card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--sh-md)' }}>
          <SectionHeader>Bank Manager Action — Final Decision</SectionHeader>
          
          {!canDecide ? (
            <div className="alert alert-success">
              <span>✓</span>
              <span>This application is already resolved with status <strong>{app.status.toUpperCase()}</strong>.</span>
            </div>
          ) : (
            <>
              {decisionError && (
                <div className="alert alert-error" style={{ marginBottom: 16 }}>
                  <span>⚠</span><span>{decisionError}</span>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" htmlFor="manager-decision-notes">
                  Decision Notes <span style={{ color: 'var(--bad)' }}>* (mandatory)</span>
                </label>
                <textarea
                  id="manager-decision-notes"
                  className="form-input"
                  rows={4}
                  placeholder="Explain why you are approving or rejecting this application..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ resize: 'vertical', fontFamily: 'var(--font)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="btn btn-primary btn-lg"
                  style={{ background: '#2E7D32', borderColor: '#2E7D32', flex: 1 }}
                  disabled={submitting || !notes.trim()}
                  onClick={() => handleDecision('approved')}
                >
                  {submitting ? <span className="spinner" /> : '✓'} Approve Application
                </button>
                <button
                  className="btn btn-danger btn-lg"
                  style={{ flex: 1 }}
                  disabled={submitting || !notes.trim()}
                  onClick={() => handleDecision('rejected')}
                >
                  {submitting ? <span className="spinner" /> : '✗'} Reject Application
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
