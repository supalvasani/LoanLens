// ─────────────────────────────────────────────────────────────────────────────
// LoanLens — Admin: Loan Type Config Page
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import { adminService } from '../../services/adminService';
import type { AdminConfigResponse } from '../../types/admin';

function EditModal({
  config,
  onSave,
  onClose,
}: {
  config: AdminConfigResponse;
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    min_score:                  config.min_score,
    max_amount:                 config.max_amount,
    manager_threshold_amount:   config.manager_threshold_amount,
    approve_threshold:          config.approve_threshold,
    review_lower:               config.review_lower,
    review_upper:               config.review_upper,
  });
  const [saving, setSaving]   = useState(false);
  const [error,  setError]    = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await adminService.updateConfig(config.loan_type_id, form);
      onSave();
    } catch {
      setError('Failed to save. Please check values and try again.');
    } finally { setSaving(false); }
  }

  function field(key: keyof typeof form, label: string, help?: string) {
    return (
      <div className="form-group">
        <label className="form-label">{label}</label>
        <input
          className="form-input"
          type="number"
          min={0}
          value={form[key]}
          onChange={e => setForm(p => ({ ...p, [key]: Number(e.target.value) }))}
        />
        {help && <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>{help}</div>}
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ width: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Edit Config</div>
            <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 2 }}>
              {config.loan_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error" style={{ marginBottom: 14 }}><span>⚠</span><span>{error}</span></div>}
          {field('min_score',                'Minimum Credit Score',           'Minimum score to qualify for this loan type')}
          {field('max_amount',               'Maximum Loan Amount (₹)',         'Upper cap on loan amount')}
          {field('manager_threshold_amount', 'Manager Escalation Threshold (₹)','Applications above this need manager approval')}
          {field('approve_threshold',        'Auto-Approve Score Threshold',    'Score above this gets auto-approved')}
          {field('review_lower',             'Review Band: Lower Score',        'Scores in this range go to analyst review')}
          {field('review_upper',             'Review Band: Upper Score',        'Scores in this range go to analyst review')}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
              {saving ? <span className="spinner" /> : 'Save Changes'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminConfig() {
  const [configs,  setConfigs]  = useState<AdminConfigResponse[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [editing,  setEditing]  = useState<AdminConfigResponse | null>(null);
  const [saved,    setSaved]    = useState<string | null>(null);

  function load() {
    setLoading(true);
    adminService.listConfigs()
      .then(setConfigs)
      .catch(() => setError('Failed to load config.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function handleSaved() {
    setEditing(null);
    setSaved('Configuration updated successfully.');
    setTimeout(() => setSaved(null), 3000);
    load();
  }

  const fmt = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;

  return (
    <DashboardShell
      title="Loan Type Configuration"
      subtitle="Manage eligibility thresholds and amount limits per loan type"
    >
      {editing && <EditModal config={editing} onSave={handleSaved} onClose={() => setEditing(null)} />}

      {error  && <div className="alert alert-error"   style={{ marginBottom: 16 }}><span>⚠</span><span>{error}</span></div>}
      {saved  && <div className="alert alert-success" style={{ marginBottom: 16 }}><span>✓</span><span>{saved}</span></div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>
            <span className="spinner" /> Loading…
          </div>
        ) : configs.map(c => (
          <div key={c.loan_type_id} className="card" style={{ padding: '18px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--t1)' }}>
                  {c.loan_type.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())}
                </div>
                {c.updated_at && (
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                    Last updated: {new Date(c.updated_at).toLocaleDateString('en-IN')}
                    {c.updated_by ? ` by ${c.updated_by}` : ''}
                  </div>
                )}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditing(c)}>Edit</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 32px' }}>
              {[
                { label: 'Min Score',          value: String(c.min_score) },
                { label: 'Max Amount',         value: fmt(c.max_amount) },
                { label: 'Manager Threshold',  value: fmt(c.manager_threshold_amount) },
                { label: 'Auto-Approve ≥',     value: String(c.approve_threshold) },
                { label: 'Review Band',        value: `${c.review_lower} – ${c.review_upper}` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 3 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Score band visualiser */}
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6 }}>
                Score Bands (0 – 100)
              </div>
              <div style={{ position: 'relative', height: 10, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
                {/* Reject zone */}
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${c.review_lower}%`, background: 'rgba(198,40,40,.25)' }} />
                {/* Review zone */}
                <div style={{ position: 'absolute', left: `${c.review_lower}%`, top: 0, height: '100%', width: `${c.review_upper - c.review_lower}%`, background: 'rgba(230,81,0,.3)' }} />
                {/* Approve zone */}
                <div style={{ position: 'absolute', left: `${c.approve_threshold}%`, top: 0, height: '100%', width: `${100 - c.approve_threshold}%`, background: 'rgba(46,125,50,.3)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--t3)' }}>
                <span style={{ color: 'var(--bad)' }}>Reject &lt;{c.review_lower}</span>
                <span style={{ color: 'var(--warn)' }}>Review {c.review_lower}–{c.review_upper}</span>
                <span style={{ color: 'var(--ok)' }}>Approve ≥{c.approve_threshold}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}
