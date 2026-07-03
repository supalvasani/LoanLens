// ─────────────────────────────────────────────────────────────────────────────
// LoanLens — /portal/apply  (Loan Application + Bank Statement Upload)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { loanService } from '../../services/loanService';
import type { LoanType } from '../../types/loan';
import type { UploadResult } from '../../services/loanService';

const LOAN_TYPES: { value: LoanType; label: string; min: number; max: string }[] = [
  { value: 'personal_loan',   label: 'Personal Loan',    min: 50000,   max: '₹15,00,000' },
  { value: 'home_loan',       label: 'Home Loan',         min: 500000,  max: '₹1,00,00,000' },
  { value: 'business_loan',   label: 'Business Loan',     min: 100000,  max: '₹50,00,000' },
  { value: 'vehicle_loan',    label: 'Vehicle / Auto Loan', min: 50000, max: '₹20,00,000' },
  { value: 'education_loan',  label: 'Education Loan',    min: 100000,  max: '₹25,00,000' },
  { value: 'gold_loan',       label: 'Gold Loan',          min: 10000,  max: '₹5,00,000' },
];

type Step = 'form' | 'success';

interface FormErrors {
  loan_type?: string;
  amount?: string;
  purpose?: string;
  file?: string;
}

export default function PortalApply() {
  const navigate = useNavigate();
  const fileRef  = useRef<HTMLInputElement>(null);

  const [step, setStep]           = useState<Step>('form');
  const [loanType, setLoanType]   = useState<LoanType>('personal_loan');
  const [amount, setAmount]       = useState('');
  const [purpose, setPurpose]     = useState('');
  const [file, setFile]           = useState<File | null>(null);
  const [errors, setErrors]       = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError]   = useState<string | null>(null);
  const [appId, setAppId]         = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const selected = LOAN_TYPES.find(t => t.value === loanType)!;

  function validate(): boolean {
    const errs: FormErrors = {};
    const amt = parseFloat(amount);
    if (!amount || isNaN(amt) || amt < selected.min) {
      errs.amount = `Minimum amount for ${selected.label} is ₹${selected.min.toLocaleString('en-IN')}`;
    }
    if (!purpose.trim() || purpose.trim().length < 10) {
      errs.purpose = 'Purpose must be at least 10 characters.';
    }
    if (file && !file.name.toLowerCase().endsWith('.csv')) {
      errs.file = 'Only .csv files are accepted for bank statements.';
    }
    if (file && file.size > 5 * 1024 * 1024) {
      errs.file = 'File size must be under 5 MB.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setApiError(null);

    try {
      // 1. Submit loan application
      const app = await loanService.apply({
        loan_type: loanType,
        amount_requested: parseFloat(amount),
        purpose: purpose.trim(),
      });
      setAppId(app.application_id);

      // 2. Upload bank statement if provided (non-blocking — don't fail apply if upload fails)
      let uploadRes: UploadResult | null = null;
      if (file) {
        try {
          uploadRes = await loanService.uploadBankStatement(file);
        } catch {
          // Upload failure is shown but doesn't block the application
          uploadRes = { rows_inserted: 0, rows_skipped: 0, errors: ['Upload failed — you can re-upload from the Bank Statement page.'], applicant_id: null };
        }
      }
      setUploadResult(uploadRes);
      setStep('success');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setApiError(axiosErr?.response?.data?.detail ?? 'Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && errors.file) setErrors(p => ({ ...p, file: undefined }));
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <DashboardShell title="Application Submitted" subtitle="Your loan application is now pending review">
        <div style={{ maxWidth: 560 }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(34,197,94,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>✓</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ok)' }}>Application Submitted!</div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>
                  ID: <code style={{ fontFamily: 'monospace', fontSize: 11, background: 'var(--bg)', padding: '1px 5px', borderRadius: 3 }}>{appId}</code>
                </div>
              </div>
            </div>

            {uploadResult && (
              <div className={`alert ${uploadResult.rows_inserted > 0 ? 'alert-success' : 'alert-warn'}`} style={{ marginBottom: 16 }}>
                <span>{uploadResult.rows_inserted > 0 ? '✓' : '⚠'}</span>
                <div>
                  {uploadResult.rows_inserted > 0
                    ? `Bank statement uploaded: ${uploadResult.rows_inserted} transactions imported.`
                    : 'Bank statement upload had issues — please re-upload from the statement page.'}
                  {uploadResult.errors.length > 0 && (
                    <div style={{ marginTop: 4, fontSize: 11, opacity: 0.85 }}>
                      {uploadResult.errors.slice(0, 3).join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '14px 16px', marginBottom: 20, fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>
              ⏳ Your application is <strong>pending review</strong>. Our credit analysts will review it within 1–2 business days.
              You can track its status on your dashboard.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={() => navigate('/portal/dashboard')}>Go to Dashboard</button>
              <button className="btn btn-secondary" onClick={() => { setStep('form'); setFile(null); setAmount(''); setPurpose(''); setErrors({}); setAppId(null); setUploadResult(null); }}>
                Submit Another
              </button>
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <DashboardShell
      title="Apply for a Loan"
      subtitle="Fill in the details below to submit your application"
    >
      <div style={{ maxWidth: 600 }}>
        {apiError && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            <span>⚠</span><span>{apiError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>

          {/* Loan Type */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--t3)', marginBottom: 14 }}>
              Loan Details
            </div>

            <div className="form-group">
              <label className="form-label">Loan Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {LOAN_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => { setLoanType(t.value); setErrors(p => ({ ...p, loan_type: undefined })); }}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 6,
                      border: `1.5px solid ${loanType === t.value ? 'var(--ink)' : 'var(--border)'}`,
                      background: loanType === t.value ? 'var(--ink)' : 'var(--surface)',
                      color: loanType === t.value ? '#fff' : 'var(--t2)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 150ms',
                      textAlign: 'center',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8 }}>
                Range for {selected.label}: ₹{selected.min.toLocaleString('en-IN')} – {selected.max}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Amount Requested (₹)</label>
              <input
                type="number"
                className="form-input"
                placeholder={`e.g. ${(selected.min * 10).toLocaleString('en-IN')}`}
                value={amount}
                min={selected.min}
                onChange={e => { setAmount(e.target.value); setErrors(p => ({ ...p, amount: undefined })); }}
                disabled={submitting}
                style={{ borderColor: errors.amount ? 'var(--bad)' : undefined }}
              />
              {errors.amount && <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 3 }}>{errors.amount}</div>}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Purpose</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Describe what you will use this loan for (minimum 10 characters)…"
                value={purpose}
                onChange={e => { setPurpose(e.target.value); setErrors(p => ({ ...p, purpose: undefined })); }}
                disabled={submitting}
                style={{ resize: 'vertical', fontFamily: 'inherit', borderColor: errors.purpose ? 'var(--bad)' : undefined }}
              />
              {errors.purpose && <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 3 }}>{errors.purpose}</div>}
            </div>
          </div>

          {/* Bank Statement Upload */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--t3)', marginBottom: 4 }}>
              Bank Statement (Optional but Recommended)
            </div>
            <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 14, lineHeight: 1.55 }}>
              Upload a CSV bank statement to get your credit score computed automatically.
              Required columns: <code style={{ fontSize: 11, background: 'var(--bg)', padding: '1px 4px', borderRadius: 3 }}>txn_date, amount, txn_type, description, balance_after</code>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <div
              style={{
                border: `2px dashed ${errors.file ? 'var(--bad)' : file ? 'var(--ok)' : 'var(--border)'}`,
                borderRadius: 8,
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: file ? 'rgba(34,197,94,.04)' : 'var(--bg)',
                transition: 'all 150ms',
              }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setFile(f); setErrors(p => ({ ...p, file: undefined })); } }}
            >
              {file ? (
                <div>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>📄</div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ok)' }}>{file.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 3 }}>{(file.size / 1024).toFixed(1)} KB · Click to change</div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>📂</div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--t2)' }}>Click or drag & drop CSV here</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 3 }}>Max 5 MB · CSV only</div>
                </div>
              )}
            </div>
            {errors.file && <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 6 }}>{errors.file}</div>}
            {file && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}>
                ✕ Remove file
              </button>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ flex: 1 }}>
              {submitting ? <><span className="spinner" /> Submitting…</> : 'Submit Application'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/portal/dashboard')} disabled={submitting}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </DashboardShell>
  );
}
