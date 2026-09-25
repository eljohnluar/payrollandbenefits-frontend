import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResource } from '../hooks/useResource.js';
import { api } from '../api/client.js';
import { PageHeader, Card, Notice, money } from '../components/ui.jsx';

const TODAY = new Date().toISOString().slice(0, 10);
const EMPTY_FORM = { employee_id: '', description: '', category: '', amount: '', claim_date: '' };

export default function LogClaim() {
  const navigate = useNavigate();
  const { data: employees } = useResource('/api/employees');
  const { data: categories } = useResource('/api/claims/categories');
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ kind: 'info', msg: '' });
  const [submitted, setSubmitted] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const cat = (categories || []).find((c) => c.name === form.category || c.id === form.category);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setNotice({ kind: 'info', msg: '' });
    try {
      const created = await api.post('/api/claims/submit', { ...form, category: form.category });
      setSubmitted(created?.data ?? created);
      setForm((f) => ({ ...EMPTY_FORM, claim_date: f.claim_date }));
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
                  <input id="lc-receipt" type="file" className="form-control" accept=".jpg,.jpeg,.png,.webp,.application/pdf" />
                  <small style={{ color: 'var(--text-muted)' }}>JPG, PNG, WEBP or PDF up to 10MB</small>
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
