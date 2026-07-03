// ─────────────────────────────────────────────────────────────────────────────
// LoanLens — /portal/eligibility  (All 6 Loan Type Eligibility — Real Data)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { loanService } from '../../services/loanService';
import type { EligibilityData, EligibilityItem } from '../../services/loanService';

const LOAN_ICONS: Record<string, React.ReactNode> = {
  personal_loan: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
  ),
  home_loan: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
  ),
  business_loan: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
  ),
  vehicle_loan: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
  ),
  auto_loan: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
  ),
  education_loan: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10l-10-5-10 5 10 5 10-5z"></path><path d="M6 12v5c0 2 2.5 3 6 3s6-1 6-3v-5"></path></svg>
  ),
  two_wheeler_loan: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="18" r="3"></circle><circle cx="19" cy="18" r="3"></circle><path d="M12 18V8h7M5 18h14M12 8l-4-4H5"></path></svg>
  ),
  gold_loan: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
  ),
};

const DECISION_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  eligible:   { bg: 'rgba(34,197,94,.1)',  color: '#16a34a', label: 'Eligible' },
  partial:    { bg: 'rgba(245,158,11,.1)', color: '#d97706', label: 'Partial' },
  ineligible: { bg: 'rgba(239,68,68,.1)',  color: '#dc2626', label: 'Not Eligible' },
};

function EligibilityCard({ item, onApply }: { item: EligibilityItem; onApply: () => void }) {
  const decision = item.decision ?? 'ineligible';
  const ds = DECISION_STYLE[decision] ?? DECISION_STYLE.ineligible;
  const icon = LOAN_ICONS[item.loan_type] ?? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
  );
  const isEligible = decision === 'eligible' || decision === 'partial';

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ color: 'var(--ink)', display: 'flex', alignItems: 'center' }}>{icon}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--t1)' }}>{item.loan_type_label}</div>
          </div>
        </div>
        <div style={{ padding: '4px 12px', borderRadius: 4, background: ds.bg, color: ds.color, fontSize: 11, fontWeight: 700 }}>
          {ds.label}
        </div>
      </div>

      {/* Amounts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--t3)', marginBottom: 4 }}>
            Eligible Amount
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: isEligible ? 'var(--ok)' : 'var(--t3)', letterSpacing: '-.02em' }}>
            {item.eligible_amount != null && item.eligible_amount > 0
              ? `₹${Number(item.eligible_amount).toLocaleString('en-IN')}`
              : '—'}
          </div>
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '10px 12px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--t3)', marginBottom: 4 }}>
            Applied Amount
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--t2)', letterSpacing: '-.02em' }}>
            {item.applied_amount != null && item.applied_amount > 0
              ? `₹${Number(item.applied_amount).toLocaleString('en-IN')}`
              : '—'}
          </div>
        </div>
      </div>

      {/* Gap reason */}
      {!isEligible && item.gap_reason_label && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', background: 'rgba(239,68,68,.06)', borderRadius: 6, border: '1px solid rgba(239,68,68,.15)' }}>
          <span style={{ color: 'var(--bad)', display: 'flex', alignItems: 'center', marginTop: 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </span>
          <span style={{ fontSize: 12, color: 'var(--bad)', lineHeight: 1.55 }}>{item.gap_reason_label}</span>
        </div>
      )}

      {/* Gap amount */}
      {item.gap_amount != null && Number(item.gap_amount) > 0 && (
        <div style={{ fontSize: 12, color: 'var(--t2)' }}>
          Gap: <strong>₹{Number(item.gap_amount).toLocaleString('en-IN')}</strong> below eligible threshold
        </div>
      )}

      {/* Apply button */}
      {isEligible && (
        <button className="btn btn-primary btn-sm" onClick={onApply} style={{ marginTop: 4 }}>
          Apply for this Loan →
        </button>
      )}
    </div>
  );
}

export default function PortalEligibility() {
  const navigate = useNavigate();
  const [data, setData]     = useState<EligibilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    loanService.getMyEligibility()
      .then(setData)
      .catch(() => setError('Failed to load eligibility data.'))
      .finally(() => setLoading(false));
  }, []);

  const eligibleCount = data?.items.filter(i => i.decision === 'eligible' || i.decision === 'partial').length ?? 0;

  return (
    <DashboardShell
      title="Loan Eligibility"
      subtitle="Your eligibility across all loan products"
      actions={
        data?.best_eligible_amount ? (
          <div style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 500 }}>
            Best offer: <strong style={{ color: 'var(--ok)' }}>₹{Number(data.best_eligible_amount).toLocaleString('en-IN')}</strong>
          </div>
        ) : undefined
      }
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--t3)' }}>
          <span className="spinner" style={{ fontSize: 24 }} />
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          </span>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && !data?.has_data && (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ color: 'var(--ink)', marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          </div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--t1)', marginBottom: 8 }}>No Eligibility Data Yet</div>
          <div style={{ fontSize: 13, color: 'var(--t3)', maxWidth: 380, margin: '0 auto', lineHeight: 1.65 }}>
            Eligibility is computed by our dbt pipeline after you upload a bank statement.
            Upload yours from the Statements page to see what you qualify for.
          </div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/portal/statements')}>
            Upload Bank Statement →
          </button>
        </div>
      )}

      {!loading && data?.has_data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Summary bar */}
          <div className="card" style={{ padding: '14px 20px', display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--t3)', marginBottom: 2 }}>Eligible Products</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: eligibleCount > 0 ? 'var(--ok)' : 'var(--bad)' }}>
                {eligibleCount} / {data.items.length}
              </div>
            </div>
            {data.best_eligible_amount && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--t3)', marginBottom: 2 }}>Best Eligible Amount</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ok)' }}>
                  ₹{Number(data.best_eligible_amount).toLocaleString('en-IN')}
                </div>
              </div>
            )}
          </div>

          {/* Cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {data.items.map(item => (
              <EligibilityCard
                key={item.loan_type}
                item={item}
                onApply={() => navigate('/portal/apply')}
              />
            ))}
          </div>

          <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center' }}>
            Eligibility computed from your bank statement data · Run pipeline to refresh
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
