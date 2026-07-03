import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardShell } from '../../components/DashboardShell';
import { loanService } from '../../services/loanService';
import type { LoanApplication } from '../../types/loan';

const STATUS_BADGE: Record<string, string> = {
  pending:      'badge-warn',
  under_review: 'badge-info',
  escalated:    'badge-warn',
  approved:     'badge-ok',
  rejected:     'badge-bad',
};

export default function AnalystQueue() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<LoanApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    loanService.listApplications()
      .then(setApps)
      .catch(() => setError('Failed to load applications'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = apps.filter(a =>
    a.loan_type.includes(search.toLowerCase()) ||
    a.application_id.includes(search)
  );

  return (
    <DashboardShell title="Review Queue" subtitle="All non-escalated applications">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            className="form-input"
            placeholder="Filter by type or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
        </div>

        {error && <div className="alert alert-error"><span>⚠</span><span>{error}</span></div>}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>App ID</th>
                <th>Loan Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>No applications found.</td></tr>
              ) : filtered.map(app => (
                <tr key={app.application_id} style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/analyst/applications/${app.application_id}`)}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{app.application_id.slice(0, 8)}…</td>
                  <td style={{ textTransform: 'capitalize' }}>{app.loan_type.replace(/_/g, ' ')}</td>
                  <td>₹{Number(app.amount_requested).toLocaleString('en-IN')}</td>
                  <td><span className={`badge ${STATUS_BADGE[app.status] ?? 'badge-info'}`}>{app.status}</span></td>
                  <td style={{ color: 'var(--t3)', fontSize: 12 }}>{new Date(app.submitted_at).toLocaleDateString()}</td>
                  <td><button className="btn btn-ghost btn-sm">Review →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
