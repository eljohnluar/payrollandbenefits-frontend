import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { passwordProblem } from '../lib/password.js';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthContext.jsx';

/**
 * Landing page for the Supabase "reset password" recovery email. The link
 * carries a code that yields a recovery session; we set the new Supabase
 * password, mirror it into the app (payslip gate + password login), then sign
 * the user straight in.
 */
export default function AuthReset() {
  const { user, adoptSession } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('working'); // working | ready | error
  const [message, setMessage] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setStatus('error');
      setMessage('Supabase is not configured for this deployment.');
      return undefined;
    }
    let cancelled = false;

    async function resolve(s) {
      if (cancelled || !s?.access_token || handled.current) return;
      handled.current = true;
      setSession(s);
      setStatus('ready');
    }

    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s?.access_token) resolve(s);
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => resolve(s));
    const giveUp = setTimeout(() => {
      if (handled.current) return;
      setStatus('error');
      setMessage('This reset link is invalid or already used. Request a new one from the sign-in page.');
    }, 8000);
    return () => {
      cancelled = true;
      clearTimeout(giveUp);
      data.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (user) return <Navigate to="/" replace />;

  async function submit(event) {
    event.preventDefault();
    if (!session) return;
    const issue = passwordProblem(pw1);
    if (issue) {
      setStatus('error');
      setMessage(issue);
      return;
    }
    if (pw1 !== pw2) {
      setStatus('error');
      setMessage('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const { error: sbError } = await supabase.auth.updateUser({ password: pw1 });
      if (sbError) throw new Error(sbError.message);
      await api.resetPassword(session.access_token, pw1);
      const { status: s, payload } = await api.supabaseLogin(session.access_token);
      if (s !== 200) throw new Error(payload?.error || 'Sign-in after reset failed.');
      adoptSession(payload);
      navigate('/', { replace: true });
    } catch (e) {
      setStatus('error');
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-hero">
          <div className="login-logo"><img src="/logo.jpg" alt="Company logo" /></div>
          <h1>Choose a new password</h1>
          <p>Your identity was verified by the reset link we emailed you.</p>
        </div>
        <form className="login-body" onSubmit={submit}>
          {status === 'error' && <div className="alert error">{message}</div>}
          {status === 'working' && <div className="alert">Verifying your reset link…</div>}
          {status === 'ready' && (
            <>
              <div className="login-field">
                <label htmlFor="reset-pw1">New password</label>
                <input
                  id="reset-pw1"
                  type="password"
                  value={pw1}
                  onChange={(e) => setPw1(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="login-field">
                <label htmlFor="reset-pw2">Confirm new password</label>
                <input
                  id="reset-pw2"
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <button type="submit" className="btn-block" disabled={busy}>
                {busy ? 'Saving…' : 'Reset password & sign in'}
              </button>
              <div className="login-note">
                This also updates the password used for payslip print/download.{' '}
                <Link to="/login">Back to sign in</Link>
              </div>
            </>
          )}
          {status === 'error' && (
            <div className="login-note">
              <Link to="/login" style={{ fontWeight: 600, color: '#7c3aed' }}>Back to sign in</Link>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
