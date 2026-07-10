// ─────────────────────────────────────────────────────────────────────────────
// LoanLens — Admin: Audit Log Page
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import { adminService } from '../../services/adminService';
import type { AuditLogEntry } from '../../types/admin';

import { type CSSProperties } from 'react';

const ACTION_BADGE: Record<string, CSSProperties> = {
  login:            { backgroundColor: 'rgba(56,189,248,.1)', color: '#0284c7' },
  logout:           { backgroundColor: 'rgba(148,163,184,.1)', color: '#64748b' },
  create_user:      { backgroundColor: 'rgba(34,197,94,.1)', color: '#16a34a' },
  deactivate_user:  { backgroundColor: 'rgba(239,68,68,.1)', color: '#dc2626' },
  reactivate_user:  { backgroundColor: 'rgba(34,197,94,.1)', color: '#16a34a' },
  change_role:      { backgroundColor: 'rgba(245,158,11,.1)', color: '#d97706' },
  update_config:    { backgroundColor: 'rgba(99,102,241,.1)', color: '#6366f1' },
  approve:          { backgroundColor: 'rgba(34,197,94,.1)', color: '#16a34a' },
  reject:           { backgroundColor: 'rgba(239,68,68,.1)', color: '#dc2626' },
  escalate:         { backgroundColor: 'rgba(245,158,11,.1)', color: '#d97706' },
  apply:            { backgroundColor: 'rgba(56,189,248,.1)', color: '#0284c7' },
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_BADGE[action] ?? { backgroundColor: 'rgba(148,163,184,.1)', color: '#64748b' };
  return (
    <span className="badge" style={{ ...style, fontSize: '11px', padding: '2px 8px' }}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

export default function AdminAudit() {
  const [logs,    setLogs]    = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [page,    setPage]    = useState(0);
  const [search,  setSearch]  = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const PAGE_SIZE = 25;

  function load(offset = 0) {
    setLoading(true);
    adminService.getAuditLog({ limit: PAGE_SIZE, offset, action: actionFilter || undefined })
      .then(data => setLogs(data))
      .catch(() => setError('Failed to load audit log.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { setPage(0); load(0); }, [actionFilter]); // eslint-disable-line

  const filtered = logs.filter(l =>
    l.action.includes(search.toLowerCase()) ||
    l.target_type.includes(search.toLowerCase()) ||
    l.target_id.includes(search)
  );

  const uniqueActions = [...new Set(logs.map(l => l.action))].sort((a, b) => a.localeCompare(b));

  return (
    <DashboardShell
      title="Audit Log"
      subtitle="Full trail of all admin, system, and user actions"
    >
      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}><span>⚠</span><span>{error}</span></div>}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="form-input"
          placeholder="Search action, target…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 260 }}
        />
        <select
          className="form-input"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          style={{ maxWidth: 200 }}
        >
          <option value="">All Actions</option>
          {uniqueActions.map(a => (
            <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={() => load(page * PAGE_SIZE)}>↻ Refresh</button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Target Type</th>
              <th>Target ID</th>
              <th>Changes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>
                <span className="spinner" /> Loading audit log…
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>No entries found.</td></tr>
            ) : filtered.map(log => {
              const hasChanges = log.old_value || log.new_value;
              return (
                <>
                  <tr
                    key={log.log_id}
                    style={{ cursor: hasChanges ? 'pointer' : 'default' }}
                    onClick={() => hasChanges && setExpanded(expanded === log.log_id ? null : log.log_id)}
                  >
                    <td style={{ color: 'var(--t3)', fontSize: 12, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                    </td>
                    <td><ActionBadge action={log.action} /></td>
                    <td style={{ fontSize: 12, color: 'var(--t2)' }}>{log.target_type}</td>
                    <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--t3)' }}>
                      {log.target_id?.slice(0, 12)}{log.target_id?.length > 12 ? '…' : ''}
                    </td>
                    <td style={{ color: 'var(--t3)', fontSize: 12 }}>
                      {hasChanges ? (
                        <span style={{ color: 'var(--ink)', fontSize: 11 }}>
                          {expanded === log.log_id ? '▲ Hide' : '▼ Show diff'}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                  {expanded === log.log_id && (
                    <tr key={`${log.log_id}-expand`}>
                      <td colSpan={5} style={{ padding: 0, background: 'var(--bg)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, borderTop: '1px solid var(--border)' }}>
                          <div style={{ padding: '12px 16px' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6, letterSpacing: '.07em' }}>Before</div>
                            <pre style={{ fontSize: 11, color: 'var(--t2)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {log.old_value ? JSON.stringify(log.old_value, null, 2) : 'null'}
                            </pre>
                          </div>
                          <div style={{ padding: '12px 16px', borderLeft: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ok)', marginBottom: 6, letterSpacing: '.07em' }}>After</div>
                            <pre style={{ fontSize: 11, color: 'var(--t2)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {log.new_value ? JSON.stringify(log.new_value, null, 2) : 'null'}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, color: 'var(--t3)' }}>
            Showing {filtered.length} entries (page {page + 1})
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page === 0}
              onClick={() => { setPage(p => p - 1); load((page - 1) * PAGE_SIZE); }}
            >
              ← Prev
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={logs.length < PAGE_SIZE}
              onClick={() => { setPage(p => p + 1); load((page + 1) * PAGE_SIZE); }}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
