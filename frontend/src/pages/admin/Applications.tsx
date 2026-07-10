// ─────────────────────────────────────────────────────────────────────────────
// LoanLens — Admin: Applications Management Page
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import { loanService } from '../../services/loanService';
import { adminService } from '../../services/adminService';
import type { LoanApplication } from '../../types/loan';
import type { AdminUserResponse } from '../../types/admin';

import { type CSSProperties } from 'react';

const STATUS_BADGE: Record<string, CSSProperties> = {
  pending:      { backgroundColor: 'rgba(245,158,11,.12)', color: '#d97706', borderColor: 'rgba(245,158,11,.25)' },
  under_review: { backgroundColor: 'rgba(56,189,248,.12)', color: '#0284c7', borderColor: 'rgba(56,189,248,.25)' },
  escalated:    { backgroundColor: 'rgba(239,68,68,.12)', color: '#dc2626', borderColor: 'rgba(239,68,68,.25)' },
  approved:     { backgroundColor: 'rgba(34,197,94,.12)', color: '#16a34a', borderColor: 'rgba(34,197,94,.25)' },
  rejected:     { backgroundColor: 'rgba(71,85,105,.12)', color: '#475569', borderColor: 'rgba(71,85,105,.25)' },
};

const loanTypeLabelMap: Record<string, string> = {
  home_loan: 'Home Loan',
  personal_loan: 'Personal Loan',
  auto_loan: 'Auto Loan',
  education_loan: 'Education Loan',
  two_wheeler_loan: 'Two-Wheeler',
  business_loan: 'Business Loan',
  gold_loan: 'Gold Loan',
};

