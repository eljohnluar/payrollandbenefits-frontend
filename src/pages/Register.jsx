import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';

const ICONS = {
  mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
  user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>,
  key: <><circle cx="7.5" cy="15.5" r="5.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" /></>,
};

const Icon = ({ name }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {ICONS[name]}
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

export default function Register() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [registrationCode, setRegistrationCode] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api.register({ email, username, password, registration_code: registrationCode });
      setSuccess('Registration successful. You can now login with your email.');
      setPassword('');
      setRegistrationCode('');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
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
          <h1>Create your account</h1>
          <p>Join your workspace with an HR registration code</p>
        </div>
        <form className="login-body" onSubmit={submit}>
          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">{success}</div>}

          <div className="login-field">
            <label htmlFor="email">Email address</label>
            <div className="input-wrap">
              <span className="lead-icon"><Icon name="mail" /></span>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="username" required />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="username">Display name</label>
            <div className="input-wrap">
              <span className="lead-icon"><Icon name="user" /></span>
              <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Juan Dela Cruz" autoComplete="name" required />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="password">Password</label>
            <div className="input-wrap">
              <span className="lead-icon"><Icon name="lock" /></span>
              <input id="password" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
              <button type="button" className="eye-btn" aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw((v) => !v)}>
                <EyeIcon off={showPw} />
              </button>
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="registration_code">Registration code</label>
            <div className="input-wrap">
              <span className="lead-icon"><Icon name="key" /></span>
              <input id="registration_code" type="text" value={registrationCode} onChange={(e) => setRegistrationCode(e.target.value)} placeholder="Provided by HR" required />
            </div>
          </div>

          <button type="submit" className="btn-block" disabled={busy}>
            {busy ? 'Creating account…' : 'Register'}
          </button>

          <div className="login-note">
            New accounts are created with the HR role. Already registered?{' '}
            <Link to="/login">Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
