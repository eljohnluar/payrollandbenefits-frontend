import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Modal, Field, ErrorBox, Notice } from './ui.jsx';

/**
 * Password gate for payslip print / download / email. The user's own account
 * password is re-checked server-side before any PDF leaves the backend.
 *
 * target: { id, label } — id is the payroll item id; label names the payslip.
 */
export default function PayslipGate({ target, onClose }) {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pdfUrl, setPdfUrl] = useState(null);

  useEffect(() => {
    if (target) {
      setPassword('');
      setNotice('');
      setPdfUrl(null);
      setEmail(user?.email || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id]);

  async function unlock() {
    if (pdfUrl) return pdfUrl;
    const url = await api.postObjectUrl(`/api/payslips/pdf/${target.id}`, { password });
    setPdfUrl(url);
    return url;
  }

  async function run(key, fn, okMsg) {
    setBusy(key);
    setError('');
    setNotice('');
    try {
      const result = await fn();
      if (okMsg) setNotice(okMsg(result));
      return result;
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }

  const openPdf = () => run('open', async () => {
    const url = await unlock();
    window.open(url, '_blank', 'noopener');
    return 'Payslip PDF opened — use the viewer’s print button to print it.';
  }, (m) => m);

  const downloadPdf = () => run('download', async () => {
    const url = await unlock();
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip-${target.id}.pdf`;
    a.click();
    return 'Payslip downloaded.';
  }, (m) => m);

  const emailPdf = () => run('email', async () => {
    const res = await api.post(`/api/payslips/${target.id}/email`, { password, email });
    return res.channel === 'webhook'
      ? `Payslip emailed to ${res.to}.`
      : `Payslip released to ${res.to} via the mail outbox (wire MAIL_WEBHOOK_URL for live delivery).`;
  }, (m) => m);

  return (
    <Modal open={!!target} onClose={onClose} title="Verify password to release payslip">
      <p style={{ marginTop: 0, color: 'var(--text-muted)', fontSize: 13 }}>
        {target?.label}
      </p>
      <ErrorBox error={error} />
      <Notice kind="success">{notice}</Notice>
      <Field label="Your account password">
        <input
          className="form-control"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Required for print, download and email"
        />
      </Field>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={!password || !!busy} onClick={openPdf}>
          {busy === 'open' ? 'Unlocking…' : 'View / Print PDF'}
        </button>
        <button className="btn btn-secondary" style={{ flex: 1 }} disabled={!password || !!busy} onClick={downloadPdf}>
          {busy === 'download' ? 'Preparing…' : 'Download'}
        </button>
      </div>
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 12 }}>
        <Field label="Email payslip to">
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="form-control" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            <button className="btn btn-secondary" style={{ flexShrink: 0 }} disabled={!password || !email || !!busy} onClick={emailPdf}>
              {busy === 'email' ? 'Sending…' : 'Send email'}
            </button>
          </div>
        </Field>
      </div>
    </Modal>
  );
}
