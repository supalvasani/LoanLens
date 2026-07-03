import api from './api';
import type {
  LoanApplication,
  ApplicationFull,
  LoanType,
  DecisionType,
} from '../types/loan';

// ── Credit Score types ────────────────────────────────────────────────────────
export interface ScoreComponent {
  key: string;
  label: string;
  description: string;
  weight_pct: number;
  score: number | null;
}

export interface CreditScoreData {
  applicant_id: string | null;
  score: number | null;
  risk_tier: string | null;
  recommendation: string | null;
  components: ScoreComponent[];
  computed_at: string | null;
  has_data: boolean;
}

export interface TrendPoint {
  month: string | null;
  score: number | null;
  trend_direction: string | null;
}

export interface CreditTrend {
  trend: TrendPoint[];
  has_data: boolean;
}

// ── Eligibility types ─────────────────────────────────────────────────────────
export interface EligibilityItem {
  loan_type: string;
  loan_type_label: string;
  eligible_amount: number | null;
  applied_amount: number | null;
  gap_amount: number | null;
  gap_reason: string | null;
  gap_reason_label: string | null;
  decision: string | null;
}

export interface EligibilityData {
  items: EligibilityItem[];
  has_data: boolean;
  best_eligible_amount: number | null;
}

// ── Upload result ─────────────────────────────────────────────────────────────
export interface UploadResult {
  rows_inserted: number;
  rows_skipped: number;
  errors: string[];
  applicant_id: string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────
export const loanService = {

  // ── Applications ────────────────────────────────────────────────────────────

  async getApplications(): Promise<LoanApplication[]> {
    const res = await api.get('/applications');
    return res.data;
  },

  // Alias used by analyst Queue.tsx
  async listApplications(): Promise<LoanApplication[]> {
    const res = await api.get('/applications');
    return res.data;
  },

  async getMyApplications(): Promise<(LoanApplication & { primary_rejection_reason?: string | null })[]> {
    const res = await api.get('/applications/my');
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

  // ── Credit Scores ────────────────────────────────────────────────────────────

  async getMyCreditScore(): Promise<CreditScoreData> {
    const res = await api.get('/credit-scores/me');
    return res.data;
  },

  async getMyCreditTrend(): Promise<CreditTrend> {
    const res = await api.get('/credit-scores/me/trend');
    return res.data;
  },

  // ── Eligibility ──────────────────────────────────────────────────────────────

  async getMyEligibility(): Promise<EligibilityData> {
    const res = await api.get('/eligibility/me');
    return res.data;
  },

  // ── Bank Statement Upload ────────────────────────────────────────────────────

  async uploadBankStatement(file: File): Promise<UploadResult> {
    const form = new FormData();
    form.append('file', file);
    const res = await api.post('/upload/bank-statement', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // larger timeout for file processing
    });
    return res.data;
  },

  // ── Decisions ────────────────────────────────────────────────────────────────

  async decideAnalyst(id: string, decision: DecisionType, notes?: string): Promise<void> {
    await api.post(`/decisions/${id}/analyst`, { decision, notes });
  },

  async escalate(id: string, notes: string): Promise<void> {
    await api.post(`/decisions/${id}/escalate`, { notes });
  },

  async decideManager(id: string, decision: DecisionType, notes: string): Promise<void> {
    await api.post(`/decisions/${id}/manager`, { decision, notes });
  },

  // ── Admin ────────────────────────────────────────────────────────────────────

  async overrideStatus(id: string, newStatus: string): Promise<void> {
    await api.put(`/applications/${id}/override`, { new_status: newStatus });
  },
};
