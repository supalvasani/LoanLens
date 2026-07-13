// ─────────────────────────────────────────────────────────────────────────────
// LoanLens — Analyst Dashboard
// Rich filterable/sortable queue with mart-data enrichment
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { loanService, type AnalystQueueItem, type AnalystQueueParams } from '../../services/loanService';

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score === null) return 'var(--t3)';
  if (score > 65) return 'var(--ok)';
  if (score >= 45) return '#d97706';   // amber – grey zone
  return 'var(--bad)';
}

function scoreBg(score: number | null): string {
  if (score === null) return 'var(--border)';
  if (score > 65) return 'var(--ok-b)';
  if (score >= 45) return '#FFF8E1';
  return 'var(--bad-b)';
}

function riskLabel(tier: string | null): { label: string; cls: string } {
  switch ((tier ?? '').toLowerCase()) {
    case 'low':    return { label: 'Low Risk',    cls: 'badge-ok' };
    case 'medium': return { label: 'Medium Risk', cls: 'badge-warn' };
    case 'high':   return { label: 'High Risk',   cls: 'badge-bad' };
    default:       return { label: '—',           cls: '' };
  }
}

function recPill(rec: string | null): { label: string; color: string } {
  switch ((rec ?? '').toLowerCase()) {
    case 'approve': return { label: 'Approve',  color: 'var(--ok)' };
    case 'review':  return { label: 'Review',   color: '#d97706' };
    case 'reject':  return { label: 'Reject',   color: 'var(--bad)' };
    default:        return { label: 'Pending',  color: 'var(--t3)' };
  }
}

