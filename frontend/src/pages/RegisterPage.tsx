import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import { roleRedirect } from '../utils/routeGuard';

export default function RegisterPage() {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);

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
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    try {
      await authService.register({ name: name.trim(), email: email.toLowerCase().trim(), password });
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err: unknown) {
      const status = (err as { response?: { status: number } })?.response?.status;
      if (status === 409) setError('An account with this email already exists.');
      else if (status === 422) setError('Password must be at least 12 characters.');
      else if (status === 429) setError('Too many registrations. Please wait a moment.');
      else setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const strength = (() => {
    const len = password.length;
    if (len === 0) return null;
    if (len < 8)  return { label: 'Weak',   pct: 25,  color: 'var(--bad)' };
    if (len < 12) return { label: 'Fair',   pct: 55,  color: 'var(--warn)' };
    const hasUpper = /[A-Z]/.test(password);
    const hasSym   = /[^a-zA-Z0-9]/.test(password);
    if (hasUpper && hasSym) return { label: 'Strong', pct: 100, color: 'var(--ok)' };
    return { label: 'Good', pct: 75, color: 'var(--ink)' };
  })();

  return (
    <div className="login-wrap">
      <div className="login-box" style={{ maxWidth: 420 }}>

        <div className="login-head">
          <div className="login-wordmark">LoanLens</div>
          <div className="login-tagline">Create your applicant account</div>
        </div>

        {success && (
          <div className="alert alert-success" style={{ marginBottom: 18 }}>
            <span>✓</span>
            <span>Account created! Redirecting to sign-in…</span>
          </div>
        )}
        {error && (
          <div className="alert alert-error" style={{ marginBottom: 18 }} role="alert">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Name */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-name">Full Name</label>
            <div className="input-wrap">
              <span className="input-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <input id="reg-name" type="text" className="form-input" placeholder="Amit Kumar"
                value={name} onChange={(e) => setName(e.target.value)}
                autoFocus disabled={loading || success} required />
            </div>
          </div>

          {/* Email */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email</label>
            <div className="input-wrap">
              <span className="input-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
              </span>
              <input id="reg-email" type="email" className="form-input" placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="email" disabled={loading || success} required />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <div className="input-wrap">
              <span className="input-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input id="reg-password" type={showPwd ? 'text' : 'password'} className="form-input"
                placeholder="Min. 12 characters" value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password" disabled={loading || success} required />
              <button type="button" className="input-toggle" onClick={() => setShowPwd(v => !v)} tabIndex={-1}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {showPwd
                    ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
                    : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                  }
                </svg>
              </button>
            </div>
            {strength && (
              <div style={{ marginTop: 6 }}>
                <div className="progress-track">
                  <div className="progress-fill"
                    style={{ width: `${strength.pct}%`, background: strength.color, transition: 'width .3s, background .3s' }} />
                </div>
                <div style={{ fontSize: 11, color: strength.color, marginTop: 3, fontWeight: 600 }}>
                  {strength.label}
                </div>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div className="form-group">
            <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
            <div className="input-wrap">
              <span className="input-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input id="reg-confirm" type={showPwd ? 'text' : 'password'} className="form-input"
                placeholder="Re-enter password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password" disabled={loading || success} required
                style={confirm.length > 0 && confirm !== password
                  ? { borderColor: 'var(--bad)' } : {}} />
            </div>
            {confirm.length > 0 && confirm !== password && (
              <div style={{ fontSize: 12, color: 'var(--bad)', marginTop: 4 }}>Passwords do not match</div>
            )}
          </div>

          <button id="register-submit" type="submit" className="btn btn-primary btn-full btn-lg"
            disabled={loading || success} style={{ marginTop: 6 }}>
            {loading ? <><span className="spinner" /> Creating account…</> : 'Create Account'}
          </button>
        </form>

        <div className="login-foot">
          Already have an account?{' '}
          <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
