// ─────────────────────────────────────────────────────────────────────────────
// LoanLens — Analyst: Full Credit Report + Decision Panel
// Uses Recharts: BarChart (score components), LineChart (monthly trend),
//               PieChart (score breakdown categories)
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, PieChart, Pie, Legend,
} from 'recharts';
import { DashboardShell } from '../../components/DashboardShell';
import { useApplication } from '../../hooks/useApplication';
import { useLoanAction } from '../../hooks/useLoanAction';
import type { DecisionType } from '../../types/loan';

// ── Colour helpers ────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score === null) return 'var(--t3)';
  if (score > 65)  return '#2E7D32';
  if (score >= 45) return '#d97706';
  return '#C62828';
}

function getActionMode(decision: DecisionType): 'approved' | 'rejected' | 'escalated' {
  if (decision === 'approved') return 'approved';
  if (decision === 'rejected') return 'rejected';
  return 'escalated';
}

function getRiskSegmentColor(segment: string | null | undefined): string {
  if (segment === 'high') return 'var(--bad)';
  if (segment === 'medium') return '#d97706';
  return 'var(--ok)';
}

function getDecisionBadgeClass(decision: string): string {
  if (decision === 'approved') return 'badge-ok';
  if (decision === 'rejected') return 'badge-bad';
  return 'badge-warn';
}

const PIE_COLORS = ['#4F81C7', '#2E7D32', '#d97706', '#C62828', '#7C3AED', '#0891b2'];

// ── Sub-components ────────────────────────────────────────────────────────────

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

interface MetricRowProps {
  readonly label: string;
  readonly value: string | number;
  readonly note?: string;
  readonly alert?: boolean;
}

