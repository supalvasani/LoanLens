// ──────────────────────────────────────────────────────────────────────────────
// LoanLens — Auth Context
// Provides user state + login/logout to the entire app
// ──────────────────────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { jwtDecode } from 'jwt-decode';
import { authService } from '../services/authService';
import type { AuthState, LoginRequest, Role, TokenPayload } from '../types/auth';

// ── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue extends AuthState {
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => void;
}

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Helpers ──────────────────────────────────────────────────────────────────

function getRoleFromToken(token: string): Role | null {
  try {
    const decoded = jwtDecode<TokenPayload>(token);
    return decoded.role ?? null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const { exp } = jwtDecode<TokenPayload>(token);
    return Date.now() / 1000 > exp;
  } catch {
    return true;
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // On mount — restore from localStorage
  useEffect(() => {
    const restoreSession = async () => {
      const stored = localStorage.getItem('access_token');
      const storedRefresh = localStorage.getItem('refresh_token');

      if (!stored || isTokenExpired(stored)) {
        // Try refresh
        if (storedRefresh && !isTokenExpired(storedRefresh)) {
          try {
            const tokens = await authService.refreshToken(storedRefresh);
            localStorage.setItem('access_token', tokens.access_token);
            localStorage.setItem('refresh_token', tokens.refresh_token);
            const user = await authService.getMe();
            setState({
              user,
              accessToken: tokens.access_token,
              refreshToken: tokens.refresh_token,
              isAuthenticated: true,
              isLoading: false,
            });
            return;
          } catch {
            localStorage.clear();
          }
        }
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }

      try {
        const user = await authService.getMe();
        setState({
          user,
          accessToken: stored,
          refreshToken: storedRefresh,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch {
        localStorage.clear();
        setState((s) => ({ ...s, isLoading: false }));
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (payload: LoginRequest) => {
    const tokens = await authService.login(payload);
    localStorage.setItem('access_token', tokens.access_token);
    localStorage.setItem('refresh_token', tokens.refresh_token);
    const user = await authService.getMe();
    setState({
      user,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(() => {
    authService.logout();
    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// Re-export helpers for route guard
export { getRoleFromToken, isTokenExpired };
