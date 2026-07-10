import api from './api';
import type {
  ApplicationFull,
  LoanType,
} from '../types/loan';

export interface ManagerQueueItem {
  application_id: string;
  applicant_name: string | null;
  loan_type: LoanType;
  amount_requested: number;
  score: number | null;
  fraud_flags: {
    flag_type: string;
    flag_detail: string;
    severity: string;
    detected_at: string | null;
  }[];
  escalation_reason: string | null;
  escalated_at: string | null;
  escalated_by_name: string | null;
}

export interface ScoreBucketCount {
  score_bucket: string;
  count: number;
}

export interface RiskBreakdown {
  low_count: number;
  medium_count: number;
  high_count: number;
}

export interface PortfolioData {
  score_distribution: ScoreBucketCount[];
  approval_rate: number;
  risk_breakdown: RiskBreakdown;
  avg_emi_to_income_ratio: number;
  total_applications: number;
  escalated_count: number;
}

export interface LoanTypeConfig {
  loan_type_id: number;
  loan_type: LoanType;
  min_score: number;
  max_amount: string | number;
  manager_threshold_amount: string | number;
  approve_threshold: number;
  review_lower: number;
  review_upper: number;
  updated_by?: string | null;
  updated_at: string;
}

export interface ConfigUpdateFields {
  manager_threshold_amount?: number;
  approve_threshold?: number;
  review_lower?: number;
  review_upper?: number;
}

export const managerService = {
  // 1. View escalation queue (GET /manager/queue)
  async getQueue(): Promise<ManagerQueueItem[]> {
    const res = await api.get('/manager/queue');
    return res.data;
  },

  // 2. View full credit report for escalated application (GET /manager/applications/{id})
  async getApplication(id: string): Promise<ApplicationFull & {
    escalation_reason: string | null;
    escalated_by_name: string | null;
    escalated_at: string | null;
  }> {
    const res = await api.get(`/manager/applications/${id}`);
    return res.data;
  },

  // 3 & 4. Approve / Reject escalated application (POST /decisions/{id})
  async submitDecision(
    id: string,
    payload: { decision: 'approved' | 'rejected'; notes: string }
  ): Promise<unknown> {
    const res = await api.post(`/decisions/${id}`, payload);
    return res.data;
  },

  // 5. View portfolio analytics (GET /manager/portfolio)
  async getPortfolio(): Promise<PortfolioData> {
    const res = await api.get('/manager/portfolio');
    return res.data;
  },

  // 6. Get configurations (GET /manager/config)
  async getConfigs(): Promise<LoanTypeConfig[]> {
    const res = await api.get('/manager/config');
    return res.data;
  },

  // 7. Update configurations (PUT /manager/config/{loan_type})
  async updateConfig(
    loanType: string,
    payload: ConfigUpdateFields
  ): Promise<LoanTypeConfig> {
    const res = await api.put(`/manager/config/${loanType}`, payload);
    return res.data;
  },
};
