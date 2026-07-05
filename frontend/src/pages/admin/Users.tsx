// ─────────────────────────────────────────────────────────────────────────────
// LoanLens — Admin: Users Management Page
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import { adminService } from '../../services/adminService';
import type { AdminUserResponse } from '../../types/admin';

import { type CSSProperties } from 'react';

const ROLE_BADGE: Record<string, CSSProperties> = {
  admin:     { backgroundColor: 'rgba(99,102,241,.12)', color: '#6366f1', borderColor: 'rgba(99,102,241,.25)' },
  manager:   { backgroundColor: 'rgba(245,158,11,.12)', color: '#d97706', borderColor: 'rgba(245,158,11,.25)' },
  analyst:   { backgroundColor: 'rgba(56,189,248,.12)', color: '#0284c7', borderColor: 'rgba(56,189,248,.25)' },
  applicant: { backgroundColor: 'rgba(34,197,94,.12)', color: '#16a34a', borderColor: 'rgba(34,197,94,.25)' },
};

const ROLES = ['admin', 'manager', 'analyst', 'applicant'];

export default function AdminUsers() {
  const [users, setUsers]       = useState<AdminUserResponse[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [busy, setBusy]         = useState<string | null>(null);

  // Create user modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'applicant' });
  const [creating, setCreating]   = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  function loadInit() {
    adminService.listUsers()
      .then(setUsers)
      .catch(() => setError('Failed to load users.'))
      .finally(() => setLoading(false));
  }

  function loadWithLoading() {
    setLoading(true);
    loadInit();
  }

  useEffect(() => { loadInit(); }, []);

  async function toggleActive(u: AdminUserResponse) {
    setBusy(u.user_id);
    try {
      if (u.is_active) await adminService.deactivate(u.user_id);
      else             await adminService.reactivate(u.user_id);
      loadWithLoading();
    } catch { setError('Action failed.'); }
    finally { setBusy(null); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setCreateError(null);
    try {
      await adminService.createUser(newUser);
      setShowCreate(false);
      setNewUser({ name: '', email: '', password: '', role: 'applicant' });
      loadWithLoading();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setCreateError(axiosErr?.response?.data?.detail ?? 'Failed to create user.');
    } finally { setCreating(false); }
  }

  const filtered = users.filter(u => {
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
                        u.email.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  return (
    <DashboardShell
      title="User Management"
      subtitle={`${users.length} total users across all roles`}
      actions={
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          + New User
        </button>
      }
    >
      {/* Create user modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 420, boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Create User</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              {createError && <div className="alert alert-error" style={{ marginBottom: 14 }}><span>⚠</span><span>{createError}</span></div>}
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" required value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Priya Sharma" />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" required value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} placeholder="priya@loanlens.in" />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" type="password" required minLength={8} value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} placeholder="Min 8 characters" />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select className="form-input" value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                  {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={creating} style={{ flex: 1 }}>
                  {creating ? <span className="spinner" /> : 'Create User'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}><span>⚠</span><span>{error}</span></div>}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          className="form-input"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', ...ROLES].map(r => (
            <button
              key={r}
              className={`btn btn-sm ${roleFilter === r ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setRoleFilter(r)}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>
                <span className="spinner" /> Loading users…
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>No users found.</td></tr>
            ) : filtered.map(u => (
              <tr key={u.user_id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 4, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--t2)', flexShrink: 0 }}>
                      {u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{u.name}</span>
                  </div>
                </td>
                <td style={{ color: 'var(--t2)', fontSize: 12 }}>{u.email}</td>
                <td>
                  <span className="badge" style={ROLE_BADGE[u.role]}>
                    {u.role}
                  </span>
                </td>
                <td>
                  <span className={`badge ${u.is_active ? 'badge-ok' : 'badge-bad'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ color: 'var(--t3)', fontSize: 12 }}>
                  {new Date(u.created_at).toLocaleDateString('en-IN')}
                </td>
                <td>
                  <button
                    className={`btn btn-sm ${u.is_active ? 'btn-secondary' : 'btn-ghost'}`}
                    disabled={busy === u.user_id}
                    onClick={() => toggleActive(u)}
                    style={{ fontSize: 11 }}
                  >
                    {busy === u.user_id ? <span className="spinner" /> : u.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
