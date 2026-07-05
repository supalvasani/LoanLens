import { useState, useEffect } from 'react';
import { DashboardShell } from '../../components/DashboardShell';
import { managerService } from '../../services/managerService';
import type { LoanTypeConfig } from '../../services/managerService';

export default function ManagerConfig() {
  const [configs, setConfigs] = useState<LoanTypeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Row editing states
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
    manager_threshold_amount: number;
    approve_threshold: number;
    review_lower: number;
    review_upper: number;
  } | null>(null);

  const fetchConfigs = () => {
    setLoading(true);
    managerService.getConfigs()
      .then((data) => {
        setConfigs(data);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to load configurations.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleStartEdit = (config: LoanTypeConfig) => {
    setEditingRowId(config.loan_type_id);
    setEditForm({
      manager_threshold_amount: Number(config.manager_threshold_amount),
      approve_threshold: config.approve_threshold,
      review_lower: config.review_lower,
      review_upper: config.review_upper,
    });
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
    setEditForm(null);
  };

  const handleSaveRow = async (config: LoanTypeConfig) => {
    if (!editForm) return;

    // Validation checks
    if (editForm.review_lower > editForm.review_upper) {
      alert("Validation Error: Review Band Lower cannot be higher than Review Band Upper.");
      return;
    }

    if (editForm.approve_threshold < editForm.review_upper) {
      alert("Validation Error: Auto-Approve threshold should generally be greater than or equal to Review Band Upper.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to update thresholds for ${config.loan_type.replace(/_/g, ' ').toUpperCase()}?\n\n` +
      `New Thresholds:\n` +
      `- Manager Threshold: ₹${editForm.manager_threshold_amount.toLocaleString('en-IN')}\n` +
      `- Auto-Approve: ${editForm.approve_threshold}\n` +
      `- Review Band: ${editForm.review_lower} - ${editForm.review_upper}\n\n` +
      `Changes take effect immediately and will be logged in the audit trail.`
    );

    if (!confirmed) return;

    try {
      await managerService.updateConfig(config.loan_type, editForm);
      setSuccessMsg(`Thresholds for ${config.loan_type.replace(/_/g, ' ')} updated successfully!`);
      setEditingRowId(null);
      setEditForm(null);
      
      // Reload values
      fetchConfigs();

      // Clear success alert after 4 seconds
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to update config.');
    }
  };

  const handleInputChange = (field: keyof NonNullable<typeof editForm>, value: number) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      [field]: value
    });
  };

  return (
    <DashboardShell
      title="Loan Threshold Configurations"
      subtitle="Modify branch limits and approval boundaries per product type"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="fade-up">
        {error && (
          <div className="alert alert-error">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert alert-success">
            <span>✓</span>
            <span>{successMsg}</span>
          </div>
        )}

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>Product Threshold Policies</span>
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>Admin-only limits (Min Score, Max Amount) are hidden</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Loan Type</th>
                  <th>Manager Threshold (₹)</th>
                  <th>Auto-Approve Threshold</th>
                  <th>Review Band Lower</th>
                  <th>Review Band Upper</th>
                  <th style={{ width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && configs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--t3)' }}>
                      <span className="spinner" style={{ marginRight: 8 }}></span> Loading configs…
                    </td>
                  </tr>
                ) : (
                  configs.map((config) => {
                    const isEditing = editingRowId === config.loan_type_id;

                    return (
                      <tr key={config.loan_type_id}>
                        <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                          {config.loan_type.replace(/_/g, ' ')}
                        </td>
                        
                        {/* Manager Threshold */}
                        <td onClick={() => !isEditing && handleStartEdit(config)} style={{ cursor: isEditing ? 'default' : 'pointer' }}>
                          {isEditing && editForm ? (
                            <input
                              type="number"
                              className="form-input"
                              style={{ width: '100%', padding: '4px 8px' }}
                              value={editForm.manager_threshold_amount}
                              onChange={(e) => handleInputChange('manager_threshold_amount', Number(e.target.value))}
                            />
                          ) : (
                            <span style={{ borderBottom: '1px dashed var(--border)', paddingBottom: 2 }}>
                              ₹{Number(config.manager_threshold_amount).toLocaleString('en-IN')}
                            </span>
                          )}
                        </td>

                        {/* Auto-Approve Threshold */}
                        <td onClick={() => !isEditing && handleStartEdit(config)} style={{ cursor: isEditing ? 'default' : 'pointer' }}>
                          {isEditing && editForm ? (
                            <input
                              type="number"
                              className="form-input"
                              style={{ width: '100%', padding: '4px 8px' }}
                              value={editForm.approve_threshold}
                              onChange={(e) => handleInputChange('approve_threshold', Number(e.target.value))}
                            />
                          ) : (
                            <span style={{ borderBottom: '1px dashed var(--border)', paddingBottom: 2 }}>
                              {config.approve_threshold}
                            </span>
                          )}
                        </td>

                        {/* Review Band Lower */}
                        <td onClick={() => !isEditing && handleStartEdit(config)} style={{ cursor: isEditing ? 'default' : 'pointer' }}>
                          {isEditing && editForm ? (
                            <input
                              type="number"
                              className="form-input"
                              style={{ width: '100%', padding: '4px 8px' }}
                              value={editForm.review_lower}
                              onChange={(e) => handleInputChange('review_lower', Number(e.target.value))}
                            />
                          ) : (
                            <span style={{ borderBottom: '1px dashed var(--border)', paddingBottom: 2 }}>
                              {config.review_lower}
                            </span>
                          )}
                        </td>

                        {/* Review Band Upper */}
                        <td onClick={() => !isEditing && handleStartEdit(config)} style={{ cursor: isEditing ? 'default' : 'pointer' }}>
                          {isEditing && editForm ? (
                            <input
                              type="number"
                              className="form-input"
                              style={{ width: '100%', padding: '4px 8px' }}
                              value={editForm.review_upper}
                              onChange={(e) => handleInputChange('review_upper', Number(e.target.value))}
                            />
                          ) : (
                            <span style={{ borderBottom: '1px dashed var(--border)', paddingBottom: 2 }}>
                              {config.review_upper}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleSaveRow(config)}
                              >
                                Save
                              </button>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={handleCancelEdit}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => handleStartEdit(config)}
                            >
                              Edit Row
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
