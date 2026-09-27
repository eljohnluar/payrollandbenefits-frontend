import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResource } from '../hooks/useResource.js';
import { api } from '../api/client.js';
import { PageHeader, Card, Notice, money } from '../components/ui.jsx';

const TODAY = new Date().toISOString().slice(0, 10);
const EMPTY_FORM = { employee_id: '', description: '', category: '', amount: '', claim_date: '' };

const parseFlags = (raw) => {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [String(raw)];
  }
};

export default function LogClaim() {
  const navigate = useNavigate();
  const { data: employees } = useResource('/api/employees');
  const { data: categories } = useResource('/api/claims/categories');
  const [form, setForm] = useState(EMPTY_FORM);
  const [receipt, setReceipt] = useState(null); // { base64, mime, name }
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ kind: 'info', msg: '' });
  const [submitted, setSubmitted] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const cat = (categories || []).find((c) => c.name === form.category || c.id === form.category);

  async function onReceipt(e) {
    const file = e.target.files?.[0];
    if (!file) { setReceipt(null); return; }
    if (file.size > 4 * 1024 * 1024) {
      setNotice({ kind: 'error', msg: 'Receipt must be 4MB or smaller.' });
      e.target.value = '';
      return;
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read the receipt file.'));
      reader.readAsDataURL(file);
    }).catch(() => null);
    if (!dataUrl) {
      setNotice({ kind: 'error', msg: 'Could not read the receipt file.' });
      return;
    }
    setReceipt({ base64: dataUrl.split(',')[1], mime: file.type || 'image/jpeg', name: file.name });
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setNotice({ kind: 'info', msg: '' });
    try {
      const created = await api.post('/api/claims/submit', {
        ...form,
        receipt_base64: receipt?.base64,
        receipt_mime: receipt?.mime,
      });
      setSubmitted(created?.data ?? created);
      setForm((f) => ({ ...EMPTY_FORM, claim_date: f.claim_date }));
      setReceipt(null);
    } catch (err) {
      setNotice({ kind: 'error', msg: err.message });
    } finally {
      setBusy(false);
    }
  }

  function resetAnother() {
    setSubmitted(null);
    setForm((f) => ({ ...f, description: '', amount: '', category: '' }));
  }

  return (
    <>
      <PageHeader title="Log Employee Claim" subtitle="Submit a receipt for HR's manual review." />
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {submitted ? (
          <Card body>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>Claim submitted for review</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {submitted.claim_number ? `Claim ${submitted.claim_number} is pending HR approval.` : 'Your claim is pending HR approval.'}
              </p>
              {submitted.ocr_status && submitted.ocr_status !== 'Passed' && (
                <div className="alert info" style={{ textAlign: 'left', marginTop: 16 }}>
                  <strong>Receipt check: {submitted.ocr_status}.</strong>{' '}
                  {parseFlags(submitted.ocr_flags).map((f) => <div key={f} style={{ fontSize: 12 }}>{f}</div>)}
                </div>
              )}
              {submitted.ocr_status === 'Passed' && (
                <div className="alert success" style={{ textAlign: 'left', marginTop: 16 }}>
                  Receipt verified automatically — merchant “{submitted.ocr_merchant}”, total {money(submitted.ocr_amount)}.
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={resetAnother}>
                  Log Another Claim
                </button>
                <button type="button" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate('/claims')}>
                  View Claim
                </button>
              </div>
            </div>
          </Card>
        ) : (
          <Card body>
            <Notice kind={notice.kind}>{notice.msg}</Notice>
            <form onSubmit={submit}>
              <div className="form-group">
                <div className="field">
                  <label htmlFor="lc-employee">Employee</label>
                  <select id="lc-employee" className="form-control" value={form.employee_id} onChange={set('employee_id')} required>
                    <option value="">Select employee</option>
                    {(employees || []).map((emp) => {
                      const name = [emp.first_name, emp.middle_name, emp.last_name].filter(Boolean).join(' ');
                      return <option key={emp.id} value={emp.id}>{name} ({[emp.code, emp.department].filter(Boolean).join(' · ')})</option>;
                    })}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <div className="field">
                  <label htmlFor="lc-purpose">Business Purpose</label>
                  <textarea id="lc-purpose" className="form-control" rows={3} value={form.description} onChange={set('description')} required
                    placeholder="Describe the business expense and its purpose." />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="field">
                  <label htmlFor="lc-category">Category</label>
                  <select id="lc-category" className="form-control" value={form.category} onChange={set('category')} required>
                    <option value="">Select category</option>
                    {(categories || []).map((c) => <option key={c.id} value={c.name}>{c.name} — max {money(c.max_amount)}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="lc-amount">Amount (PHP)</label>
                  <input id="lc-amount" type="number" className="form-control" min="0.01" step="0.01" value={form.amount}
                    onChange={set('amount')} required placeholder={cat ? `Limit ${money(cat.max_amount)}` : ''} />
                </div>
              </div>
              <div className="form-grid-2">
                <div className="field">
                  <label htmlFor="lc-date">Receipt Date</label>
                  <input id="lc-date" type="date" className="form-control" max={TODAY} value={form.claim_date} onChange={set('claim_date')} required />
                </div>
                <div className="field">
                  <label htmlFor="lc-receipt">Receipt</label>
                  <input id="lc-receipt" type="file" className="form-control" accept=".jpg,.jpeg,.png,.webp,.application/pdf" onChange={onReceipt} />
                  <small style={{ color: 'var(--text-muted)' }}>
                    {receipt ? `Attached: ${receipt.name} — verified by OCR on submit` : 'JPG, PNG, WEBP or PDF up to 4MB — read by Google Vision OCR'}
                  </small>
                </div>
              </div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
                  {busy ? 'Submitting…' : 'Submit Claim for Review'}
                </button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
