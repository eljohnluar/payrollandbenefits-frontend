import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useResource } from '../hooks/useResource.js';
import { api } from '../api/client.js';
import { PageHeader, Card, DataTable, Badge, Notice, Modal, Field, money, statusBadge } from '../components/ui.jsx';
import { shortDate } from '../lib/format.js';

const ALLOWANCE_TYPES = ['Rice', 'Transport', 'Meal', 'Communication', 'Housing', 'Clothing', 'Position Allowance', 'Internet Allowance', 'Medical Allowance'];
const ALLOWANCE_FREQS = ['Monthly', 'Quarterly', 'Annual', 'One-Time'];
const LOAN_TYPES = ['SSS Loan', 'Pag-IBIG Loan', 'Company Loan', 'Salary Advance', 'Car Loan', 'Housing Loan', 'Emergency Loan', 'Equipment Deduction', 'Other Deduction'];
const LOAN_STATUSES = ['Active', 'Paid Off', 'Cancelled'];

const today = () => new Date().toISOString().slice(0, 10);
const num = (v) => (v === '' || v === null || v === undefined ? '' : Number(v));

const EMPTY_ALLOWANCE = { type: 'Rice', amount: '', frequency: 'Monthly', description: '', start_date: '', end_date: '', is_active: true };
const EMPTY_LOAN = { loan_type: 'SSS Loan', principal: '', monthly_deduction: '', balance: '', approved_at: '', status: 'Active' };

