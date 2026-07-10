// ─────────────────────────────────────────────────────────────────────────────
// LoanLens — Admin: Ingestion Pipeline Management Page
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import { adminService } from '../../services/adminService';
import type { ReviewQueueItem, PipelineDashboardResponse } from '../../types/admin';

function buildResolvePayload(
  promote: boolean,
  promoteName: string,
  dateCol: string,
  amountCol1: string,
  amountCol2: string,
  typeCol: string,
  promotePattern: string,
  descCols: string,
  balCol: string
) {
  const payload: {
    resolved: boolean;
    promote: boolean;
    bank_name?: string;
    amount_pattern?: string;
    column_map?: Record<string, string | string[]>;
  } = { resolved: true, promote };

  if (promote) {
    if (!promoteName.trim()) throw new Error('Bank name is required');
    if (!dateCol.trim()) throw new Error('Date column is required');
    if (!amountCol1.trim()) throw new Error('Amount column is required');
    if (promotePattern === 'split' && !amountCol2.trim()) throw new Error('Credit amount column is required for split layout');
    if (promotePattern === 'flagged' && !typeCol.trim()) throw new Error('Transaction type column is required for flagged layout');

    const colMap: Record<string, string | string[]> = {
      txn_date_col: dateCol.trim(),
      amount_cols: promotePattern === 'split' ? [amountCol1.trim(), amountCol2.trim()] : [amountCol1.trim()],
      description_cols: descCols.split(',').map(s => s.trim()).filter(Boolean),
    };

    if (balCol.trim()) colMap.balance_col = balCol.trim();
    if (promotePattern === 'flagged') colMap.txn_type_col = typeCol.trim();

    payload.bank_name = promoteName.trim();
    payload.amount_pattern = promotePattern;
    payload.column_map = colMap;
  }
  return payload;
}

