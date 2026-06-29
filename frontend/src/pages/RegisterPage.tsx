// ──────────────────────────────────────────────────────────────────────────────
// LoanLens — Register Page (Applicant self-registration only)
// ──────────────────────────────────────────────────────────────────────────────

import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { roleRedirect } from '../utils/routeGuard';

export default function RegisterPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [name, setName]             = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState(false);

  // If already logged in → redirect home
  if (isAuthenticated && user) {
    navigate(roleRedirect[user.role] ?? '/', { replace: true });
    return null;
  }

  const validate = (): string | null => {
    if (!name.trim() || name.trim().length < 2) return 'Name must be at least 2 characters.';
    if (!email.trim()) return 'Email is required.';
    if (password.length < 12) return 'Password must be at least 12 characters.';
    if (password !== confirm) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    try {
      await authService.register({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
      });
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err: unknown) {
      const status = (err as { response?: { status: number; data?: { detail?: string } } })?.response;
      if (status?.status === 409) {
        setError('An account with this email already exists.');
      } else if (status?.status === 422) {
        setError('Please check your input — password must be at least 12 characters.');
      } else if (status?.status === 429) {
        setError('Too many registrations. Please wait a minute.');
      } else {
        setError('Registration failed. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = (): { label: string; color: string; width: string } => {
    const len = password.length;
    if (len === 0) return { label: '', color: 'transparent', width: '0%' };
    if (len < 8)   return { label: 'Weak',   color: 'var(--color-danger)',  width: '25%' };
    if (len < 12)  return { label: 'Fair',   color: 'var(--color-warning)', width: '50%' };
    const hasUpper = /[A-Z]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    if (hasUpper && hasSpecial) return { label: 'Strong', color: 'var(--color-success)', width: '100%' };
    return { label: 'Good', color: '#38bdf8', width: '75%' };
  };
  const strength = passwordStrength();

  return (
    <div className="login-page">
      <div className="login-bg-glow top-left" />
      <div className="login-bg-glow bottom-right" />

      <div className="login-card" style={{ maxWidth: 460 }}>
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">🏦</div>
          <div>
            <div className="login-logo-title">Create Account</div>
            <div className="login-logo-subtitle">Applicant self-registration</div>
          </div>
        </div>

        {/* Success state */}
        {success && (
          <div className="alert alert-success mb-4">
            <span>✅</span>
            <span>Account created! Redirecting to login…</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="alert alert-error mb-4" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          {/* Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-name">Full Name</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                id="reg-name"
                type="text"
                className="form-input"
                placeholder="Amit Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                disabled={isLoading || success}
                required
              />
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </span>
              <input
                id="reg-email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={isLoading || success}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <div className="input-wrapper">
              <span className="input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder="Min. 12 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={isLoading || success}
                required
              />
              <button
                type="button"
                className="input-suffix"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {/* Strength bar */}
            {password.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <div className="progress-bar" style={{ height: 4 }}>
                  <div
                    className="progress-fill"
                    style={{ width: strength.width, background: strength.color, transition: 'width 0.3s ease, background 0.3s ease' }}
                  />
                </div>
                <div style={{ fontSize: 11, color: strength.color, marginTop: 3, fontWeight: 600 }}>
                  {strength.label}
                </div>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
            <div className="input-wrapper">
              <span className="input-icon">🔒</span>
              <input
                id="reg-confirm"
                type={showPassword ? 'text' : 'password'}
                className={`form-input ${confirm.length > 0 && confirm !== password ? 'input-error' : ''}`}
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                disabled={isLoading || success}
                required
              />
            </div>
            {confirm.length > 0 && confirm !== password && (
              <div className="form-error">Passwords do not match</div>
            )}
          </div>

          <button
            id="register-submit"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={isLoading || success}
            style={{ marginTop: 4 }}
          >
            {isLoading ? (
              <>
                <span className="spinner" />
                Creating account…
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="login-footer" style={{ marginTop: 20 }}>
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
