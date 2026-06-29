// LoanLens — Loan & Decision Types (Phase 4)

export type LoanType =
  | 'personal_loan'
  | 'home_loan'
  | 'business_loan'
  | 'vehicle_loan'
  | 'education_loan'
  | 'gold_loan';

export type ApplicationStatus =
  | 'pending'
  | 'under_review'
  | 'escalated'
  | 'approved'
  | 'rejected';

export type DecisionType = 'approved' | 'rejected' | 'escalated';

export type RiskTier = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

// ── Application ──────────────────────────────────────────────────────────────

export interface LoanApplication {
  application_id: string;
  applicant_id: string;
  loan_type: LoanType;
  amount_requested: number;
  purpose: string;
  status: ApplicationStatus;
  submitted_at: string;
  updated_at: string;
}

export interface ApplicationFull {
  application: LoanApplication;
  credit_score: CreditScore | null;
  fraud_flags: FraudFlag[];
  eligibility: LoanEligibility | null;
  underwriter_report: UnderwriterReport | null;
  trend: MonthlyTrend[];
}

// ── Decision ─────────────────────────────────────────────────────────────────

export interface Decision {
  decision_id: string;
  application_id: string;
  decided_by: string;
  decision: DecisionType;
  notes: string | null;
  decided_at: string;
}

// ── Mart Data ─────────────────────────────────────────────────────────────────

export interface CreditScore {
  applicant_id: string;
  final_score: number;
  risk_tier: RiskTier;
  recommendation: string;
  income_stability_score: number;
  emi_burden_score: number;
  bounce_rate_score: number;
  balance_stability_score: number;
  scored_at: string;
}

export interface FraudFlag {
  flag_id: string;
  applicant_id: string;
  flag_type: string;
  severity: 'low' | 'medium' | 'high';
  flagged_at: string;
}

export interface LoanEligibility {
  applicant_id: string;
  loan_type: LoanType;
  eligible_amount: number;
  applied_amount: number;
  gap_amount: number;
  gap_reason: string | null;
  is_eligible: boolean;
}

export interface UnderwriterReport {
  applicant_id: string;
  monthly_income: number;
  monthly_obligations: number;
  emi_to_income_ratio: number;
  avg_monthly_balance: number;
  bounce_rate: number;
  loan_type: LoanType;
  max_eligible_emi: number;
  risk_segment: string;
}

export interface MonthlyTrend {
  month: string;
  score: number;
  income: number;
}

// ── Loan Type Config ──────────────────────────────────────────────────────────

export interface LoanTypeConfig {
  loan_type: LoanType;
  min_amount: number;
  max_amount: number;
  min_score_threshold: number;
  manager_threshold_amount: number;
  interest_rate_base: number;
  max_tenure_months: number;
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  log_id: string;
  actor_id: string;
  actor_name?: string;
  action: string;
  target_type: string;
  target_id: string;
  old_value: string | null;
  new_value: string | null;
  logged_at: string;
}