function MetricRow({ label, value, note, alert }: Readonly<MetricRowProps>) {
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

function getScoreGaugeLabel(score: number): string {
  if (score > 65) return 'Approvable';
  if (score >= 45) return 'Grey Zone — Escalate';
  return 'Rejectable';
}

function ScoreGauge({ score }: Readonly<{ score: number }>) {
  const color = scoreColor(score);
  const label = getScoreGaugeLabel(score);
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

function getScoreBarColor(value: number): string {
  if (value >= 70) return '#2E7D32';
  if (value >= 45) return '#d97706';
  return '#C62828';
}

function getApproveButtonTitle(canApprove: boolean, hasFraud: boolean, score: number | null): string {
  if (canApprove) return 'Approve this application';
  if (hasFraud) return 'Cannot approve: fraud flags present';
  return `Score ${score?.toFixed(1)} ≤ 65 — must escalate`;
}

function getRejectButtonTitle(canReject: boolean, hasFraud: boolean, score: number | null): string {
  if (canReject) return 'Reject this application';
  if (hasFraud) return 'Cannot reject: fraud flags present';
  return `Score ${score?.toFixed(1)} ≥ 45 — must escalate`;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, loading, error } = useApplication(id, 'analyst');
  const { submitting, error: decisionError, clearError: clearDecisionError, submitAnalyst } = useLoanAction();
  const [notes, setNotes]           = useState('');
  const [actionDone, setActionDone] = useState<string | null>(null);

  async function handleDecision(decision: DecisionType) {
    if (!id) return;
    clearDecisionError();
    const ok = await submitAnalyst(id, getActionMode(decision), notes || undefined);
    if (ok) setActionDone(decision);
  }

  // ── Loading / Error states ────────────────────────────────────────────────

  if (loading) return (
    <DashboardShell title="Loading…" subtitle="Fetching credit report">
      <div style={{ textAlign: 'center', padding: 80, color: 'var(--t3)' }}>
        <span className="spinner" style={{ fontSize: 20, marginRight: 8 }} />{' '}
        Loading application…
      </div>
    </DashboardShell>
  );

  if (error) return (
    <DashboardShell title="Error">
      <div className="alert alert-error"><span>⚠</span><span>{error}</span></div>
      <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => navigate(-1)}>
        ← Back
      </button>
    </DashboardShell>
  );

  if (actionDone) return (
    <DashboardShell title="Decision Recorded">
      <div className="alert alert-success" style={{ marginBottom: 20 }}>
        <span>✓</span>
        <span>
          Application <strong>{id?.slice(0, 8)}…</strong> has been{' '}
          <strong>{actionDone === 'escalated' ? 'escalated to Bank Manager' : actionDone}</strong>.
        </span>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-secondary" onClick={() => navigate('/analyst/queue')}>
          ← Back to Queue
        </button>
        <button className="btn btn-ghost" onClick={() => navigate('/analyst/dashboard')}>
          Dashboard
        </button>
      </div>
    </DashboardShell>
  );

  const {
    application: app,
    credit_score, fraud_flags, eligibility,
    underwriter_report, monthly_trend, risk_tier, decisions,
  } = data!;

  const score      = credit_score?.score ?? null;
  const hasFraud   = fraud_flags.length > 0;
  const canDecide  = ['pending', 'under_review'].includes(app.status);

  // Decision button rules (server enforces them too; client disables for UX)
  const canApprove = canDecide && !hasFraud && score !== null && score > 65;
  const canReject  = canDecide && !hasFraud && score !== null && score < 45;

  // Score component bar chart data
  const scoreBarData = [
    { name: 'Income Stability', value: credit_score?.income_stability_score ?? 0 },
    { name: 'EMI Burden',       value: credit_score?.emi_burden_score ?? 0 },
    { name: 'Bounce Rate',      value: credit_score?.bounce_score ?? 0 },
    { name: 'Balance',          value: credit_score?.balance_score ?? 0 },
  ];

  // Monthly trend line chart data (chronological order)
  const trendData = [...monthly_trend]
    .reverse()
    .map(p => ({ month: p.month?.slice(0, 7) ?? '', score: p.score }));

  // Score breakdown pie (if available in JSON)
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
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/analyst/queue')}>
            ← Queue
          </button>
        </div>
      }
    >

      {/* ── Fraud Alert (shown prominently if flagged) ─────────────────────── */}
      {hasFraud && (
        <div style={{
          marginBottom: 20, padding: '14px 18px',
          background: 'var(--bad-b)', border: '1px solid rgba(198,40,40,.25)',
          borderRadius: 'var(--r-md)',
        }}>
          <div style={{ fontWeight: 700, color: 'var(--bad)', marginBottom: 8, fontSize: 13 }}>
            ⚠ Fraud Signals Detected — Escalation Required
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {fraud_flags.map((f) => (
              <div key={f.flag_type} style={{
                padding: '6px 12px', background: '#fff',
                border: '1px solid rgba(198,40,40,.2)', borderRadius: 'var(--r-sm)',
                fontSize: 12,
              }}>
                <span style={{ fontWeight: 600, color: 'var(--bad)' }}>
                  {f.flag_type.replaceAll('_', ' ')}
                </span>
                <span className="badge badge-bad" style={{ marginLeft: 8 }}>{f.severity}</span>
                {f.flag_detail && (
                  <div style={{ color: 'var(--t2)', marginTop: 2 }}>{f.flag_detail}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Row 1: Application Details + Credit Score ──────────────────────── */}
      <div className="grid-2" style={{ marginBottom: 20 }}>

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
              No credit score yet. Run the dbt pipeline.
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Score Component BarChart + Monthly Trend LineChart ──────── */}
      {credit_score && (
        <div className="grid-2" style={{ marginBottom: 20 }}>

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
                      fill={getScoreBarColor(entry.value)}
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
                No trend data — run the dbt pipeline.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Row 3: Underwriter Report + Spending PieChart ─────────────────── */}
      <div className="grid-2" style={{ marginBottom: 20 }}>

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

      {/* ── Row 4: Eligibility (all 6 loan types) ─────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
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
            No eligibility data. Run the dbt pipeline.
          </div>
        )}
      </div>

      {/* ── Row 5: Previous Decisions ─────────────────────────────────────── */}
      {decisions.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
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
                {d.notes && <span style={{ fontSize: 12, color: 'var(--t2)', marginLeft: 10 }}>{d.notes.slice(0, 80)}</span>}
              </div>
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>
                {new Date(d.decided_at).toLocaleDateString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Decision Panel ────────────────────────────────────────────────── */}
      <div className="card" style={{ border: '1px solid var(--border)', boxShadow: 'var(--sh-md)' }}>
        <SectionHeader>Make a Decision</SectionHeader>

        {!canDecide ? (
          <div className="alert alert-warn">
            <span>ℹ</span>
            <span>This application is <strong>{app.status}</strong> — no further analyst action required.</span>
          </div>
        ) : (
          <>
            {/* Escalation rules summary */}
            <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--bg)', borderRadius: 'var(--r-sm)', fontSize: 12, color: 'var(--t2)' }}>
              <strong>Rules:</strong>{' '}
              Approve requires score &gt;65 and no fraud flags.{' '}
              Reject requires score &lt;45 and no fraud flags.{' '}
              Grey zone (45–65), fraud, or above-threshold amounts must be escalated.
            </div>

            {decisionError && (
              <div className="alert alert-error" style={{ marginBottom: 12 }}>
                <span>⚠</span><span>{decisionError}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="decision-notes">
                Notes / Reason <span style={{ color: 'var(--t3)' }}>(required for escalation, min 10 chars)</span>
              </label>
              <textarea
                id="decision-notes"
                className="form-input"
                rows={3}
                placeholder="Describe your reasoning — mandatory for escalation…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                style={{ resize: 'vertical', fontFamily: 'var(--font)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              {/* Approve */}
              <button
                id="btn-approve"
                className="btn btn-primary"
                disabled={submitting || !canApprove}
                title={getApproveButtonTitle(canApprove, hasFraud, score)}
                onClick={() => handleDecision('approved')}
                style={{ background: canApprove ? '#2E7D32' : undefined, borderColor: canApprove ? '#2E7D32' : undefined }}
              >
                {submitting ? <span className="spinner" /> : '✓'} Approve
              </button>

              {/* Reject */}
              <button
                id="btn-reject"
                className="btn btn-danger"
                disabled={submitting || !canReject}
                title={getRejectButtonTitle(canReject, hasFraud, score)}
                onClick={() => handleDecision('rejected')}
              >
                {submitting ? <span className="spinner" /> : '✗'} Reject
              </button>

              {/* Escalate */}
              <button
                id="btn-escalate"
                className="btn btn-secondary"
                disabled={submitting}
                onClick={() => handleDecision('escalated')}
                style={{ marginLeft: 'auto' }}
                title="Escalate to Bank Manager (notes required)"
              >
                {submitting ? <span className="spinner" /> : '↑'} Escalate to Manager
              </button>
            </div>

            {/* Show why approve/reject are disabled */}
            {(!canApprove || !canReject) && canDecide && (
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--t2)' }}>
                {hasFraud && <div>⚠ Fraud flags detected — only escalation is allowed.</div>}
                {!hasFraud && score !== null && score >= 45 && score <= 65 && (
                  <div>⚠ Score {score.toFixed(1)} is in the grey zone (45–65) — escalation required.</div>
                )}
                {!hasFraud && score !== null && score > 65 && (
                  <div>✓ Score qualifies for approval. Rejection not available at this score.</div>
                )}
                {!hasFraud && score !== null && score < 45 && (
                  <div>✓ Score qualifies for rejection. Approval not available at this score.</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
