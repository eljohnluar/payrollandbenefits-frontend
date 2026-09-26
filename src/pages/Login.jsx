import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { supabase } from '../lib/supabase.js';
import { GoogleG } from '../components/GoogleIcon.jsx';
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
  const { user, login, logoutMessage, adoptSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [forgotHint, setForgotHint] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [otpStage, setOtpStage] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [pending, setPending] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpNote, setOtpNote] = useState('');
  const [forgotStage, setForgotStage] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotNote, setForgotNote] = useState('');
  const [company, setCompany] = useState('');

  useEffect(() => {
    api.get('/api/branding').then((b) => setCompany(b?.company_name || '')).catch(() => {});
  }, []);

  if (user) return <Navigate to="/" replace />;

  async function sendResetLink(event) {
    event.preventDefault();
    if (!supabase) return;
    if (!email) {
      setError('Enter your email address first, then request the reset link.');
      return;
    }
    setForgotBusy(true);
    setError('');
    setForgotNote('');
    try {
      const { error: sbError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (sbError) throw new Error(sbError.message);
      setForgotNote(`If ${email} is registered, a password-reset link is on its way to your Gmail inbox.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setForgotBusy(false);
    }
  }

  async function loginWithGoogle() {
    setGoogleBusy(true);
    setError('');
    const { error: sbError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/confirm`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (sbError) {
      setGoogleBusy(false);
      setError(
        sbError.message.toLowerCase().includes('not configured')
          ? 'Google sign-in is not enabled on the server yet — ask the administrator to configure the Google provider in Supabase.'
          : sbError.message
      );
    }
  }

  async function sendLoginCode(loginEmail) {
    const { error: sbError } = await supabase.auth.signInWithOtp({
      email: loginEmail,
      options: { shouldCreateUser: false },
    });
    if (sbError) {
      throw new Error(
        sbError.message.toLowerCase().includes('signups not allowed')
          ? 'This account is not enrolled for email codes yet — ask the administrator to sync it into Supabase.'
          : sbError.message
      );
    }
    setOtpNote(`We emailed a 6-digit code to ${loginEmail}. It expires in a few minutes.`);
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await login(email, password);
      if (result?.otp_required) {
        if (!supabase) {
          setError('Email-code service is not configured on this deployment.');
          return;
        }
        setOtpEmail(result.email);
        setPending(result.pending);
        setOtpStage(true);
        await sendLoginCode(result.email);
      }
      // No otp_required and no supabase client: legacy direct session.
      else navigate('/', { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifyLoginCode(event) {
    event.preventDefault();
    setOtpBusy(true);
    setError('');
    try {
      const { data, error: sbError } = await supabase.auth.verifyOtp({ email: otpEmail, token: otpCode, type: 'email' });
      if (sbError) throw new Error(sbError.message);
      const { status, payload } = await api.supabaseLogin(data.session.access_token, { pending });
      if (status === 200) {
        adoptSession(payload);
        navigate('/', { replace: true });
        return;
      }
      setError(payload?.error || 'Verification failed.');
      if (status === 401) exitOtpStage();
    } catch (e) {
      setError(e.message);
    } finally {
      setOtpBusy(false);
    }
  }

  function exitOtpStage() {
    setOtpStage(false);
    setPending('');
    setOtpCode('');
    setOtpNote('');
  }

  async function resendCode() {
    setError('');
    try {
      await sendLoginCode(otpEmail);
    } catch (e) {
      setError(e.message);
    }
  }

  if (otpStage) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-hero">
            <div className="login-logo"><img src="/logo.jpg" alt="Company logo" /></div>
            <h1>Check your email</h1>
            <p>Enter the 6-digit code sent to {otpEmail}</p>
          </div>
          <form className="login-body" onSubmit={verifyLoginCode}>
            {error && <div className="alert error">{error}</div>}
            {otpNote && <div className="alert success">{otpNote}</div>}
            <div className="login-field">
              <label htmlFor="login-otp">Verification code</label>
              <input
                id="login-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                required
              />
            </div>
            <button type="submit" className="btn-block" disabled={otpBusy || otpCode.length !== 6}>
              {otpBusy ? 'Verifying…' : 'Verify & sign in'}
            </button>
            <div className="otp-actions">
              <button type="button" className="forgot-link" onClick={resendCode}>Resend code</button>
              <button type="button" className="forgot-link" onClick={exitOtpStage}>Use a different account</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-hero">
          <div className="login-logo"><img src="/logo.jpg" alt="Company logo" /></div>
          {company && <div className="brand-company">{company}</div>}
          <h1>Payroll Management System</h1>
          <p>Welcome back — sign in to your workspace account</p>
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
                onClick={() => {
                  setError('');
                  setForgotNote('');
                  if (supabase) setForgotStage((v) => !v);
                  else setForgotHint('Password resets are handled by your HR administrator.');
                }}
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

          {forgotStage && supabase && !otpStage && (
            <div className="otp-block">
              <div className="otp-divider"><span>reset via Gmail</span></div>
              {forgotNote && <div className="alert success">{forgotNote}</div>}
              <button type="button" className="btn-block secondary" onClick={sendResetLink} disabled={forgotBusy}>
                {forgotBusy ? 'Sending link…' : 'Email me a password-reset link'}
              </button>
              <button type="button" className="forgot-link otp-cancel" onClick={() => { setForgotStage(false); setForgotNote(''); }}>
                Back to sign in
              </button>
            </div>
          )}

          {supabase && (
            <div className="otp-block">
              <div className="otp-divider"><span>or</span></div>
              <button type="button" className="btn-block secondary google-btn" onClick={loginWithGoogle} disabled={busy || googleBusy}>
                <GoogleG /> {googleBusy ? 'Opening Google…' : 'Sign in with Gmail'}
              </button>
              <p className="google-note">Gmail sign-in skips the email code.</p>
            </div>
          )}

          <div className="login-note">
            New accounts are provisioned by your HR administrator. Have a registration code?{' '}
            <Link to="/register">Create an account</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
