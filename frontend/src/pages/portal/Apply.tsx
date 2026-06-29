import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { loanService } from '../../services/loanService';
import type { LoanType } from '../../types/loan';

const LOAN_TYPES: { value: LoanType; label: string }[] = [
  { value: 'personal_loan',  label: 'Personal Loan' },
  { value: 'home_loan',      label: 'Home Loan' },
  { value: 'business_loan',  label: 'Business Loan' },
  { value: 'vehicle_loan',   label: 'Vehicle Loan' },
  { value: 'education_loan', label: 'Education Loan' },
  { value: 'gold_loan',      label: 'Gold Loan' },
];

export default function PortalApply() {
  const navigate = useNavigate();
  const [loanType, setLoanType] = useState<LoanType>('personal_loan');
  const [amount, setAmount]     = useState('');
  const [purpose, setPurpose]   = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = parseFloat(amount);
    if (!amt || amt < 10000) { setError('Amount must be at least ₹10,000.'); return; }
    if (!purpose.trim())     { setError('Please describe the purpose.'); return; }
    setLoading(true);
    try {
      await loanService.apply({ loan_type: loanType, amount_requested: amt, purpose: purpose.trim() });
      navigate('/portal/dashboard');
    } catch {
      setError('Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardShell title="Apply Now" subtitle="Submit a new loan application">
      <div style={{ maxWidth: 560 }}>
        <div className="card">
          <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--t1)', marginBottom: 20 }}>
            New Loan Application
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 18 }}>
              <span>⚠</span><span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Loan Type</label>
              <select className="form-input" value={loanType}
                onChange={(e) => setLoanType(e.target.value as LoanType)} disabled={loading}>
                {LOAN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Amount Requested (₹)</label>
              <input type="number" className="form-input" placeholder="e.g. 500000"
                value={amount} onChange={(e) => setAmount(e.target.value)}
                min={10000} disabled={loading} required />
            </div>

            <div className="form-group">
              <label className="form-label">Purpose</label>
              <textarea className="form-input" rows={4}
                placeholder="Describe the purpose of this loan…"
                value={purpose} onChange={(e) => setPurpose(e.target.value)}
                disabled={loading} required
                style={{ resize: 'vertical', fontFamily: 'inherit' }} />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <><span className="spinner" /> Submitting…</> : 'Submit Application'}
              </button>
              <button type="button" className="btn btn-secondary"
                onClick={() => navigate('/portal/dashboard')} disabled={loading}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardShell>
  );
}
