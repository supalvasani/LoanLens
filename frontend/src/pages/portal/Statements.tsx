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

  function downloadSample() {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_bank_statement.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardShell
      title="Bank Statement Upload"
      subtitle="Upload your bank statement CSV to compute your credit score"
      actions={
        <button className="btn btn-ghost btn-sm" onClick={downloadSample}>⬇ Sample CSV</button>
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
            style={{
              border: `2px dashed ${dragOver ? 'var(--ink)' : file ? 'var(--ok)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: '36px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'rgba(28,25,23,.03)' : file ? 'rgba(34,197,94,.04)' : 'var(--bg)',
              transition: 'all 150ms',
            }}
            onClick={() => !file && fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {file ? (
              <>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📄</div>
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
                <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)' }}>Drop your CSV here</div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 6 }}>or click to browse · Max 5 MB</div>
              </>
            )}
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginTop: 14 }}>
              <span>⚠</span><span>{error}</span>
            </div>
          )}

          <button
            className="btn btn-primary"
            disabled={!file || uploading}
            onClick={handleUpload}
            style={{ marginTop: 14, width: '100%' }}
          >
            {uploading ? <><span className="spinner" /> Uploading & Processing…</> : '⬆ Upload Statement'}
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
                <span>✓</span>
                <span>
                  {result.rows_inserted} transactions imported successfully.
                  Your credit score will be updated the next time the pipeline runs.
                </span>
              </div>
            )}

            {result.errors.length > 0 && (
              <div className="alert alert-warn">
                <span>⚠</span>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{result.errors.length} row(s) had issues:</div>
                  {result.errors.slice(0, 5).map((e, i) => (
                    <div key={i} style={{ fontSize: 11, marginTop: 2 }}>· {e}</div>
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
          ].map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <span style={{ color: 'var(--ok)', fontSize: 12, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.5 }}>{tip}</span>
            </div>
          ))}
        </div>

      </div>
    </DashboardShell>
  );
}