export default function AdminApplications() {
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search & filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortField, setSortField] = useState<'submitted_at' | 'amount_requested'>('submitted_at');
  
  // Details Modal
  const [selectedApp, setSelectedApp] = useState<LoanApplication | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [appsData, usersData] = await Promise.all([
          loanService.getApplications(),
          adminService.listUsers(),
        ]);
        setApplications(appsData);
        setUsers(usersData);
        setError(null);
      } catch {
        setError('Failed to load applications data.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getUserName = (userId: string) => {
    const u = users.find(x => x.user_id === userId);
    return u ? u.name : userId.substring(0, 8);
  };

  const getUserEmail = (userId: string) => {
    const u = users.find(x => x.user_id === userId);
    return u ? u.email : 'N/A';
  };

  // Filter logic
  const filtered = applications.filter(app => {
    const applicantName = getUserName(app.user_id).toLowerCase();
    const applicantEmail = getUserEmail(app.user_id).toLowerCase();
    const matchSearch = applicantName.includes(search.toLowerCase()) || 
                        applicantEmail.includes(search.toLowerCase()) ||
                        app.application_id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchType = typeFilter === 'all' || app.loan_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  // Sort logic
  const sorted = [...filtered].sort((a, b) => {
    if (sortField === 'submitted_at') {
      return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
    } else {
      return b.amount_requested - a.amount_requested;
    }
  });

  // Count summaries
  const pendingCount = applications.filter(a => a.status === 'pending').length;
  const reviewCount = applications.filter(a => a.status === 'under_review').length;
  const escalatedCount = applications.filter(a => a.status === 'escalated').length;
  const approvedCount = applications.filter(a => a.status === 'approved').length;

  const renderTableContent = () => {
    if (loading) {
      return (
        <tr>
          <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0' }}>
            <span className="spinner"></span> Loading applications directory...
          </td>
        </tr>
      );
    }
    if (sorted.length === 0) {
      return (
        <tr>
          <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--t3)' }}>
            No applications found matching the current filters.
          </td>
        </tr>
      );
    }
    return sorted.map((app) => (
      <tr key={app.application_id}>
        <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
          {new Date(app.submitted_at).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
          })}
        </td>
        <td>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{getUserName(app.user_id)}</div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{getUserEmail(app.user_id)}</div>
        </td>
        <td>
          <code style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>
            {app.application_id.substring(0, 8)}...
          </code>
        </td>
        <td style={{ textTransform: 'capitalize' }}>
          {loanTypeLabelMap[app.loan_type] || app.loan_type.replaceAll('_', ' ')}
        </td>
        <td style={{ fontWeight: 600 }}>
          ₹{Number(app.amount_requested).toLocaleString('en-IN')}
        </td>
        <td>
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              border: '1px solid',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              ...STATUS_BADGE[app.status]
            }}
          >
            {app.status.replaceAll('_', ' ')}
          </span>
        </td>
        <td style={{ textAlign: 'right' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedApp(app)}
          >
            Audit Details
          </button>
        </td>
      </tr>
    ));
  };

  return (
    <DashboardShell
      title="Application Directory"
      subtitle="View, search, and audit all loan applications across the platform"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {error && (
          <div className="alert alert-error">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Counts summary bar */}
        <div className="grid-4" style={{ gap: 14 }}>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 500 }}>Pending</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--warn)' }}>{pendingCount}</div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 500 }}>Under Review</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--t1)' }}>{reviewCount}</div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 500 }}>Escalated</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--bad)' }}>{escalatedCount}</div>
          </div>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 500 }}>Approved</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: 'var(--ok)' }}>{approvedCount}</div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="card" style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flex: 1, minWidth: 260, gap: 10 }}>
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', maxWidth: 360 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="escalated">Escalated</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All Loan Types</option>
              <option value="home_loan">Home Loan</option>
              <option value="personal_loan">Personal Loan</option>
              <option value="business_loan">Business Loan</option>
              <option value="auto_loan">Auto Loan</option>
              <option value="education_loan">Education Loan</option>
              <option value="two_wheeler_loan">Two-Wheeler</option>
            </select>
            <select className="input" value={sortField} onChange={(e) => setSortField(e.target.value as 'submitted_at' | 'amount_requested')}>
              <option value="submitted_at">Sort by Date (Newest)</option>
              <option value="amount_requested">Sort by Amount Requested</option>
            </select>
          </div>
        </div>

        {/* Main Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Submitted At</th>
                  <th>Applicant</th>
                  <th>Application ID</th>
                  <th>Loan Type</th>
                  <th>Amount Requested</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {renderTableContent()}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Details Audit Modal */}
      {selectedApp && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 500, boxShadow: '0 20px 60px rgba(0,0,0,.25)', padding: '24px 28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Application Audit View</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedApp(null)}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div style={{ width: '40%', fontSize: 13, color: 'var(--t3)' }}>Applicant Name</div>
                <div style={{ width: '60%', fontSize: 13, fontWeight: 600 }}>{getUserName(selectedApp.user_id)}</div>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div style={{ width: '40%', fontSize: 13, color: 'var(--t3)' }}>Applicant Email</div>
                <div style={{ width: '60%', fontSize: 13, fontWeight: 500 }}>{getUserEmail(selectedApp.user_id)}</div>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div style={{ width: '40%', fontSize: 13, color: 'var(--t3)' }}>Application ID</div>
                <div style={{ width: '60%', fontSize: 12, fontFamily: 'monospace' }}>{selectedApp.application_id}</div>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div style={{ width: '40%', fontSize: 13, color: 'var(--t3)' }}>Loan Program</div>
                <div style={{ width: '60%', fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
                  {loanTypeLabelMap[selectedApp.loan_type] || selectedApp.loan_type}
                </div>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div style={{ width: '40%', fontSize: 13, color: 'var(--t3)' }}>Capital Requested</div>
                <div style={{ width: '60%', fontSize: 13, fontWeight: 700 }}>
                  ₹{Number(selectedApp.amount_requested).toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div style={{ width: '40%', fontSize: 13, color: 'var(--t3)' }}>Status</div>
                <div style={{ width: '60%' }}>
                  <span 
                    style={{
                      border: '1px solid',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      ...STATUS_BADGE[selectedApp.status]
                    }}
                  >
                    {selectedApp.status}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div style={{ width: '40%', fontSize: 13, color: 'var(--t3)' }}>Date Submitted</div>
                <div style={{ width: '60%', fontSize: 13 }}>
                  {new Date(selectedApp.submitted_at).toLocaleString('en-IN')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 6 }}>Stated Purpose</div>
                <div 
                  style={{
                    fontSize: 12.5,
                    color: 'var(--t2)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '10px 12px',
                    lineHeight: 1.5,
                    maxHeight: 100,
                    overflowY: 'auto'
                  }}
                >
                  {selectedApp.purpose || 'No purpose listed.'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              {selectedApp.status === 'escalated' ? (
                <a
                  href={`/manager/applications/${selectedApp.application_id}`}
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Go to Manager Review
                </a>
              ) : (
                <a
                  href={`/analyst/applications/${selectedApp.application_id}`}
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Go to Analyst Review
                </a>
              )}
              <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setSelectedApp(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