export default function AdminPipeline() {
  const [data, setData] = useState<PipelineDashboardResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolution/Promotion state
  const [selectedReview, setSelectedReview] = useState<ReviewQueueItem | null>(null);
  const [promoteName, setPromoteName] = useState('');
  const [promotePattern, setPromotePattern] = useState<'signed' | 'split' | 'flagged'>('signed');
  
  // Mapping fields state
  const [dateCol, setDateCol] = useState('');
  const [amountCol1, setAmountCol1] = useState('');
  const [amountCol2, setAmountCol2] = useState('');
  const [descCols, setDescCols] = useState('');
  const [balCol, setBalCol] = useState('');
  const [typeCol, setTypeCol] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  function loadDashboard() {
    setLoading(true);
    adminService.getPipelineDashboard()
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load ingestion pipeline metrics.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        loadDashboard();
      }
    });
    return () => { active = false; };
  }, []);

  // Pre-fill columns when a review queue item is selected
  useEffect(() => {
    if (!selectedReview) return;
    let active = true;
    Promise.resolve().then(() => {
      if (!active) return;
      setPromoteName(selectedReview.file_name?.replace('.csv', '') || '');
      setModalError(null);
      
      // Auto-detect mappings from headers to save admin time
      const headers = new Set(selectedReview.detected_headers.map(h => h.toLowerCase().trim()));
      
      const foundDate = selectedReview.detected_headers.find(h => 
        ['date', 'txn_date', 'value date', 'posting date'].includes(h.toLowerCase().trim())
      ) || '';
      setDateCol(foundDate);

      // Guess pattern based on debit/credit columns
      const hasDebit = headers.has('debit') || headers.has('withdrawal');
      const hasCredit = headers.has('credit') || headers.has('deposit');
      const hasType = headers.has('type') || headers.has('txn_type') || headers.has('cr/dr');

      if (hasDebit && hasCredit) {
        setPromotePattern('split');
        const dCol = selectedReview.detected_headers.find(h => ['debit', 'withdrawal'].includes(h.toLowerCase().trim())) || '';
        const cCol = selectedReview.detected_headers.find(h => ['credit', 'deposit'].includes(h.toLowerCase().trim())) || '';
        setAmountCol1(dCol);
        setAmountCol2(cCol);
      } else if (hasType) {
        setPromotePattern('flagged');
        const amtCol = selectedReview.detected_headers.find(h => ['amount', 'txn_amount', 'amt'].includes(h.toLowerCase().trim())) || '';
        const tCol = selectedReview.detected_headers.find(h => ['type', 'txn_type', 'cr/dr'].includes(h.toLowerCase().trim())) || '';
        setAmountCol1(amtCol);
        setTypeCol(tCol);
        setAmountCol2('');
      } else {
        setPromotePattern('signed');
        const amtCol = selectedReview.detected_headers.find(h => ['amount', 'txn_amount', 'balance'].includes(h.toLowerCase().trim())) || '';
        setAmountCol1(amtCol);
        setAmountCol2('');
        setTypeCol('');
      }

      const foundDesc = selectedReview.detected_headers.filter(h => 
        ['description', 'narration', 'particulars', 'remarks'].includes(h.toLowerCase().trim())
      ).join(', ') || '';
      setDescCols(foundDesc);

      const foundBal = selectedReview.detected_headers.find(h => 
        ['balance', 'closing balance', 'running balance'].includes(h.toLowerCase().trim())
      ) || '';
      setBalCol(foundBal);
    });
    return () => { active = false; };
  }, [selectedReview]);

  async function handleResolve(promote: boolean) {
    if (!selectedReview) return;
    setSubmitting(true);
    setModalError(null);

    try {
      const payload = buildResolvePayload(
        promote,
        promoteName,
        dateCol,
        amountCol1,
        amountCol2,
        typeCol,
        promotePattern,
        descCols,
        balCol
      );

      await adminService.resolvePipelineReview(selectedReview.review_id, payload);
      setSelectedReview(null);
      loadDashboard();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to resolve review item.';
      setModalError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  }

  const getCardBorderLeftStyle = () => {
    if (loading) return {};
    return (data?.pending_reviews ?? 0) > 0 ? { borderLeft: '4px solid var(--bad)' } : {};
  };

  const getKpiTitleColorStyle = () => {
    if (!loading && (data?.pending_reviews ?? 0) > 0) return { color: 'var(--bad)' };
    return {};
  };

  const renderQueueContent = () => {
    if (loading) {
      return <div style={{ padding: 24, textAlign: 'center', color: 'var(--t3)' }}>Loading review queue...</div>;
    }
    if (!data || data.pending_items.length === 0) {
      return <div style={{ padding: 32, textAlign: 'center', color: 'var(--t3)' }}>✓ Review queue is clear. No ingestion errors.</div>;
    }
    return data.pending_items.map((item) => (
      <div key={item.review_id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--t1)' }}>{item.file_name || 'Unnamed CSV'}</div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
            Failed at: {new Date(item.created_at).toLocaleString()}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <span className="badge badge-bad" style={{ textTransform: 'uppercase' }}>{item.reason}</span>
            <span style={{ fontSize: 11, color: 'var(--t2)', background: 'var(--bg)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: 4 }}>
              {item.detected_headers.length} Columns detected
            </span>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedReview(item)}>
          Map Layout
        </button>
      </div>
    ));
  };

  const renderRegistryContent = () => {
    if (loading) {
      return <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20 }}>Loading registry...</td></tr>;
    }
    if (!data || data.registry_entries.length === 0) {
      return <tr><td colSpan={4} style={{ textAlign: 'center', padding: 20, color: 'var(--t3)' }}>No configurations cached.</td></tr>;
    }
    return data.registry_entries.map((entry) => (
      <tr key={entry.format_id}>
        <td style={{ fontWeight: 600 }}>{entry.bank_name || 'Default Format'}</td>
        <td style={{ textTransform: 'uppercase', fontSize: 11 }}><span className="badge badge-info">{entry.amount_pattern}</span></td>
        <td>
          <span className={entry.confidence_source === 'manual' ? 'badge badge-success' : 'badge badge-warning'}>
            {entry.confidence_source}
          </span>
        </td>
        <td style={{ color: 'var(--t3)', fontSize: 12 }}>
          {new Date(entry.created_at).toLocaleDateString()}
        </td>
      </tr>
    ));
  };

  const renderAuditRunsContent = () => {
    if (loading) {
      return <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)' }}>Loading audit log...</div>;
    }
    if (!data || data.audit_runs.length === 0) {
      return <div style={{ padding: 20, textAlign: 'center', color: 'var(--t3)' }}>No DAG execution logs found in pipeline audit table.</div>;
    }
    return data.audit_runs.map((run) => (
      <div key={run.run_id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <code style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)' }}>{run.dag_name}</code>
          <span className={run.status === 'success' ? 'badge badge-ok' : 'badge badge-bad'}>{run.status}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--t2)' }}>
          <span>Rows: <strong style={{ color: 'var(--t1)' }}>{run.rows_processed}</strong></span>
          <span>Failures: <strong style={{ color: run.failures > 0 ? 'var(--bad)' : 'var(--t2)' }}>{run.failures}</strong></span>
          <span>Duration: {((new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()) / 1000).toFixed(1)}s</span>
        </div>
        <span style={{ fontSize: 10.5, color: 'var(--t3)' }}>
          Started: {new Date(run.started_at).toLocaleString()}
        </span>
      </div>
    ));
  };

  return (
    <DashboardShell
      title="Data Engineering Pipeline"
      subtitle="Universal Bank Statement Ingestion control center and pipeline analytics"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {error && (
          <div className="alert alert-error">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Pipeline metrics */}
        <div className="grid-3" style={{ gap: 16 }}>
          <div className="card">
            <div className="kpi">
              <div className="kpi-label">Statement Uploads</div>
              <div className="kpi-value">{loading ? '...' : data?.total_uploads}</div>
              <div className="kpi-sub">Total CSVs ingested</div>
            </div>
          </div>
          <div className="card">
            <div className="kpi">
              <div className="kpi-label">Registry Cache Size</div>
              <div className="kpi-value">{loading ? '...' : data?.total_registry}</div>
              <div className="kpi-sub">Active bank layout mappings</div>
            </div>
          </div>
          <div className="card" style={getCardBorderLeftStyle()}>
            <div className="kpi">
              <div className="kpi-label" style={getKpiTitleColorStyle()}>Unresolved Reviews</div>
              <div className="kpi-value" style={getKpiTitleColorStyle()}>{loading ? '...' : data?.pending_reviews}</div>
              <div className="kpi-sub">Failures awaiting layout mapping</div>
            </div>
          </div>
        </div>

        {/* Main Grid: left column review queue + formats, right column DAG audits */}
        <div className="grid-2" style={{ gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
          
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Format Review Queue */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>🚨 Ingestion Format Review Queue</span>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>CSV uploads that failed pipeline confidence gates or balance reconciliation</div>
                </div>
                <span className="badge badge-bad">{loading ? '...' : data?.pending_items.length} Queue Items</span>
              </div>
              <div style={{ padding: '8px 0' }}>
                {renderQueueContent()}
              </div>
            </div>

            {/* Format Registry */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>⚙ Active Formats Registry Cache</span>
                <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>Format mappings used by pipeline to bypass heuristic scoring</div>
              </div>
              <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Bank Name</th>
                      <th>Pattern</th>
                      <th>Source</th>
                      <th>Date Cached</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderRegistryContent()}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Right Column: DAG Audits */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>📊 Pipeline Audit Log (Airflow Runs)</span>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 4 }}>Recent Airflow DAG executions and row-level transformation metrics</div>
            </div>
            <div style={{ padding: '8px 0', maxHeight: '600px', overflowY: 'auto' }}>
              {renderAuditRunsContent()}
            </div>
          </div>

        </div>
      </div>

      {/* Map Layout Modal */}
      {selectedReview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 620, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)', padding: '24px 28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Ingestion Layout Mapper & Promotion</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedReview(null)}>✕</button>
            </div>

            {modalError && (
              <div className="alert alert-error" style={{ marginBottom: 14 }}>
                <span>⚠</span>
                <span>{modalError}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 12.5, color: 'var(--t3)', background: 'var(--bg)', padding: '10px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                <strong>Detected Headers in CSV:</strong>
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {selectedReview.detected_headers.map((h, i) => (
                    <code key={`${h}-${i}`} style={{ fontSize: 11, background: 'var(--bg-s)', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4 }}>
                      {h}
                    </code>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="promote-name" className="form-label">Bank / Config Name</label>
                <input
                  id="promote-name"
                  type="text"
                  className="input"
                  placeholder="e.g. HDFC Statement, Axis Bank, Custom CSV"
                  value={promoteName}
                  onChange={(e) => setPromoteName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="promote-pattern" className="form-label">Amount Layout Pattern</label>
                <select 
                  id="promote-pattern"
                  className="input" 
                  value={promotePattern} 
                  onChange={(e) => setPromotePattern(e.target.value as 'signed' | 'split' | 'flagged')}
                >
                  <option value="signed">Signed Amount (Single column; negative = debit, positive = credit)</option>
                  <option value="split">Split Columns (Separate debit & credit amount columns)</option>
                  <option value="flagged">Flagged Column (Single amount column + DR/CR type indicator column)</option>
                </select>
              </div>

              <div className="grid-2" style={{ gap: 14 }}>
                <div className="form-group">
                  <label htmlFor="date-col" className="form-label">Txn Date Column</label>
                  <select id="date-col" className="input" value={dateCol} onChange={(e) => setDateCol(e.target.value)}>
                    <option value="">-- Select Column --</option>
                    {selectedReview.detected_headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="amount-col-1" className="form-label">
                    {promotePattern === 'split' ? 'Debit Amount Column' : 'Amount Column'}
                  </label>
                  <select id="amount-col-1" className="input" value={amountCol1} onChange={(e) => setAmountCol1(e.target.value)}>
                    <option value="">-- Select Column --</option>
                    {selectedReview.detected_headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid-2" style={{ gap: 14 }}>
                {promotePattern === 'split' && (
                  <div className="form-group">
                    <label htmlFor="amount-col-2" className="form-label">Credit Amount Column</label>
                    <select id="amount-col-2" className="input" value={amountCol2} onChange={(e) => setAmountCol2(e.target.value)}>
                      <option value="">-- Select Column --</option>
                      {selectedReview.detected_headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                )}

                {promotePattern === 'flagged' && (
                  <div className="form-group">
                    <label htmlFor="type-col" className="form-label">Txn Type Column (DR/CR Flag)</label>
                    <select id="type-col" className="input" value={typeCol} onChange={(e) => setTypeCol(e.target.value)}>
                      <option value="">-- Select Column --</option>
                      {selectedReview.detected_headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="bal-col" className="form-label">Closing Balance Column (Optional)</label>
                  <select id="bal-col" className="input" value={balCol} onChange={(e) => setBalCol(e.target.value)}>
                    <option value="">-- Select Column --</option>
                    {selectedReview.detected_headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="desc-cols" className="form-label">Description / Narration Columns (comma-separated, in order of priority)</label>
                <input
                  id="desc-cols"
                  type="text"
                  className="input"
                  placeholder="e.g. Particulars, Narration, Description"
                  value={descCols}
                  onChange={(e) => setDescCols(e.target.value)}
                />
              </div>

            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1.5 }}
                disabled={submitting} 
                onClick={() => handleResolve(true)}
              >
                {submitting ? 'Promoting...' : 'Confirm Mapping & Promote to Registry'}
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1 }}
                disabled={submitting}
                onClick={() => handleResolve(false)}
              >
                Discard & Ignore Review
              </button>
              <button 
                className="btn btn-ghost" 
                style={{ flex: 0.8 }}
                disabled={submitting} 
                onClick={() => setSelectedReview(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
