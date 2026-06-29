// ──────────────────────────────────────────────────────────────────────────────
// LoanLens — Auth Types
// ──────────────────────────────────────────────────────────────────────────────

export type Role = 'admin' | 'manager' | 'analyst' | 'applicant';

export interface TokenPayload {
  user_id: string;
  role: Role;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserResponse {
  user_id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthState {
  user: UserResponse | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
