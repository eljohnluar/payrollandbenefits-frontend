import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const LockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const EyeIcon = ({ off }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {off ? (
      <>
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </>
    ) : (
      <>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

export default function Login() {
  const { user, login, logoutMessage } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [forgotHint, setForgotHint] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-hero">
          <div className="login-logo"><img src="/logo.jpg" alt="Company logo" /></div>
          <h1>Welcome back</h1>
          <p>Sign in to your workspace account</p>
        </div>
        <form className="login-body" onSubmit={submit}>
          {logoutMessage && <div className="alert">{logoutMessage}</div>}
          {error && <div className="alert error">{error}</div>}
          {forgotHint && <div className="alert success">{forgotHint}</div>}

          <div className="login-field">
            <label htmlFor="login-email">Email address</label>
            <div className="input-wrap">
              <span className="lead-icon"><MailIcon /></span>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="login-field">
            <div className="label-row">
              <label htmlFor="login-password">Password</label>
              <button
                type="button"
                className="forgot-link"
                onClick={() => setForgotHint('Password resets are handled by your HR administrator.')}
              >
                Forgot password?
              </button>
            </div>
            <div className="input-wrap">
              <span className="lead-icon"><LockIcon /></span>
              <input
                id="login-password"
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button type="button" className="eye-btn" aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw((v) => !v)}>
                <EyeIcon off={showPw} />
              </button>
            </div>
          </div>

          <button id="login-submit" type="submit" className="btn-block" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="login-note">
            New accounts are provisioned by your HR administrator. Have a registration code?{' '}
            <Link to="/register">Create an account</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
