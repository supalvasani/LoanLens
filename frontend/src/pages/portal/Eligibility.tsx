import { DashboardShell } from '../../components/DashboardShell';

const LOAN_TYPES = [
  { label: 'Personal Loan',  min: '₹50,000',    max: '₹15,00,000',  eligible: '₹8,00,000',  gap: '—',       ok: true  },
  { label: 'Home Loan',      min: '₹5,00,000',  max: '₹1,00,00,000',eligible: '₹32,00,000', gap: '—',       ok: true  },
  { label: 'Business Loan',  min: '₹1,00,000',  max: '₹50,00,000',  eligible: '—',           gap: 'Low score', ok: false },
  { label: 'Vehicle Loan',   min: '₹50,000',    max: '₹20,00,000',  eligible: '₹12,00,000', gap: '—',       ok: true  },
  { label: 'Education Loan', min: '₹1,00,000',  max: '₹25,00,000',  eligible: '₹18,00,000', gap: '—',       ok: true  },
  { label: 'Gold Loan',      min: '₹10,000',    max: '₹5,00,000',   eligible: '₹3,50,000',  gap: '—',       ok: true  },
];

export default function PortalEligibility() {
  return (
    <DashboardShell title="Loan Eligibility" subtitle="Your eligibility across all 6 loan products">
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Loan Product</th>
              <th>Min Amount</th>
              <th>Max Amount</th>
              <th>Your Eligible Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {LOAN_TYPES.map(row => (
              <tr key={row.label}>
                <td style={{ fontWeight: 600 }}>{row.label}</td>
                <td style={{ color: 'var(--t2)' }}>{row.min}</td>
                <td style={{ color: 'var(--t2)' }}>{row.max}</td>
                <td style={{ fontWeight: row.ok ? 600 : 400, color: row.ok ? 'var(--t1)' : 'var(--t3)' }}>
                  {row.eligible}
                </td>
                <td>
                  {row.ok
                    ? <span className="badge badge-ok">Eligible</span>
                    : <span className="badge badge-bad">{row.gap}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg)', fontSize: 12, color: 'var(--t3)' }}>
          Eligibility computed from dbt mart. Run pipeline to refresh.
        </div>
      </div>
    </DashboardShell>
  );
}