function SortIcon({
  field,
  sortBy,
  sortDir,
}: Readonly<{
  field: string;
  sortBy: string | undefined;
  sortDir: 'asc' | 'desc';
}>) {
  if (sortBy !== field) return <span style={{ color: 'var(--t3)', marginLeft: 4 }}>⇅</span>;
  return <span style={{ color: 'var(--ink)', marginLeft: 4 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
}

function renderQueueTableBody(
  loading: boolean,
  apps: AnalystQueueItem[],
  navigate: (path: string) => void
) {
  if (loading) {
    return (
      <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--t3)' }}>
        <span className="spinner" style={{ marginRight: 8 }} />Loading queue…
      </td></tr>
    );
  }
  if (apps.length === 0) {
    return (
      <tr><td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--t3)' }}>
        No applications match the current filters.
      </td></tr>
    );
  }
  return apps.map(app => {
    const rk = riskLabel(app.risk_tier);
    const rc = recPill(app.recommendation);
    return (
      <tr
        key={app.application_id}
        style={{ cursor: 'pointer' }}
        onClick={() => navigate(`/analyst/applications/${app.application_id}`)}
      >
        <td>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {app.has_fraud_flags && (
              <span title="Fraud flagged" style={{ color: 'var(--bad)', fontSize: 13 }}>⚠</span>
            )}
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>
                {app.applicant_name ?? `…${app.application_id.slice(-6)}`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'monospace' }}>
                {app.application_id.slice(0, 8)}…
              </div>
            </div>
          </div>
        </td>
        <td style={{ textTransform: 'capitalize' }}>
          {app.loan_type.replaceAll('_', ' ')}
        </td>
        <td style={{ fontVariantNumeric: 'tabular-nums' }}>
          ₹{Number(app.amount_requested).toLocaleString('en-IN')}
        </td>
        <td>
          {app.score !== null ? (
            <span style={{
              display: 'inline-block',
              minWidth: 44,
              textAlign: 'center',
              padding: '3px 10px',
              borderRadius: 4,
              fontWeight: 700,
              fontSize: 13,
              background: scoreBg(app.score),
              color: scoreColor(app.score),
            }}>
              {app.score.toFixed(0)}
            </span>
          ) : '—'}
        </td>
        <td>
          <span className={`badge ${rk.cls}`}>
            {rk.label}
          </span>
        </td>
        <td>
          <span className="badge" style={{ background: 'var(--bg)', color: rc.color, border: `1px solid ${rc.color}40` }}>
            {rc.label}
          </span>
        </td>
        <td style={{ fontSize: 12, color: 'var(--t3)' }}>
          {new Date(app.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </td>
        <td style={{ color: 'var(--t3)', textAlign: 'right' }}>→</td>
      </tr>
    );
  });
}

const LOAN_TYPES = [
  'home_loan', 'personal_loan', 'auto_loan',
  'education_loan', 'two_wheeler_loan', 'business_loan',
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function AnalystDashboard() {
  const navigate = useNavigate();

  const [apps, setApps]       = useState<AnalystQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Filter state
  const [scoreMin,    setScoreMin]    = useState<number>(0);
  const [scoreMax,    setScoreMax]    = useState<number>(100);
  const [riskSeg,     setRiskSeg]     = useState<string[]>([]);
  const [loanType,    setLoanType]    = useState<string>('');
  const [recFilter,   setRecFilter]   = useState<string>('');
  const [sortBy,      setSortBy]      = useState<AnalystQueueParams['sort_by']>('submitted_at');
  const [sortDir,     setSortDir]     = useState<'asc' | 'desc'>('desc');

  // Track filter state fingerprint to adjust loading state during render
  const filterKey = `${scoreMin}-${scoreMax}-${riskSeg.join(',')}-${loanType}-${recFilter}-${sortBy}-${sortDir}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setLoading(true);
    setError(null);
  }

  const fetchQueueInit = useCallback(() => {
    const params: AnalystQueueParams = {
      sort_by:  sortBy,
      sort_dir: sortDir,
      limit:    200,
    };
    if (scoreMin > 0)       params.score_min    = scoreMin;
    if (scoreMax < 100)     params.score_max    = scoreMax;
    if (riskSeg.length === 1) params.risk_segment = riskSeg[0];
    if (loanType)           params.loan_type    = loanType;
    if (recFilter)          params.recommendation = recFilter;

    loanService.listAnalystQueue(params)
      .then(setApps)
      .catch(() => setError('Failed to load application queue.'))
      .finally(() => setLoading(false));
  }, [scoreMin, scoreMax, riskSeg, loanType, recFilter, sortBy, sortDir]);

  const fetchQueueWithLoading = useCallback(async () => {
    setLoading(true);
    setError(null);
    await fetchQueueInit();
  }, [fetchQueueInit]);

  useEffect(() => { fetchQueueInit(); }, [fetchQueueInit]);

  // KPI counts
  const total     = apps.length;
  const fraudCount = apps.filter(a => a.has_fraud_flags).length;
  const greyZone  = apps.filter(a => a.score !== null && a.score >= 45 && a.score <= 65).length;

  function toggleRisk(seg: string) {
    setRiskSeg(prev =>
      prev.includes(seg) ? prev.filter(r => r !== seg) : [...prev, seg]
    );
  }

  function toggleSort(field: AnalystQueueParams['sort_by']) {
    if (sortBy === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  }

  return (
    <DashboardShell
      title="Analyst Dashboard"
      subtitle="Credit review workload — all non-escalated applications"
      actions={
        <button className="btn btn-secondary btn-sm" onClick={fetchQueueWithLoading}>
          ↻ Refresh
        </button>
      }
    >
      {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="card" style={{ padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{loading ? '…' : total}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Total in Queue</div>
        </div>
        <div className="card" style={{ padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--bad)', lineHeight: 1 }}>{loading ? '…' : fraudCount}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Fraud Flagged</div>
        </div>
        <div className="card" style={{ padding: '16px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#d97706', lineHeight: 1 }}>{loading ? '…' : greyZone}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.06em' }}>Grey Zone (45–65)</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* ── Filter Panel ──────────────────────────────────────────────────── */}
        <div className="card" style={{ minWidth: 220, flexShrink: 0, padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 16 }}>
            Filters
          </div>

          {/* Score range */}
          <div className="form-group">
            <label className="form-label" htmlFor="score-min-input">Score Range</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="number" min={0} max={100} step={1}
                className="form-input"
                style={{ width: 70 }}
                value={scoreMin}
                onChange={e => setScoreMin(Number(e.target.value))}
                placeholder="0"
                id="score-min-input"
              />
              <span style={{ color: 'var(--t3)', fontSize: 12 }}>–</span>
              <input
                type="number" min={0} max={100} step={1}
                className="form-input"
                style={{ width: 70 }}
                value={scoreMax}
                onChange={e => setScoreMax(Number(e.target.value))}
                placeholder="100"
                id="score-max-input"
              />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {[
                { label: 'Approve (>65)',   min: 66, max: 100 },
                { label: 'Grey (45–65)',    min: 45, max: 65  },
                { label: 'Reject (<45)',    min: 0,  max: 44  },
              ].map(q => (
                <button
                  key={q.label}
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 10, padding: '2px 6px', flexShrink: 0 }}
                  onClick={() => { setScoreMin(q.min); setScoreMax(q.max); }}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Risk segment */}
          <div className="form-group">
            <span className="form-label" style={{ display: 'block', marginBottom: 6 }}>Risk Segment</span>
            {['low', 'medium', 'high'].map(seg => (
              <label key={seg} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={riskSeg.includes(seg)}
                  onChange={() => toggleRisk(seg)}
                  id={`risk-${seg}`}
                />
                <span style={{ textTransform: 'capitalize' }}>{seg}</span>
              </label>
            ))}
          </div>

          {/* Loan type */}
          <div className="form-group">
            <label className="form-label" htmlFor="loan-type-filter">Loan Type</label>
            <select
              className="form-input"
              value={loanType}
              onChange={e => setLoanType(e.target.value)}
              id="loan-type-filter"
            >
              <option value="">All types</option>
              {LOAN_TYPES.map(t => (
                <option key={t} value={t}>{t.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
          </div>

          {/* Recommendation */}
          <div className="form-group">
            <label className="form-label" htmlFor="recommendation-filter">Recommendation</label>
            <select
              className="form-input"
              value={recFilter}
              onChange={e => setRecFilter(e.target.value)}
              id="recommendation-filter"
            >
              <option value="">All</option>
              <option value="approve">Approve</option>
              <option value="review">Review</option>
              <option value="reject">Reject</option>
            </select>
          </div>

          <button
            className="btn btn-secondary btn-full"
            style={{ marginTop: 4 }}
            onClick={() => {
              setScoreMin(0); setScoreMax(100);
              setRiskSeg([]); setLoanType(''); setRecFilter('');
            }}
          >
            Clear filters
          </button>
        </div>

        {/* ── Application Table ─────────────────────────────────────────────── */}
        <div className="card" style={{ flex: 1, padding: 0, overflow: 'hidden', minWidth: 0 }}>
          {error && (
            <div className="alert alert-error" style={{ margin: 16 }}>
              <span>⚠</span><span>{error}</span>
            </div>
          )}

          <table className="tbl">
            <thead>
              <tr>
                <th>Applicant</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('submitted_at')}>
                  Loan Type <SortIcon field="submitted_at" sortBy={sortBy} sortDir={sortDir} />
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('amount_requested')}>
                  Amount <SortIcon field="amount_requested" sortBy={sortBy} sortDir={sortDir} />
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('score')}>
                  Score <SortIcon field="score" sortBy={sortBy} sortDir={sortDir} />
                </th>
                <th>Risk</th>
                <th>Recommendation</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {renderQueueTableBody(loading, apps, navigate)}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