export default function Compensation() {
  const [params, setParams] = useSearchParams();
  const id = params.get('employee') || '';

  const { data: employees, reload: reloadEmployees } = useResource('/api/employees');
  const { data: settings } = useResource('/api/settings');

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [notice, setNotice] = useState({ kind: 'info', msg: '' });
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  // Salary modal (existing POST /api/employees/{id}/salary flow, now modal-driven).
  const [salaryOpen, setSalaryOpen] = useState(false);
  const [salaryForm, setSalaryForm] = useState({ basic_salary: '', effective_date: '', reason: '' });

  // Allowance modal — null | { id? } for add / edit.
  const [allowanceModal, setAllowanceModal] = useState(null);
  const [allowanceForm, setAllowanceForm] = useState(EMPTY_ALLOWANCE);

  // Loan modal — null | { id? } for add / edit.
  const [loanModal, setLoanModal] = useState(null);
  const [loanForm, setLoanForm] = useState(EMPTY_LOAN);

  const load = useCallback(async () => {
    if (!id) { setProfile(null); return; }
    setProfileLoading(true);
    try {
      setProfile(await api.get(`/api/employees/${id}/profile`));
    } catch (e) {
      setNotice({ kind: 'error', msg: e.message });
    } finally {
      setProfileLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function selectEmployee(nextId) {
    setSearch('');
    if (nextId) setParams({ employee: nextId });
    else setParams({});
  }

  const setSalary = (k) => (e) => setSalaryForm((f) => ({ ...f, [k]: e.target.value }));
  const setAllowance = (k) => (e) => setAllowanceForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setLoan = (k) => (e) => setLoanForm((f) => ({ ...f, [k]: e.target.value }));

  function openSalaryModal() {
    if (!profile) return;
    setSalaryForm({ basic_salary: profile.basic_salary ?? '', effective_date: today(), reason: '' });
    setSalaryOpen(true);
  }

  async function saveSalary(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/api/employees/${id}/salary`, {
        basic_salary: num(salaryForm.basic_salary),
        effective_date: salaryForm.effective_date,
        reason: salaryForm.reason,
      });
      setNotice({ kind: 'success', msg: 'Basic salary updated.' });
      setSalaryOpen(false);
      load();
      reloadEmployees();
    } catch (err) {
      setNotice({ kind: 'error', msg: err.message });
    } finally {
      setBusy(false);
    }
  }

  function openAddAllowance() {
    setAllowanceForm({ ...EMPTY_ALLOWANCE, start_date: today() });
    setAllowanceModal({});
  }
  function openEditAllowance(a) {
    setAllowanceForm({
      type: a.type || '', amount: a.amount ?? '', frequency: a.frequency || 'Monthly',
      description: a.description || '', start_date: a.start_date || '', end_date: a.end_date || '',
      is_active: !!a.is_active,
    });
    setAllowanceModal({ id: a.id });
  }
  async function saveAllowance(e) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      type: allowanceForm.type, amount: num(allowanceForm.amount), frequency: allowanceForm.frequency,
      description: allowanceForm.description, start_date: allowanceForm.start_date, end_date: allowanceForm.end_date,
    };
    try {
      if (allowanceModal?.id) await api.patch(`/api/allowances/${allowanceModal.id}`, { ...payload, is_active: allowanceForm.is_active });
      else await api.post(`/api/employees/${id}/allowances`, payload);
      setNotice({ kind: 'success', msg: allowanceModal?.id ? 'Allowance updated.' : 'Allowance added.' });
      setAllowanceModal(null);
      load();
    } catch (err) {
      setNotice({ kind: 'error', msg: err.message });
    } finally {
      setBusy(false);
    }
  }
  async function toggleAllowance(a) {
    try {
      await api.patch(`/api/allowances/${a.id}`, { is_active: !a.is_active });
      setNotice({ kind: 'success', msg: `"${a.type}" marked ${a.is_active ? 'inactive' : 'active'}.` });
      load();
    } catch (err) {
      setNotice({ kind: 'error', msg: err.message });
    }
  }

  function openAddLoan() {
    setLoanForm({ ...EMPTY_LOAN, approved_at: today() });
    setLoanModal({});
  }
  function openEditLoan(l) {
    setLoanForm({
      loan_type: l.loan_type || '', principal: l.principal ?? '', monthly_deduction: l.monthly_deduction ?? '',
      balance: l.balance ?? '', approved_at: (l.approved_at || '').slice(0, 10), status: l.status || 'Active',
    });
    setLoanModal({ id: l.id });
  }
  async function saveLoan(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (loanModal?.id) {
        await api.put(`/api/loans/${loanModal.id}`, {
          loan_type: loanForm.loan_type, principal: num(loanForm.principal), monthly_deduction: num(loanForm.monthly_deduction),
          balance: num(loanForm.balance), status: loanForm.status, approved_at: loanForm.approved_at,
        });
        setNotice({ kind: 'success', msg: 'Loan updated.' });
      } else {
        await api.post(`/api/employees/${id}/loans`, {
          loan_type: loanForm.loan_type, principal: num(loanForm.principal), monthly_deduction: num(loanForm.monthly_deduction),
          balance: num(loanForm.balance), approved_at: loanForm.approved_at,
        });
        setNotice({ kind: 'success', msg: 'Loan added.' });
      }
      setLoanModal(null);
      load();
    } catch (err) {
      setNotice({ kind: 'error', msg: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function del(path, ok) {
    if (!window.confirm('Remove this item?')) return;
    try { await api.del(path); setNotice({ kind: 'success', msg: ok }); load(); }
    catch (err) { setNotice({ kind: 'error', msg: err.message }); }
  }

  // Rate math mirrors compensation.php but honours system settings (defaults 22 / 8).
  const workDays = Number(settings?.work_days_per_month) || 22;
  const workHours = Number(settings?.work_hours_per_day) || 8;
  const basic = Number(profile?.basic_salary) || 0;
  const dailyRate = basic / workDays;
  const hourlyRate = dailyRate / workHours;
  const allAllowances = profile?.all_allowances || profile?.allowances || [];
  const activeMonthlyAllowances = allAllowances
    .filter((a) => (a.is_active === true || a.is_active === 1 || a.is_active === 't') && a.frequency === 'Monthly')
    .reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const loans = profile?.loans || [];
  const totalLoansMonthly = loans.reduce((s, l) => s + (Number(l.monthly_deduction) || 0), 0);

  // Directory (no employee selected) — mirrors compensation.php search filter.
  const directoryRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = employees || [];
    if (!q) return list;
    return list.filter((e) =>
      [`${e.first_name} ${e.last_name}`, e.code, e.department, e.position, e.status]
        .some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [employees, search]);

  const directoryColumns = [
    { key: 'code', label: 'Code', render: (r) => <span style={{ fontWeight: 600 }}>{r.code}</span> },
    { key: 'name', label: 'Employee Name', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.first_name} {r.last_name}</span> },
    { key: 'department', label: 'Department' },
    { key: 'position', label: 'Position' },
    { key: 'basic_salary', label: 'Basic Salary', align: 'right', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{money(r.basic_salary)}</span> },
    { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
    { key: 'actions', label: '', align: 'right', render: (r) => (
      <button className="btn btn-primary btn-sm" onClick={() => selectEmployee(r.id)}>Manage Compensation</button>
    ) },
  ];

  const salaryHistoryColumns = [
    { key: 'effective_date', label: 'Effective Date', render: (r) => shortDate(r.effective_date) },
    { key: 'basic_salary', label: 'Basic Salary', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{money(r.basic_salary)}</span> },
    { key: 'reason', label: 'Reason', render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.reason || '—'}</span> },
  ];

  const allowanceColumns = [
    { key: 'type', label: 'Type', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.type}</span> },
    { key: 'amount', label: 'Amount', render: (r) => money(r.amount) },
    { key: 'frequency', label: 'Frequency', render: (r) => <span className="badge badge-muted">{r.frequency}</span> },
    { key: 'status', label: 'Status', render: (r) => (
      <button
        type="button"
        className={`badge ${r.is_active ? 'badge-success' : 'badge-muted'}`}
        style={{ border: 'none', cursor: 'pointer' }}
        title="Click to toggle active status"
        onClick={() => toggleAllowance(r)}
      >
        {r.is_active ? 'Active' : 'Inactive'}
      </button>
    ) },
    { key: 'actions', label: 'Actions', align: 'right', render: (r) => (
      <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
        <button className="btn ghost btn-sm" onClick={() => openEditAllowance(r)}>Edit</button>
        <button className="btn ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => del(`/api/allowances/${r.id}`, 'Allowance removed.')}>Delete</button>
      </span>
    ) },
  ];

  const loanColumns = [
    { key: 'loan_type', label: 'Type', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.loan_type}</span> },
    { key: 'principal', label: 'Total Amt', render: (r) => money(r.principal) },
    { key: 'monthly_deduction', label: 'Monthly', render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 600 }}>-{money(r.monthly_deduction)}</span> },
    { key: 'balance', label: 'Balance', render: (r) => <span style={{ fontWeight: 600 }}>{money(r.balance)}</span> },
    { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
    { key: 'actions', label: 'Actions', align: 'right', render: (r) => (
      <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
        <button className="btn ghost btn-sm" onClick={() => openEditLoan(r)}>Edit</button>
        <button className="btn ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => del(`/api/loans/${r.id}`, 'Loan removed.')}>Delete</button>
      </span>
    ) },
  ];

  const rateRow = (label, value, style) => (
    <div>
      <div className="stat-label">{label}</div>
      <div style={{ fontWeight: 600, color: 'var(--text-main)', ...style }}>{value}</div>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Compensation"
        subtitle="Salary, allowances and loans per employee."
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select className="form-control" style={{ width: 260 }} value={id} onChange={(e) => selectEmployee(e.target.value)}>
              <option value="">-- Select Employee --</option>
              {(employees || []).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.code})</option>
              ))}
            </select>
            {id && <button className="btn btn-secondary btn-sm" onClick={() => selectEmployee('')}>All Employees</button>}
          </div>
        }
      />
      <Notice kind={notice.kind}>{notice.msg}</Notice>

      {!id && (
        <Card
          title={
            <div>
              Employee Compensation Directory
              <div style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginTop: 2 }}>
                Select an employee to manage their salary, allowances, and loan deductions
              </div>
            </div>
          }
          right={<input className="form-control" placeholder="Search employees..." style={{ width: 240 }} value={search} onChange={(e) => setSearch(e.target.value)} />}
        >
          <DataTable columns={directoryColumns} rows={directoryRows} loading={!employees} empty="No employees found." />
        </Card>
      )}

      {id && profileLoading && !profile && <div className="page-loading">Loading compensation…</div>}

      {id && profile && (
        <>
          {/* Selected employee banner — mirrors compensation.php */}
          <div className="card" style={{ background: 'var(--primary-light)', borderColor: 'var(--primary)' }}>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="topbar-avatar" style={{ width: 56, height: 56, fontSize: 22, background: 'var(--primary)', color: '#fff' }}>
                  {(profile.first_name || '').charAt(0)}{(profile.last_name || '').charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                    {profile.first_name} {profile.last_name}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {profile.position} • {profile.department} • <span style={{ fontWeight: 600 }}>{profile.code}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className={`badge ${statusBadge(profile.status)}`} style={{ padding: '6px 12px', fontSize: 12 }}>{profile.status}</span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={openSalaryModal}>Edit Salary</button>
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ alignItems: 'start' }}>
            {/* LEFT: salary structure + history */}
            <div>
              <Card
                title="Salary Structure"
                right={<button type="button" className="btn btn-secondary btn-sm" onClick={openSalaryModal}>Edit Basic Salary</button>}
                body
              >
                <div className="grid-2" style={{ gap: 14, marginBottom: 8 }}>
                  <div>
                    <div className="stat-label">Monthly Basic Salary</div>
                    <div className="stat-value" style={{ fontSize: 22 }}>{money(basic)}</div>
                  </div>
                  <div>
                    <div className="stat-label">Active Monthly Allowances</div>
                    <div className="stat-value" style={{ fontSize: 20, color: 'var(--success)' }}>{money(activeMonthlyAllowances)}</div>
                  </div>
                  {rateRow(`Daily Rate (Est. /${workDays}d)`, money(dailyRate))}
                  {rateRow(`Hourly Rate (Est. /${workHours}h)`, money(hourlyRate))}
                </div>
              </Card>

              <Card title="Salary History">
                <DataTable
                  columns={salaryHistoryColumns}
                  rows={profile.salary_history}
                  loading={profileLoading}
                  empty="No historical changes recorded."
                />
              </Card>
            </div>

            {/* RIGHT: allowances + loans */}
            <div>
              <Card
                title="Allowances"
                right={<button type="button" className="btn btn-primary btn-sm" onClick={openAddAllowance}>+ Add Allowance</button>}
              >
                <DataTable
                  columns={allowanceColumns}
                  rows={allAllowances}
                  loading={profileLoading}
                  empty="No allowances assigned."
                />
              </Card>

              <Card
                title={
                  <div>
                    Loans & Deductions
                    {totalLoansMonthly > 0 && (
                      <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>
                        Monthly deduction total: {money(totalLoansMonthly)}
                      </span>
                    )}
                  </div>
                }
                right={<button type="button" className="btn btn-primary btn-sm" onClick={openAddLoan}>+ Add Loan</button>}
              >
                <DataTable
                  columns={loanColumns}
                  rows={loans}
                  loading={profileLoading}
                  empty="No loans or recurring deductions active."
                />
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Modal: Update Basic Salary (existing POST flow) */}
      <Modal open={salaryOpen} onClose={() => setSalaryOpen(false)} title="Update Monthly Basic Salary">
        <form onSubmit={saveSalary}>
          <div className="form-grid-2">
            <Field label="New Basic Salary (PHP)">
              <input className="form-control" type="number" step="0.01" min="0" value={salaryForm.basic_salary} onChange={setSalary('basic_salary')} required placeholder="0.00" />
            </Field>
            <Field label="Effective Date">
              <input className="form-control" type="date" value={salaryForm.effective_date} onChange={setSalary('effective_date')} required />
            </Field>
          </div>
          <div className="form-group">
            <Field label="Reason for Adjustment">
              <input className="form-control" value={salaryForm.reason} onChange={setSalary('reason')} required placeholder="e.g. Annual merit increase, Promotion, Market adjustment" />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setSalaryOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>Save Salary</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add / Edit Allowance */}
      <Modal open={!!allowanceModal} onClose={() => setAllowanceModal(null)} title={allowanceModal?.id ? 'Edit Allowance' : 'Add Allowance'}>
        <form onSubmit={saveAllowance}>
          <div className="form-group">
            <Field label="Allowance Type">
              {allowanceModal?.id ? (
                <input className="form-control" value={allowanceForm.type} onChange={setAllowance('type')} required />
              ) : (
                <select className="form-control" value={allowanceForm.type} onChange={setAllowance('type')} required>
                  {ALLOWANCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
            </Field>
          </div>
          <div className="form-group">
            <Field label="Amount (PHP)">
              <input className="form-control" type="number" step="0.01" min="0" value={allowanceForm.amount} onChange={setAllowance('amount')} required placeholder="0.00" />
            </Field>
          </div>
          <div className="form-grid-2">
            <Field label="Frequency">
              <select className="form-control" value={allowanceForm.frequency} onChange={setAllowance('frequency')} required>
                {ALLOWANCE_FREQS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Description">
              <input className="form-control" value={allowanceForm.description} onChange={setAllowance('description')} placeholder="Optional note" />
            </Field>
          </div>
          <div className="form-grid-2">
            <Field label="Start Date">
              <input className="form-control" type="date" value={allowanceForm.start_date} onChange={setAllowance('start_date')} />
            </Field>
            <Field label="End Date">
              <input className="form-control" type="date" value={allowanceForm.end_date} onChange={setAllowance('end_date')} />
            </Field>
          </div>
          {allowanceModal?.id && (
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-main)', cursor: 'pointer' }}>
                <input type="checkbox" checked={allowanceForm.is_active} onChange={setAllowance('is_active')} /> Active
              </label>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setAllowanceModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{allowanceModal?.id ? 'Update Allowance' : 'Save Allowance'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add / Edit Loan */}
      <Modal open={!!loanModal} onClose={() => setLoanModal(null)} title={loanModal?.id ? 'Edit Loan / Deduction' : 'Add Loan / Recurring Deduction'}>
        <form onSubmit={saveLoan}>
          <div className="form-group">
            <Field label="Deduction / Loan Type">
              <select className="form-control" value={loanForm.loan_type} onChange={setLoan('loan_type')} required>
                {LOAN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <div className="form-grid-2">
            <Field label="Principal Amount (PHP)">
              <input className="form-control" type="number" step="0.01" min="0" value={loanForm.principal} onChange={setLoan('principal')} required placeholder="0.00" />
            </Field>
            <Field label="Monthly Deduction (PHP)">
              <input className="form-control" type="number" step="0.01" min="0" value={loanForm.monthly_deduction} onChange={setLoan('monthly_deduction')} required placeholder="0.00" />
            </Field>
          </div>
          <div className="form-grid-2">
            <Field label="Remaining Balance (PHP)">
              <input className="form-control" type="number" step="0.01" min="0" value={loanForm.balance} onChange={setLoan('balance')} placeholder="Same as principal if new" />
            </Field>
            <Field label="Approved / Start Date">
              <input className="form-control" type="date" value={loanForm.approved_at} onChange={setLoan('approved_at')} />
            </Field>
          </div>
          {loanModal?.id && (
            <div className="form-group">
              <Field label="Status">
                <select className="form-control" value={loanForm.status} onChange={setLoan('status')}>
                  {LOAN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setLoanModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{loanModal?.id ? 'Update Loan' : 'Save Loan'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
