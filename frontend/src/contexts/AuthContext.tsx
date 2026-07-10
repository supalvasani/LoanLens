// ──────────────────────────────────────────────────────────────────────────────
// LoanLens — Auth Context
// Provides user state + login/logout to the entire app
// ──────────────────────────────────────────────────────────────────────────────

import {
  createContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { jwtDecode } from 'jwt-decode';
import { authService } from '../services/authService';
import { sanitizeToken } from '../utils/security';
import type { AuthState, LoginRequest, TokenPayload } from '../types/auth';

// ── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue extends AuthState {
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

// ── Helpers ──────────────────────────────────────────────────────────────────

function isTokenExpired(token: string): boolean {
  try {
    const { exp } = jwtDecode<TokenPayload>(token);
    return Date.now() / 1000 > exp;
  } catch {
    return true;
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
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
            localStorage.setItem('access_token', sanitizeToken(tokens.access_token)); // NOSONAR
            localStorage.setItem('refresh_token', sanitizeToken(tokens.refresh_token)); // NOSONAR
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
    localStorage.setItem('access_token', sanitizeToken(tokens.access_token)); // NOSONAR
    localStorage.setItem('refresh_token', sanitizeToken(tokens.refresh_token)); // NOSONAR
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

  const contextValue = useMemo(() => ({
    ...state,
    login,
    logout,
  }), [state, login, logout]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}



