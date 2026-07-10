// Admin-specific TypeScript types

export interface AdminUserResponse {
  user_id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'analyst' | 'applicant';
  is_active: boolean;
  created_at: string;
}

export interface AdminConfigResponse {
  loan_type_id: number;
  loan_type: string;
  min_score: number;
  max_amount: number;
  manager_threshold_amount: number;
  approve_threshold: number;
  review_lower: number;
  review_upper: number;
  updated_by: string | null;
  updated_at: string;
}

export interface AuditLogEntry {
  log_id: string;
  user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditRun {
  run_id: string;
  dag_name: string;
  rows_processed: number;
  failures: number;
  started_at: string;
  ended_at: string;
  status: string;
}

export interface RegistryEntry {
  format_id: string;
  bank_name: string | null;
  match_headers: string[];
  amount_pattern: string;
  confidence_source: string;
  created_at: string;
}

export interface ReviewQueueItem {
  review_id: string;
  file_name: string | null;
  detected_headers: string[];
  sample_rows: Record<string, unknown>[];
  reason: string;
  created_at: string;
}

export interface PipelineDashboardResponse {
  total_uploads: number;
  total_registry: number;
  pending_reviews: number;
  audit_runs: AuditRun[];
  registry_entries: RegistryEntry[];
  pending_items: ReviewQueueItem[];
}
