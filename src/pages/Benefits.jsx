import { useMemo, useState } from 'react';
import { useResource } from '../hooks/useResource.js';
import { api, qs } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageHeader, StatsGrid, Stat, Card, DataTable, Field, Badge, Modal, Notice, money } from '../components/ui.jsx';
import { shortDate } from '../lib/format.js';

const mutedSmall = { fontSize: 11, color: 'var(--text-muted)' };
const today = () => new Date().toISOString().slice(0, 10);
const LEAVE_TYPES = ['Vacation Leave', 'Sick Leave', 'Service Incentive Leave'];

// Share splits: enrollment rows store employee_share / employer_share percentages;
// fall back to 100 - employer_share like my_benefits.php does.
const eePct = (r) => (r.employee_share != null ? Number(r.employee_share) : 100 - Number(r.employer_share || 0));
const erPct = (r) => Number(r.employer_share || 0);

export default function Benefits() {
  const { user } = useAuth();
  const canDecideLeave = user?.role === 'Admin' || user?.role === 'HR';
  const year = String(new Date().getFullYear());
  const { data: employees } = useResource('/api/employees');
  const { data: plans } = useResource('/api/benefit-plans');
  const { data: balances, loading: silLoading } = useResource(`/api/leave/balances${qs({ year })}`);
  const { data: leaveRequests, reload: reloadRequests } = useResource(`/api/leave/requests${qs({ year })}`);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    employee_id: '', leave_type: 'Service Incentive Leave', start_date: today(), end_date: today(), is_paid: true,
  });
  const [empFilter, setEmpFilter] = useState('');
  const { data: enrollments, loading, error, reload } = useResource(
    '/api/benefits/enrollments',
    empFilter ? { employee_id: empFilter } : undefined
  );
  const [enrolling, setEnrolling] = useState(false);
  const [form, setForm] = useState({ employee_id: '', plan_id: '', effective_date: today(), dependents: 0 });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ kind: 'info', msg: '' });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const selectedPlan = useMemo(
    () => (plans || []).find((p) => String(p.id) === String(form.plan_id)) || null,
    [plans, form.plan_id]
  );
  const previewEePct = selectedPlan ? (selectedPlan.employee_share ?? 100 - selectedPlan.employer_share) : 0;
  const previewErPct = selectedPlan ? selectedPlan.employer_share : 0;
  const previewPremium = selectedPlan ? Number(selectedPlan.monthly_premium || 0) : 0;

  // employee_id -> department, so the table can show the muted second line like the PHP page.
  const deptById = useMemo(() => {
    const map = {};
    (employees || []).forEach((e) => { map[String(e.id)] = e.department; });
    return map;
  }, [employees]);

  const stats = useMemo(() => {
    const list = enrollments || [];
    const active = list.filter((r) => r.status === 'Active' || r.status === 'Enrolled');
    return {
      total: list.length,
      activePlans: new Set(active.map((r) => r.plan_id)).size,
      dependents: active.reduce((sum, r) => sum + Number(r.dependents || 0), 0),
      premium: active.reduce((sum, r) => sum + Number(r.monthly_premium || 0), 0),
    };
  }, [enrollments]);

  function openEnroll() {
    setForm({ employee_id: '', plan_id: '', effective_date: today(), dependents: 0 });
    setEnrolling(true);
  }
  async function enroll(e) {
    e.preventDefault();
    setBusy(true); setNotice({ kind: 'info', msg: '' });
    try {
      await api.post('/api/benefits/enroll', {
        employee_id: form.employee_id,
        plan_id: Number(form.plan_id),
        dependents: Number(form.dependents || 0),
        effective_date: form.effective_date,
      });
      setNotice({ kind: 'success', msg: 'Employee enrolled.' });
      setEnrolling(false);
      reload();
    } catch (err) { setNotice({ kind: 'error', msg: err.message }); }
    finally { setBusy(false); }
  }

  async function cancel(id) {
    if (!window.confirm('Cancel this enrollment?')) return;
    try { await api.post(`/api/benefits/enrollments/${id}/cancel`); reload(); }
    catch (err) { setNotice({ kind: 'error', msg: err.message }); }
  }

  async function remove(id) {
    if (!window.confirm('Delete this enrollment? It will be moved to the Archive.')) return;
    try { await api.del(`/api/benefits/enrollments/${id}`); setNotice({ kind: 'success', msg: 'Enrollment moved to the Archive.' }); reload(); }
    catch (err) { setNotice({ kind: 'error', msg: err.message }); }
  }

  async function fileLeave(e) {
    e.preventDefault();
    setBusy(true);
    setNotice({ kind: 'info', msg: '' });
    try {
      await api.post('/api/leave/requests', leaveForm);
      setNotice({ kind: 'success', msg: 'Leave request filed for HR approval.' });
      setLeaveOpen(false);
      reloadRequests();
    } catch (err) {
      setNotice({ kind: 'error', msg: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function decideLeave(id, status) {
    try {
      await api.post(`/api/leave/requests/${id}/decision`, { status });
      setNotice({ kind: 'success', msg: `Leave request ${status.toLowerCase()}.` });
      reloadRequests();
    } catch (err) {
      setNotice({ kind: 'error', msg: err.message });
    }
  }

  const columns = [
    { key: 'employee_name', label: 'Employee', render: (r) => (
      <div>
        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.employee_name}</div>
        <div style={mutedSmall}>{deptById[String(r.employee_id)] || ''}</div>
      </div>
    ) },
    { key: 'plan_name', label: 'Plan & Provider', render: (r) => (
      <div>
        <div style={{ fontWeight: 600 }}>{r.plan_name}</div>
        <div style={mutedSmall}>{r.provider}</div>
      </div>
    ) },
    { key: 'monthly_premium', label: 'Monthly Premium', align: 'right', render: (r) => (
      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{money(r.monthly_premium)}</span>
    ) },
    { key: 'employee_share', label: 'EE Share', align: 'right', render: (r) => (
      <div>
        <div style={{ color: 'var(--danger)', fontWeight: 600 }}>{money(Number(r.monthly_premium || 0) * eePct(r) / 100)}</div>
        <div style={mutedSmall}>{eePct(r)}%</div>
      </div>
    ) },
    { key: 'employer_share', label: 'ER Share', align: 'right', render: (r) => (
      <div>
        <div style={{ color: 'var(--success)', fontWeight: 600 }}>{money(Number(r.monthly_premium || 0) * erPct(r) / 100)}</div>
        <div style={mutedSmall}>{erPct(r)}%</div>
      </div>
    ) },
    { key: 'dependents', label: 'Dependents', render: (r) => <span style={{ display: 'block', textAlign: 'center', fontWeight: 600 }}>{r.dependents}</span> },
    { key: 'effective_date', label: 'Effective Date', render: (r) => shortDate(r.effective_date) },
    { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
    { key: 'actions', label: '', align: 'right', render: (r) => (
      <span style={{ display: 'inline-flex', gap: 6 }}>
        {(r.status === 'Active' || r.status === 'Enrolled') && (
          <button className="btn ghost btn-sm" onClick={() => cancel(r.id)}>Cancel</button>
        )}
        <button className="btn ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => remove(r.id)}>Delete</button>
      </span>
    ) },
  ];

  // Company policy (mirrored by the backend): Regular employees only.
  const enrollable = (employees || []).filter(
    (e) => (e.status === 'Active' || e.status === 'On Leave') && e.employment_type === 'Regular'
  );

  return (
    <>
      <PageHeader
        title="Benefits Enrollment"
        subtitle="Manage employee health, insurance, and retirement plans"
        right={<button className="btn btn-primary" onClick={openEnroll}>Enroll Employee</button>}
      />

      <div className="info-banner">
        <span>ℹ</span>
        <span>
          Benefits are limited to <strong>Regular employees</strong>.
          Every employee is granted a mandatory <strong>Service Incentive Leave (15 days)</strong> that may only be used during <strong>April</strong>.
        </span>
      </div>

      <Notice kind={notice.kind}>{notice.msg}</Notice>

      <StatsGrid>
        <Stat label="Total Enrollments" value={stats.total} />
        <Stat label="Active Plans" value={<span style={{ color: 'var(--success)' }}>{stats.activePlans}</span>} />
        <Stat label="Total Dependents" value={stats.dependents} />
        <Stat label="Total Monthly Premium" value={<span style={{ color: 'var(--primary)' }}>{money(stats.premium)}</span>} />
      </StatsGrid>

      <div className="filters-bar">
        <select className="form-control" value={empFilter} onChange={(e) => setEmpFilter(e.target.value)}>
          <option value="">All Employees</option>
          {(employees || []).map((emp) => (
            <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.code})</option>
          ))}
        </select>
      </div>

      <Card title="Enrollment Records">
        <DataTable
          loading={loading} error={error}
          columns={columns}
          rows={enrollments}
          empty="No enrollments yet."
        />
      </Card>

      <Card
        title="Mandatory Service Incentive Leave (SIL)"
        right={<button className="btn btn-secondary btn-sm" onClick={() => setLeaveOpen(true)}>File Leave Request</button>}
      >
        <DataTable
          loading={silLoading}
          columns={[
            { key: 'employee', label: 'Employee', render: (r) => (
              <div>
                <div style={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</div>
                <div style={mutedSmall}>{r.department}</div>
              </div>
            ) },
            { key: 'accrued', label: 'Accrued (days)', align: 'right' },
            { key: 'used', label: 'Used', align: 'right' },
            { key: 'balance', label: 'Balance', align: 'right', render: (r) => <span style={{ fontWeight: 700 }}>{r.balance} d</span> },
            { key: 'window', label: 'Use window', render: () => <span className="badge badge-info">April only</span> },
          ]}
          rows={(balances || []).filter((b) => b.leave_type === 'Service Incentive Leave')}
          empty="No SIL balances for this year yet."
        />
      </Card>

      <Card title="Leave Requests">
        <DataTable
          columns={[
            { key: 'employee', label: 'Employee', render: (r) => <span style={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</span> },
            { key: 'leave_type', label: 'Type' },
            { key: 'range', label: 'Start → End', render: (r) => `${r.start_date} → ${r.end_date}` },
            { key: 'days', label: 'Days', align: 'right' },
            { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            { key: 'actions', label: '', align: 'right', render: (r) => r.status === 'Pending' && canDecideLeave && (
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <button className="btn btn-success btn-sm" onClick={() => decideLeave(r.id, 'Approved')}>Approve</button>
                <button className="btn btn-danger btn-sm" onClick={() => decideLeave(r.id, 'Rejected')}>Reject</button>
              </span>
            ) },
          ]}
          rows={leaveRequests || []}
          empty="No leave requests filed this year."
        />
      </Card>

      <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="File Leave Request">
        <form onSubmit={fileLeave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Notice kind="info">Service Incentive Leave may only be scheduled within April (mandatory company policy).</Notice>
          <Field label="Employee">
            <select className="form-control" value={leaveForm.employee_id} onChange={(e) => setLeaveForm((f) => ({ ...f, employee_id: e.target.value }))} required>
              <option value="">Select Employee</option>
              {(employees || []).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.code})</option>
              ))}
            </select>
          </Field>
          <Field label="Leave type">
            <select className="form-control" value={leaveForm.leave_type} onChange={(e) => setLeaveForm((f) => ({ ...f, leave_type: e.target.value }))} required>
              {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <div className="form-grid-2">
            <Field label="Start date">
              <input className="form-control" type="date" value={leaveForm.start_date} onChange={(e) => setLeaveForm((f) => ({ ...f, start_date: e.target.value }))} required />
            </Field>
            <Field label="End date">
              <input className="form-control" type="date" value={leaveForm.end_date} onChange={(e) => setLeaveForm((f) => ({ ...f, end_date: e.target.value }))} required />
            </Field>
          </div>
          <Field label="Pay status">
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
              <input type="checkbox" checked={!!leaveForm.is_paid} onChange={(e) => setLeaveForm((f) => ({ ...f, is_paid: e.target.checked }))} />
              Paid leave
            </label>
          </Field>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn ghost" onClick={() => setLeaveOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Filing…' : 'File Request'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={enrolling} onClose={() => setEnrolling(false)} title="Enroll Employee to Benefit Plan">
        <form onSubmit={enroll} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Notice kind="error">{busy ? '' : notice.kind === 'error' ? notice.msg : ''}</Notice>
          <Field label="Employee">
            <select className="form-control" value={form.employee_id} onChange={set('employee_id')} required>
              <option value="">Select Employee</option>
              {enrollable.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.code})</option>
              ))}
            </select>
          </Field>
          <div>
            <Field label="Benefit Plan">
              <select className="form-control" value={form.plan_id} onChange={set('plan_id')} required>
                <option value="">Select Plan</option>
                {(plans || []).map((p) => (
                  <option key={p.id} value={p.id}>{p.plan_name} - {money(p.monthly_premium)}/mo</option>
                ))}
              </select>
            </Field>
            <div style={{ background: 'var(--surface-alt)', borderRadius: 6, padding: 12, fontSize: 12, marginTop: 10 }}>
              <div className="form-grid-2" style={{ gap: 8, margin: 0 }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Employee Share: </span>
                  <strong style={{ color: 'var(--danger)' }}>
                    {previewEePct}% = {money(previewPremium * previewEePct / 100)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Employer Share: </span>
                  <strong style={{ color: 'var(--success)' }}>
                    {previewErPct}% = {money(previewPremium * previewErPct / 100)}
                  </strong>
                </div>
              </div>
            </div>
          </div>
          <div className="form-grid-2">
            <Field label="Effective Date">
              <input className="form-control" type="date" value={form.effective_date} onChange={set('effective_date')} required />
            </Field>
            <Field label="Dependents Enrolled">
              <input className="form-control" type="number" min="0" value={form.dependents} onChange={set('dependents')} required />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn ghost" onClick={() => setEnrolling(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Submit Enrollment'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}
