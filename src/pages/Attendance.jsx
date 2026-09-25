import { useState } from 'react';
import { useResource } from '../hooks/useResource.js';
import { qs } from '../api/client.js';
import { PageHeader, StatsGrid, Stat, Card, DataTable, Badge } from '../components/ui.jsx';

const isoToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const isoMonth = () => isoToday().slice(0, 7);

const STATUS_MAP = {
  P: { cls: 'badge-success', label: 'Present' },
  H: { cls: 'badge-info', label: 'Holiday' },
  A: { cls: 'badge-danger', label: 'Absent' },
  OT: { cls: 'badge-primary', label: 'Overtime' },
  L: { cls: 'badge-warning', label: 'Late' },
};

function Pill({ cls, children }) {
  return <span className={`badge ${cls}`}>{children}</span>;
}

function StatusPill({ status }) {
  const s = STATUS_MAP[status];
  return s ? <Pill cls={s.cls}>{s.label}</Pill> : <Pill cls="badge-muted">Not Logged</Pill>;
}

function ShiftPill({ name }) {
  if (!name) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const cls = { Night: 'badge-primary', Mid: 'badge-warning', Holiday: 'badge-danger', 'Rest Day': 'badge-muted' }[name] || 'badge-info';
  return <Pill cls={cls}>{name}</Pill>;
}

const hrs = (v) => (v == null || v === '' ? '—' : `${Number(v).toFixed(1)} h`);

const empCell = (r) => (
  <div>
    <div style={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</div>
    {r.department && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.department}</div>}
  </div>
);

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym) => {
  const [y, m] = String(ym).split('-').map(Number);
  return y && m ? `${MONTH_LABELS[m - 1]} ${y}` : ym;
};

