// LoanLens — Loan & Decision Types (matches actual backend schema)

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

// ── Application ──────────────────────────────────────────────────────────────

export interface LoanApplication {
  application_id: string;
  user_id: string;
  loan_type: LoanType;
  amount_requested: number;
  purpose: string;
  status: ApplicationStatus;
  submitted_at: string;
}

// ── Mart Data (matches backend CreditScoreData, etc.) ────────────────────────

export interface CreditScore {
  applicant_id: string | null;
  score: number | null;                       // field is "score" not "final_score"
  income_stability_score: number | null;
  emi_burden_score: number | null;
  bounce_score: number | null;                // "bounce_score" not "bounce_rate_score"
  balance_score: number | null;               // "balance_score" not "balance_stability_score"
  recommendation: string | null;
  score_breakdown_json: Record<string, unknown> | null;
  computed_at: string | null;
}

export interface FraudFlag {
  flag_type: string;
  flag_detail: string;
  severity: string;
  detected_at: string | null;
}

export interface LoanEligibility {
  loan_type: string;
  eligible_amount: number | null;
  applied_amount: number | null;
  gap_amount: number | null;
  gap_reason: string | null;
  decision: string | null;                    // "eligible" | "ineligible"
}

export interface UnderwriterReport {
  avg_monthly_income: number | null;          // not "monthly_income"
  emi_burden_ratio: number | null;            // not "emi_to_income_ratio"
  bounce_count: number | null;
  bounce_rate: number | null;
  savings_potential: number | null;
  fraud_flags: Record<string, unknown>[];
  risk_segment: string | null;
}

export interface MonthlyTrend {
  month: string | null;
  score: number | null;
  trend_direction: string | null;
}

export interface Decision {
  decision_id: string;
  application_id: string;
  decided_by: string;
  decision: DecisionType;
  notes: string | null;
  escalated_to: string | null;
  decided_at: string;
}

// ── Full Application Response ─────────────────────────────────────────────────

export interface ApplicationFull {
  application: LoanApplication;
  credit_score: CreditScore | null;
  fraud_flags: FraudFlag[];
  eligibility: LoanEligibility[];             // list, not single object
  underwriter_report: UnderwriterReport | null;
  monthly_trend: MonthlyTrend[];             // "monthly_trend" not "trend"
  risk_tier: string | null;
  decisions: Decision[];
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
