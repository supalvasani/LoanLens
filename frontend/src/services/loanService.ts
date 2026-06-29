import api from './api';
import type { 
  LoanApplication, 
  ApplicationFull,
  LoanType,
  DecisionType
} from '../types/loan';

export const loanService = {
  // Applications
  async getApplications(): Promise<LoanApplication[]> {
    const res = await api.get('/applications');
    return res.data;
  },

  async getApplication(id: string): Promise<ApplicationFull> {
    const res = await api.get(`/applications/${id}`);
    return res.data;
  },

  async apply(payload: { loan_type: LoanType; amount_requested: number; purpose: string }): Promise<LoanApplication> {
    const res = await api.post('/applications/apply', payload);
    return res.data;
  },

  // Decisions
  async decideAnalyst(id: string, decision: DecisionType, notes?: string): Promise<void> {
    await api.post(`/decisions/${id}/analyst`, { decision, notes });
  },

  async escalate(id: string, notes: string): Promise<void> {
    await api.post(`/decisions/${id}/escalate`, { notes });
  },

  async decideManager(id: string, decision: DecisionType, notes: string): Promise<void> {
    await api.post(`/decisions/${id}/manager`, { decision, notes });
  },

  // Admin
  async overrideStatus(id: string, newStatus: string): Promise<void> {
    await api.put(`/applications/${id}/override`, { new_status: newStatus });
  }
};
