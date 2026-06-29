// ──────────────────────────────────────────────────────────────────────────────
// LoanLens — Auth Service
// login(), register(), refreshToken(), getMe(), logout()
// ──────────────────────────────────────────────────────────────────────────────

import api from './api';
import type { LoginRequest, RegisterRequest, TokenResponse, UserResponse } from '../types/auth';

export const authService = {
  async login(payload: LoginRequest): Promise<TokenResponse> {
    const response = await api.post<TokenResponse>('/auth/login', payload);
    return response.data;
  },

  async register(payload: RegisterRequest): Promise<UserResponse> {
    const response = await api.post<UserResponse>('/auth/register', payload);
    return response.data;
  },

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const response = await api.post<TokenResponse>('/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  async getMe(): Promise<UserResponse> {
    const response = await api.get<UserResponse>('/users/me');
    return response.data;
  },

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },
};
