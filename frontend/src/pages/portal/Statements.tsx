// ─────────────────────────────────────────────────────────────────────────────
// LoanLens — /portal/statements  (Standalone Bank Statement Upload)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import { loanService } from '../../services/loanService';
import type { UploadResult } from '../../services/loanService';

const SAMPLE_CSV = `txn_date,amount,txn_type,description,balance_after
2026-01-05,45000,credit,Salary - January,45000
2026-01-10,12000,debit,EMI Payment - Home Loan,33000
2026-01-15,2500,debit,Electricity Bill,30500
2026-01-22,800,debit,Mobile Recharge,29700
2026-01-28,500,debit,Grocery Store,29200`;

function downloadSample() {
  const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sample_bank_statement.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function getStatementDropzoneBorder(dragOver: boolean, file: File | null): string {
  if (dragOver) return 'var(--ink)';
  if (file) return 'var(--ok)';
  return 'var(--border)';
}

function getStatementDropzoneBg(dragOver: boolean, file: File | null): string {
  if (dragOver) return 'rgba(28,25,23,.03)';
  if (file) return 'rgba(34,197,94,.04)';
  return 'var(--bg)';
}

export default function PortalStatements() {
  const fileRef     = useRef<HTMLInputElement>(null);
  const [file, setFile]               = useState<File | null>(null);
  const [dragOver, setDragOver]       = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [result, setResult]           = useState<UploadResult | null>(null);
  const [error, setError]             = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setResult(null);
    setError(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      if (!f.name.toLowerCase().endsWith('.csv')) {
        setError('Only .csv files are accepted.');
        return;
      }
      setFile(f);
      setResult(null);
      setError(null);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await loanService.uploadBankStatement(file);
      setResult(res);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr?.response?.data?.detail ?? 'Upload failed. Please check your file format and try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <DashboardShell
      title="Bank Statement Upload"
      subtitle="Upload your bank statement CSV to compute your credit score"
      actions={
        <button className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={downloadSample}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Sample CSV
        </button>
      }
    >
      <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Format guide */}
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--t3)', marginBottom: 12 }}>
            Required CSV Format
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {[
              { col: 'txn_date',     type: 'Date',    note: 'YYYY-MM-DD' },
              { col: 'amount',       type: 'Number',  note: 'Positive value' },
              { col: 'txn_type',     type: 'Enum',    note: 'credit or debit' },
              { col: 'description',  type: 'Text',    note: 'Max 255 chars' },
              { col: 'balance_after',type: 'Number',  note: 'After txn' },
            ].map(({ col, type, note }) => (
              <div key={col} style={{ background: 'var(--bg)', borderRadius: 6, padding: '10px 10px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{col}</div>
                <div style={{ fontSize: 10, color: 'var(--t2)' }}>{type}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{note}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Upload zone */}
        <div className="card">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          <div
            tabIndex={0}
            style={{
              border: `2px dashed ${getStatementDropzoneBorder(dragOver, file)}`,
              borderRadius: 10,
              padding: '36px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: getStatementDropzoneBg(dragOver, file),
              transition: 'all 150ms',
            }}
            onClick={() => !file && fileRef.current?.click()}
            onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !file) fileRef.current?.click(); }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <>
                <div style={{ color: 'var(--ok)', marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ok)' }}>{file.name}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>
                  {(file.size / 1024).toFixed(1)} KB
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 12 }}
                  onClick={e => { e.stopPropagation(); setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                >
                  ✕ Remove
                </button>
              </>
            ) : (
              <>
                <div style={{ color: 'var(--t2)', marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)' }}>Drop your CSV here</div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>or click to browse · Max 5 MB</div>
              </>
            )}
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginTop: 14 }}>
              <span style={{ display: 'flex', alignItems: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              </span>
              <span>{error}</span>
            </div>
          )}

          <button
            className="btn btn-primary"
            disabled={!file || uploading}
            onClick={handleUpload}
            style={{ marginTop: 14, width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {uploading ? <><span className="spinner" /> Uploading & Processing…</> : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                Upload Statement
              </>
            )}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="card">
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--t3)', marginBottom: 14 }}>
              Upload Summary
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div style={{ background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--ok)' }}>{result.rows_inserted}</div>
                <div style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 600, marginTop: 4 }}>Transactions Imported</div>
              </div>
              <div style={{ background: result.rows_skipped > 0 ? 'rgba(245,158,11,.08)' : 'var(--bg)', border: `1px solid ${result.rows_skipped > 0 ? 'rgba(245,158,11,.2)' : 'var(--border)'}`, borderRadius: 8, padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: result.rows_skipped > 0 ? 'var(--warn)' : 'var(--t3)' }}>{result.rows_skipped}</div>
                <div style={{ fontSize: 11, color: result.rows_skipped > 0 ? 'var(--warn)' : 'var(--t3)', fontWeight: 600, marginTop: 4 }}>Rows Skipped</div>
              </div>
            </div>

            {result.rows_inserted > 0 && (
              <div className="alert alert-success" style={{ marginBottom: result.errors.length > 0 ? 10 : 0 }}>
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </span>
                <span>
                  {result.rows_inserted} transactions imported successfully.
                  Your credit score will be updated the next time the pipeline runs.
                </span>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="alert alert-warn">
                <span style={{ display: 'flex', alignItems: 'center', marginTop: 2 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                </span>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{result.errors.length} row(s) had issues:</div>
                  {result.errors.slice(0, 5).map((e) => (
                    <div key={e} style={{ fontSize: 11, marginTop: 2 }}>· {e}</div>
                  ))}
                  {result.errors.length > 5 && (
                    <div style={{ fontSize: 11, marginTop: 4, color: 'var(--t3)' }}>
                      …and {result.errors.length - 5} more. Fix and re-upload the affected rows.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tips */}
        <div className="card" style={{ padding: '14px 20px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--t3)', marginBottom: 10 }}>Tips</div>
          {[
            'Export from your bank\'s internet banking portal as CSV.',
            'Dates must be in YYYY-MM-DD format (e.g. 2026-01-15).',
            'txn_type must be exactly "credit" or "debit" (lowercase).',
            'Upload at least 3 months of data for accurate scoring.',
            'Duplicate rows are safely skipped — re-uploads are safe.',
          ].map((tip) => (
            <div key={tip} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <span style={{ color: 'var(--ok)', display: 'flex', alignItems: 'center', marginTop: 2, flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
              <span style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>{tip}</span>
            </div>
          ))}
        </div>

      </div>
    </DashboardShell>
  );
}
