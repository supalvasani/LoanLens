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