/* ── Tab 1: Daily Record ── */
function DailyTab({ date }) {
  const { data, loading, error } = useResource(`/api/attendance/daily${qs({ date })}`);
  const rows = data || [];
  const present = rows.filter((r) => r.status === 'P' || r.status === 'OT').length;
  const absent = rows.filter((r) => r.status === 'A').length;
  const onOt = rows.filter((r) => r.status === 'OT').length;

  return (
    <>
      <StatsGrid>
        <Stat label="Total Employees" value={rows.length} />
        <Stat label="Present (inc. OT)" value={<span style={{ color: 'var(--success)' }}>{present}</span>} kind="positive" />
        <Stat label="Absences" value={<span style={{ color: 'var(--danger)' }}>{absent}</span>} kind="negative" />
        <Stat label="On Overtime" value={<span style={{ color: 'var(--primary)' }}>{onOt}</span>} kind="primary" />
      </StatsGrid>
      <Card body>
        <DataTable
          loading={loading} error={error}
          columns={[
            { key: 'employee', label: 'Employee', render: empCell },
            { key: 'shift', label: 'Shift', render: (r) => <ShiftPill name={r.shift_name} /> },
            { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
            { key: 'late_minutes', label: 'Late', align: 'right', render: (r) => (Number(r.late_minutes) > 0 ? `${Number(r.late_minutes).toFixed(0)} min` : '—') },
            { key: 'actual_hours', label: 'Actual Hours', align: 'right', render: (r) => hrs(r.actual_hours) },
            { key: 'ot_hours', label: 'OT Hours', align: 'right', render: (r) => hrs(r.ot_hours) },
            { key: 'timesheet_status', label: 'Timesheet', render: (r) => (r.timesheet_status ? <Badge>{r.timesheet_status}</Badge> : <span style={{ color: 'var(--text-muted)' }}>—</span>) },
          ]}
          rows={rows} empty="No attendance records for this date."
        />
      </Card>
    </>
  );
}

/* ── Tab 2: Monthly Summary ── */
function SummaryTab({ month }) {
  const { data, loading, error } = useResource(`/api/attendance/summary${qs({ month })}`);
  const rows = data || [];
  const sum = (key) => rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

  return (
    <Card body>
      <DataTable
        loading={loading} error={error}
        columns={[
          { key: 'employee', label: 'Employee', render: (r) => <span style={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</span> },
          { key: 'department', label: 'Department' },
          { key: 'present_days', label: 'Present', render: (r) => <Pill cls="badge-success">{r.present_days ?? 0}</Pill> },
          { key: 'holiday_days', label: 'Holiday', render: (r) => <Pill cls="badge-info">{r.holiday_days ?? 0}</Pill> },
          { key: 'absent_days', label: 'Absent', render: (r) => <Pill cls="badge-danger">{r.absent_days ?? 0}</Pill> },
          { key: 'ot_days', label: 'OT Days', render: (r) => <Pill cls="badge-primary">{r.ot_days ?? 0}</Pill> },
          { key: 'late_days', label: 'Late Days', render: (r) => <Pill cls="badge-warning">{r.late_days ?? 0}</Pill> },
          { key: 'late_minutes', label: 'Late (min)', align: 'right', render: (r) => (Number(r.late_minutes) > 0 ? Number(r.late_minutes).toFixed(0) : '—') },
          { key: 'ot_hours', label: 'OT Hours', align: 'right', render: (r) => hrs(r.ot_hours) },
          { key: 'total_hours', label: 'Total Hours', align: 'right', render: (r) => hrs(r.total_hours) },
          { key: 'days_recorded', label: 'Days Recorded', align: 'right' },
          { key: 'timesheet_status', label: 'Timesheet', render: (r) => (r.timesheet_status ? <Badge>{r.timesheet_status}</Badge> : <span style={{ color: 'var(--text-muted)' }}>—</span>) },
        ]}
        rows={rows} empty="No attendance records for this month."
        foot={['Total', '', sum('present_days'), sum('holiday_days'), sum('absent_days'), sum('ot_days'),
          sum('late_days'), sum('late_minutes').toFixed(0),
          `${sum('ot_hours').toFixed(1)} h`, `${sum('total_hours').toFixed(1)} h`, sum('days_recorded'), '']}
      />
    </Card>
  );
}

/* ── Tab 3: Leave Balance ── */
function LeaveTab({ year }) {
  const { data: balances, loading: bLoading, error: bError } = useResource(`/api/leave/balances${qs({ year })}`);
  const { data: requests, loading: rLoading, error: rError } = useResource(`/api/leave/requests${qs({ year })}`);

  const balRows = balances || [];
  const reqRows = requests || [];
  const byType = {};
  for (const b of balRows) byType[b.leave_type] = (byType[b.leave_type] || 0) + (Number(b.balance) || 0);
  const types = Object.keys(byType).sort();

  return (
    <>
      <StatsGrid>
        {types.map((t) => (
          <Stat key={t} label={`${t} Available`} value={<span style={{ color: 'var(--primary)' }}>{byType[t]}</span>} sub={`${byType[t] > 0 ? 'days available' : 'fully used'}`} kind={byType[t] > 0 ? 'positive' : 'negative'} />
        ))}
        <Stat label="Leave Requests" value={reqRows.length} kind="neutral" />
      </StatsGrid>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card title={`Leave Balances (${year})`} body>
          <DataTable
            loading={bLoading} error={bError}
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => <span style={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</span> },
              { key: 'department', label: 'Department' },
              { key: 'leave_type', label: 'Leave Type' },
              { key: 'accrued', label: 'Accrued', align: 'right' },
              { key: 'used', label: 'Used', align: 'right', render: (r) => <span style={{ color: 'var(--warning, #d97706)' }}>{r.used}</span> },
              { key: 'balance', label: 'Balance', align: 'right', render: (r) => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700 }}>{r.balance} d</span>
                  <Pill cls={Number(r.balance) > 0 ? 'badge-success' : 'badge-danger'}>{Number(r.balance) > 0 ? 'Available' : 'Depleted'}</Pill>
                </span>
              ) },
            ]}
            rows={balRows} empty="No leave balance records found."
          />
        </Card>
        <Card title={`Leave Requests (${year})`} body>
          <DataTable
            loading={rLoading} error={rError}
            columns={[
              { key: 'employee', label: 'Employee', render: (r) => <span style={{ fontWeight: 600 }}>{r.first_name} {r.last_name}</span> },
              { key: 'leave_type', label: 'Type' },
              { key: 'range', label: 'Start → End', render: (r) => `${r.start_date} → ${r.end_date}` },
              { key: 'days', label: 'Days', align: 'right' },
              { key: 'is_paid', label: 'Paid', render: (r) => (Number(r.is_paid) || r.is_paid === true ? <Pill cls="badge-success">Yes</Pill> : <Pill cls="badge-muted">No</Pill>) },
              { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            ]}
            rows={reqRows} empty="No leave requests for this year."
          />
        </Card>
      </div>
    </>
  );
}

/* ── Page ── */
const TABS = [
  { key: 'daily', label: 'Daily Record' },
  { key: 'monthly', label: 'Monthly Summary' },
  { key: 'leave', label: 'Leave Balance' },
];

export default function Attendance() {
  const [tab, setTab] = useState('daily');
  const [date, setDate] = useState(isoToday());
  const [month, setMonth] = useState(isoMonth());
  const [year, setYear] = useState(String(new Date().getFullYear()));

  return (
    <>
      <PageHeader title="Attendance" subtitle="Read-only attendance and leave view consumed by payroll." />

      <div className="info-banner">
        <span>ℹ</span>
        <span>
          Attendance changes are managed in the Time and Attendance System.
          Late and absent records are <strong>automatically deducted in payroll</strong> (late minutes at the hourly rate; absences unpaid at the daily rate).
        </span>
      </div>

      <div className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'active' : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.key === 'monthly' ? `Monthly Summary (${monthLabel(month)})` : t.label}
          </button>
        ))}
      </div>

      {tab === 'daily' && (
        <>
          <div className="filters-bar">
            <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <DailyTab date={date} />
        </>
      )}

      {tab === 'monthly' && (
        <>
          <div className="filters-bar">
            <input type="month" className="form-control" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <SummaryTab month={month} />
        </>
      )}

      {tab === 'leave' && (
        <>
          <div className="filters-bar">
            <select className="form-control" value={year} onChange={(e) => setYear(e.target.value)}>
              {['2026', '2025', '2024'].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <LeaveTab year={year} />
        </>
      )}
    </>
  );
}
