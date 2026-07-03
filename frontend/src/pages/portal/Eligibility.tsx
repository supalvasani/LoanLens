// ─────────────────────────────────────────────────────────────────────────────
// LoanLens — /portal/eligibility  (All 6 Loan Type Eligibility — Real Data)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { loanService } from '../../services/loanService';
import type { EligibilityData, EligibilityItem } from '../../services/loanService';

const LOAN_ICONS: Record<string, string> = {
  personal_loan:    '👤',
  home_loan:        '🏠',
  business_loan:    '🏢',
  vehicle_loan:     '🚗',
  auto_loan:        '🚗',
  education_loan:   '🎓',
  two_wheeler_loan: '🛵',
  gold_loan:        '🥇',
};

const DECISION_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  eligible:   { bg: 'rgba(34,197,94,.1)',  color: '#16a34a', label: '✓ Eligible' },
  partial:    { bg: 'rgba(245,158,11,.1)', color: '#d97706', label: '⚡ Partial' },
  ineligible: { bg: 'rgba(239,68,68,.1)',  color: '#dc2626', label: '✗ Not Eligible' },
};

function EligibilityCard({ item, onApply }: { item: EligibilityItem; onApply: () => void }) {
  const decision = item.decision ?? 'ineligible';
  const ds = DECISION_STYLE[decision] ?? DECISION_STYLE.ineligible;
  const icon = LOAN_ICONS[item.loan_type] ?? '💰';
  const isEligible = decision === 'eligible' || decision === 'partial';

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 24 }}>{icon}</div>
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
          <span style={{ fontSize: 14, flexShrink: 0 }}>⚠</span>
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
        <div className="alert alert-error"><span>⚠</span><span>{error}</span></div>
      )}

      {!loading && !error && !data?.has_data && (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--t1)', marginBottom: 8 }}>No Eligibility Data Yet</div>
          <div style={{ fontSize: 13, color: 'var(--t3)', maxWidth: 380, margin: '0 auto', lineHeight: 1.65 }}>
            Eligibility is computed by our dbt pipeline after you upload a bank statement.
            Upload yours from the Apply page to see what you qualify for.
          </div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/portal/apply')}>
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
