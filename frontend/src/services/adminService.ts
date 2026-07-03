import api from './api';
import type { AdminUserResponse, AdminConfigResponse, AuditLogEntry } from '../types/admin';

export const adminService = {
  // ── Users ──────────────────────────────────────────────────────────────────
  async listUsers(role?: string): Promise<AdminUserResponse[]> {
    const params = role ? { role } : {};
    const res = await api.get('/admin/users', { params });
    return res.data;
  },

  async createUser(payload: {
    name: string; email: string; password: string; role: string;
  }): Promise<AdminUserResponse> {
    const res = await api.post('/admin/users', payload);
    return res.data;
  },

  async changeRole(userId: string, role: string): Promise<AdminUserResponse> {
    const res = await api.patch(`/admin/users/${userId}/role`, { role });
    return res.data;
  },

  async deactivate(userId: string): Promise<AdminUserResponse> {
    const res = await api.patch(`/admin/users/${userId}/deactivate`);
    return res.data;
  },

  async reactivate(userId: string): Promise<AdminUserResponse> {
    const res = await api.patch(`/admin/users/${userId}/reactivate`);
    return res.data;
  },

  // ── Loan Type Config ───────────────────────────────────────────────────────
  async listConfigs(): Promise<AdminConfigResponse[]> {
    const res = await api.get('/admin/config');
    return res.data;
  },

  async updateConfig(loanTypeId: number, payload: Partial<{
    min_score: number;
    max_amount: number;
    manager_threshold_amount: number;
    approve_threshold: number;
    review_lower: number;
    review_upper: number;
  }>): Promise<AdminConfigResponse> {
    const res = await api.patch(`/admin/config/${loanTypeId}`, payload);
    return res.data;
  },

  // ── Audit Log ──────────────────────────────────────────────────────────────
  async getAuditLog(params?: {
    user_id?: string; action?: string; target_type?: string;
    limit?: number; offset?: number;
  }): Promise<AuditLogEntry[]> {
    const res = await api.get('/admin/audit', { params });
    return res.data;
  },
};
