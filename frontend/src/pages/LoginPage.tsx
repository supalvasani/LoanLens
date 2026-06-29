// ──────────────────────────────────────────────────────────────────────────────
// LoanLens — Login Page
// Glassmorphism card, email + password, role-based redirect
// ──────────────────────────────────────────────────────────────────────────────

import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { roleRedirect } from '../utils/routeGuard';
import type { Role } from '../types/auth';

interface QuickCred {
  role: Role;
  email: string;
  password: string;
  label: string;
}

const QUICK_CREDS: QuickCred[] = [
  { role: 'admin',     email: 'admin@loanlens.in',     password: 'Admin@123',     label: 'Super Admin' },
  { role: 'manager',   email: 'manager@loanlens.in',   password: 'Manager@123',   label: 'Bank Manager' },
  { role: 'analyst',   email: 'analyst@loanlens.in',   password: 'Analyst@123',   label: 'Credit Analyst' },
  { role: 'applicant', email: 'applicant@loanlens.in', password: 'Applicant@123', label: 'Applicant' },
];

const badgeClass: Record<Role, string> = {
  admin:     'badge badge-admin',
  manager:   'badge badge-manager',
  analyst:   'badge badge-analyst',
  applicant: 'badge badge-applicant',
};

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);

  // If already authenticated, redirect
  if (isAuthenticated && user) {
    navigate(roleRedirect[user.role] ?? '/login', { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    setIsLoading(true);
    try {
      await login({ email: email.toLowerCase().trim(), password });
      // Redirect happens via AuthContext — user state update triggers the guard above
      // But we also navigate explicitly after login resolves
    } catch (err: unknown) {
      const status = (err as { response?: { status: number } })?.response?.status;
      if (status === 401) {
        setError('Invalid email or password. Please try again.');
      } else if (status === 429) {
        setError('Too many attempts. Please wait a minute and try again.');
      } else {
        setError('Something went wrong. Please check if the backend is running.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // After login, the AuthContext state update causes a re-render which triggers
  // the redirect at the top. But add an explicit effect here too.
  const fillCred = (cred: QuickCred) => {
    setEmail(cred.email);
    setPassword(cred.password);
    setError(null);
  };

  return (
    <div className="login-page">
      {/* Background glows */}
      <div className="login-bg-glow top-left" />
      <div className="login-bg-glow bottom-right" />

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">🏦</div>
          <div>
            <div className="login-logo-title">LoanLens</div>
            <div className="login-logo-subtitle">
              Credit Intelligence Platform
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="alert alert-error mb-4" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </span>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="you@loanlens.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                disabled={isLoading}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isLoading}
                required
              />
              <button
                type="button"
                className="input-suffix"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={isLoading}
            style={{ marginTop: 4 }}
          >
            {isLoading ? (
              <>
                <span className="spinner" />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Register link */}
        <div className="login-footer">
          New applicant?{' '}
          <Link to="/register">Create an account</Link>
        </div>

        {/* Quick-creds (dev helper) */}
        <div className="quick-creds" style={{ marginTop: 20 }}>
          <div className="quick-creds-header">🔑 Demo Credentials (click to fill)</div>
          {QUICK_CREDS.map((cred) => (
            <button
              key={cred.role}
              type="button"
              className="quick-cred-item"
              onClick={() => fillCred(cred)}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--color-border-subtle)' }}
            >
              <div className="flex items-center gap-2">
                <span className={badgeClass[cred.role]}>{cred.label}</span>
                <span className="cred-email" style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>{cred.email}</span>
              </div>
              <span className="cred-pass" style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{cred.password}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
