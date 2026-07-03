// ─────────────────────────────────────────────────────────────────────────────
// LoanLens — /portal/score  (Credit Score + Components + Trend Chart)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';
import { DashboardShell } from '../../components/DashboardShell';
import { loanService } from '../../services/loanService';
import type { CreditScoreData, CreditTrend, ScoreComponent } from '../../services/loanService';

// ── Score gauge ───────────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? 'var(--ok)' : score >= 45 ? 'var(--warn)' : 'var(--bad)';
  const tier  = score >= 80 ? 'Excellent'
    : score >= 70 ? 'Good'
    : score >= 55 ? 'Fair'
    : score >= 40 ? 'Poor'
    : 'Very Poor';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0' }}>
      <div style={{ position: 'relative', width: 160, height: 160 }}>
        <svg width={160} height={160} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={80} cy={80} r={66} fill="none" stroke="var(--bg)" strokeWidth={12} />
          <circle
            cx={80} cy={80} r={66}
            fill="none"
            stroke={color}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 66 * (score / 100)} ${2 * Math.PI * 66}`}
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 44, fontWeight: 800, color, letterSpacing: '-.04em', lineHeight: 1 }}>{score}</div>
          <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 4 }}>{tier}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 16, textAlign: 'center', maxWidth: 180 }}>
        Score ranges from 0 (very high risk) to 100 (very low risk)
      </div>
    </div>
  );
}

// ── Component bar ─────────────────────────────────────────────────────────────
function ComponentBar({ c }: { c: ScoreComponent }) {
  const score = c.score ?? 0;
  const color = score >= 70 ? 'var(--ok)' : score >= 45 ? 'var(--warn)' : 'var(--bad)';
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div>
          <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--t1)' }}>{c.label}</span>
          <span style={{ fontSize: 11, color: 'var(--t3)', marginLeft: 8 }}>({c.weight_pct}% weight)</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{c.score != null ? `${c.score.toFixed(0)}/100` : '—'}</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 6 }}>{c.description}</div>
      <div style={{ height: 8, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 99, transition: 'width .8s ease' }} />
      </div>
    </div>
  );
}

// ── No data empty state ────────────────────────────────────────────────────────
function NoDataState() {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
      <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--t1)', marginBottom: 8 }}>No Credit Score Yet</div>
      <div style={{ fontSize: 13, color: 'var(--t3)', maxWidth: 360, margin: '0 auto', lineHeight: 1.65 }}>
        Your credit score is computed after you upload a bank statement and the dbt pipeline runs.
        Upload your bank statement from the <strong>Apply</strong> page to get started.
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PortalScore() {
  const [score, setScore]   = useState<CreditScoreData | null>(null);
  const [trend, setTrend]   = useState<CreditTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    Promise.allSettled([
      loanService.getMyCreditScore(),
      loanService.getMyCreditTrend(),
    ]).then(([scoreRes, trendRes]) => {
      if (scoreRes.status === 'fulfilled') setScore(scoreRes.value);
      else setError('Failed to load credit score.');
      if (trendRes.status === 'fulfilled') setTrend(trendRes.value);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <DashboardShell title="Credit Score" subtitle="Loading your financial health…">
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--t3)' }}>
          <span className="spinner" style={{ fontSize: 24 }} />
        </div>
      </DashboardShell>
    );
  }

  if (error) {
    return (
      <DashboardShell title="Credit Score">
        <div className="alert alert-error"><span>⚠</span><span>{error}</span></div>
      </DashboardShell>
    );
  }

  if (!score?.has_data) {
    return (
      <DashboardShell title="Credit Score" subtitle="Your financial health and scoring metrics">
        <NoDataState />
      </DashboardShell>
    );
  }

  const trendData = (trend?.trend ?? [])
    .filter(t => t.month && t.score != null)
    .reverse()
    .map(t => ({ month: t.month?.slice(0, 7) ?? '', score: t.score, dir: t.trend_direction }));

  return (
    <DashboardShell
      title="Credit Score"
      subtitle="Your financial health and scoring metrics"
      actions={
        score.computed_at ? (
          <span style={{ fontSize: 11, color: 'var(--t3)' }}>
            Computed {new Date(score.computed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        ) : undefined
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Row 1: Score ring + Components */}
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20 }}>

          {/* Score ring */}
          <div className="card">
            <ScoreRing score={score.score ?? 0} />
            {score.risk_tier && (
              <div style={{ textAlign: 'center', paddingBottom: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--t3)', marginBottom: 4 }}>Risk Tier</div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--t1)' }}>{score.risk_tier.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</div>
              </div>
            )}
            {score.recommendation && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 6, fontSize: 12, color: 'var(--t2)', lineHeight: 1.55, textAlign: 'center' }}>
                💡 {score.recommendation}
              </div>
            )}
          </div>

          {/* Components */}
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--t3)', marginBottom: 20 }}>Score Components</div>
            {score.components.map(c => <ComponentBar key={c.key} c={c} />)}
          </div>
        </div>

        {/* Row 2: 6-month trend */}
        {trendData.length > 0 ? (
          <div className="card" style={{ height: 280 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--t3)', marginBottom: 16 }}>
              6-Month Score Trend
            </div>
            <ResponsiveContainer width="100%" height="82%">
              <LineChart data={trendData} margin={{ top: 4, right: 16, bottom: 4, left: -24 }}>
                <CartesianGrid stroke="var(--border-s)" strokeDasharray="4 4" vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--t3)' }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--t3)' }}
                  domain={['dataMin - 5', 'dataMax + 5']}
                />
                <ReferenceLine y={70} stroke="var(--ok)"   strokeDasharray="3 3" strokeOpacity={0.4} />
                <ReferenceLine y={45} stroke="var(--warn)" strokeDasharray="3 3" strokeOpacity={0.4} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13 }}
                  itemStyle={{ color: 'var(--ink)', fontWeight: 600 }}
                  labelStyle={{ color: 'var(--t3)', fontSize: 11 }}
                  formatter={(v: number) => [v.toFixed(0), 'Score']}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--ink)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: 'var(--ink)', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: 'var(--ink)', strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 16, fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
              <span style={{ color: 'var(--ok)' }}>— Good (≥70)</span>
              <span style={{ color: 'var(--warn)' }}>— Fair (45–69)</span>
              <span style={{ color: 'var(--bad)' }}>— Poor (&lt;45)</span>
            </div>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--t3)', fontSize: 13 }}>
            No trend data yet — trend appears after 2+ months of data.
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
