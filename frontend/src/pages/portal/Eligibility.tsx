// ─────────────────────────────────────────────────────────────────────────────
// LoanLens — /portal/eligibility  (All 6 Loan Type Eligibility — Tabular View)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { loanService } from '../../services/loanService';
import type { EligibilityData } from '../../services/loanService';

const DECISION_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  eligible:   { bg: 'rgba(34, 197, 94, 0.08)',  color: '#15803d', border: 'rgba(34, 197, 94, 0.25)',  label: 'Eligible' },
  partial:    { bg: 'rgba(245, 158, 11, 0.08)', color: '#b45309', border: 'rgba(245, 158, 11, 0.25)', label: 'Partial Eligibility' },
  ineligible: { bg: 'rgba(239, 68, 68, 0.08)',  color: '#b91c1c', border: 'rgba(239, 68, 68, 0.25)',  label: 'Ineligible' },
};

export default function PortalEligibility() {
  const navigate = useNavigate();
  const [data, setData]       = useState<EligibilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    loanService.getMyEligibility()
      .then(setData)
      .catch(() => setError('Failed to load eligibility records.'))
      .finally(() => setLoading(false));
  }, []);

  const eligibleCount = data?.items.filter(i => i.decision === 'eligible' || i.decision === 'partial').length ?? 0;

  return (
    <DashboardShell
      title="Loan Product Eligibility"
      subtitle="Evaluation metrics and pre-approved limits across all financial products"
      actions={
        data?.best_eligible_amount ? (
          <div style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 500 }}>
            Maximum Available Limit: <strong style={{ color: 'var(--ok)', fontSize: 15, fontWeight: 700 }}>₹{Number(data.best_eligible_amount).toLocaleString('en-IN')}</strong>
          </div>
        ) : undefined
      }
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--t3)' }}>
          <span className="spinner" style={{ fontSize: 24 }} />
        </div>
      )}

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 20 }}>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && !data?.has_data && (
        <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--t1)', marginBottom: 8 }}>No Eligibility Assessment Available</div>
          <div style={{ fontSize: 13, color: 'var(--t3)', maxWidth: 420, margin: '0 auto', lineHeight: 1.65 }}>
            Eligibility limits are computed after financial telemetry parsing.
            Upload your bank statement to view pre-approved limits across all products.
          </div>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/portal/statements')}>
            Upload Bank Statement →
          </button>
        </div>
      )}

      {!loading && data?.has_data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Summary metrics header */}
          <div className="card" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', gap: 36, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--t3)', marginBottom: 4 }}>
                  Eligible Products
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: eligibleCount > 0 ? 'var(--ok)' : 'var(--bad)' }}>
                  {eligibleCount} of {data.items.length} Pre-approved
                </div>
              </div>
              {data.best_eligible_amount && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--t3)', marginBottom: 4 }}>
                    Best Eligible Amount
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ok)' }}>
                    ₹{Number(data.best_eligible_amount).toLocaleString('en-IN')}
                  </div>
                </div>
              )}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/portal/apply')}>
              Apply for Loan →
            </button>
          </div>

          {/* Tabular View */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', color: 'var(--t3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    <th style={{ padding: '14px 20px' }}>Loan Product</th>
                    <th style={{ padding: '14px 20px' }}>Status</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right' }}>Eligible Limit</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right' }}>Applied Amount</th>
                    <th style={{ padding: '14px 20px' }}>Assessment Remarks</th>
                    <th style={{ padding: '14px 20px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => {
                    const decision = item.decision ?? 'ineligible';
                    const ds = DECISION_STYLE[decision] ?? DECISION_STYLE.ineligible;
                    const isEligible = decision === 'eligible' || decision === 'partial';

                    return (
                      <tr
                        key={item.loan_type}
                        style={{ borderBottom: '1px solid var(--border)', transition: 'background .15s ease' }}
                      >
                        {/* Product Name */}
                        <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--t1)' }}>
                          {item.loan_type_label}
                        </td>

                        {/* Status Badge */}
                        <td style={{ padding: '16px 20px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: 4,
                            background: ds.bg,
                            color: ds.color,
                            border: `1px solid ${ds.border}`,
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'inline-block',
                            letterSpacing: '.02em'
                          }}>
                            {ds.label}
                          </span>
                        </td>

                        {/* Eligible Limit */}
                        <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 700, color: isEligible ? 'var(--ok)' : 'var(--t3)', fontSize: 14 }}>
                          {item.eligible_amount != null && item.eligible_amount > 0
                            ? `₹${Number(item.eligible_amount).toLocaleString('en-IN')}`
                            : '—'}
                        </td>

                        {/* Applied Amount */}
                        <td style={{ padding: '16px 20px', textAlign: 'right', fontWeight: 600, color: 'var(--t2)', fontSize: 13 }}>
                          {item.applied_amount != null && item.applied_amount > 0
                            ? `₹${Number(item.applied_amount).toLocaleString('en-IN')}`
                            : '—'}
                        </td>

                        {/* Assessment Remarks */}
                        <td style={{ padding: '16px 20px', color: 'var(--t2)', fontSize: 12, maxWidth: 280 }}>
                          {!isEligible ? (
                            <span style={{ color: 'var(--bad)' }}>
                              {item.gap_reason_label || 'Below underwriting threshold'}
                              {item.gap_amount != null && Number(item.gap_amount) > 0 && (
                                <span> (Shortfall: ₹{Number(item.gap_amount).toLocaleString('en-IN')})</span>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--t3)' }}>
                              Passed automated underwriting rules
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          {isEligible ? (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => navigate('/portal/apply')}
                              style={{ padding: '6px 12px', fontSize: 12 }}
                            >
                              Apply Now →
                            </button>
                          ) : (
                            <span style={{ color: 'var(--t3)', fontSize: 12 }}>N/A</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center', marginTop: 4 }}>
            Loan eligibility rules evaluated dynamically based on parsed telemetry.
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
