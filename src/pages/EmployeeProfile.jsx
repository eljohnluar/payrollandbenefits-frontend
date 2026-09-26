import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useResource } from '../hooks/useResource.js';
import { PageHeader, StatsGrid, Stat, Card, DataTable, Loading, ErrorBox, Badge, money, statusBadge } from '../components/ui.jsx';
import { shortDate } from '../lib/format.js';

const isActive = (v) => v === true || v === 1 || v === '1' || v === 't';

function Row({ label, children }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{children ?? '—'}</div>
    </div>
  );
}

const countBadge = (n, kind) => <span className={`badge badge-${kind}`}>{n}</span>;

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: emp, loading, error } = useResource(`/api/employees/${id}/profile`);
  const { data: settings } = useResource('/api/settings');

  const month = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const { data: attSummary } = useResource(`/api/attendance/summary?month=${month}`);
  const { data: leaveRequests } = useResource('/api/leave/requests');
  const { data: incData } = useResource(`/api/incentives?employee_id=${encodeURIComponent(id)}`);

  if (loading) return <Loading text="Loading profile…" />;
  if (error) return <ErrorBox error={error} />;

  const fullName = [emp.first_name, emp.middle_name, emp.last_name, emp.suffix].filter(Boolean).join(' ');

  // Attendance this month — mirrors employee_profile.php (P + OT count as 1 day, H as 0.5).
  const attRow = (attSummary || []).find((r) => String(r.employee_id) === String(id));
  const presentDays = attRow ? (Number(attRow.present_days) || 0) + (Number(attRow.ot_days) || 0) + 0.5 * (Number(attRow.holiday_days) || 0) : null;
  const otHours = attRow ? Number(attRow.ot_hours) || 0 : null;

  const leaveBalances = emp.leave_balance || [];
  const leaveTotal = leaveBalances.reduce((s, l) => s + (Number(l.balance) || 0), 0);
  const requestCount = (leaveRequests || []).filter((r) => String(r.employee_id) === String(id)).length;

  const performance = emp.performance || [];
  const latestRating = performance.length ? Number(performance[0].rating) : null;

  const benefits = emp.benefits || [];
  const activeBenefits = benefits.filter((b) => b.status === 'Active').length;
  const claims = emp.claims || [];
  const pendingClaims = claims.filter((c) => c.status === 'Pending').length;

  // Compensation & disbursement figures (settings-driven rates, defaults 22 / 8).
  const workDays = Number(settings?.work_days_per_month) || 22;
  const workHours = Number(settings?.work_hours_per_day) || 8;
  const basic = Number(emp.basic_salary) || 0;
  const dailyRate = basic / workDays;
  const hourlyRate = dailyRate / workHours;
  const allAllowances = emp.all_allowances || emp.allowances || [];
  const monthlyAllowances = allAllowances
    .filter((a) => isActive(a.is_active) && a.frequency === 'Monthly')
    .reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const loans = emp.loans || [];
  const loanBalance = loans.reduce((s, l) => s + (Number(l.balance) || 0), 0);

  const structures = incData?.structures || [];
  const earnings = incData?.earnings || [];
  const ytdIncentives = earnings
    .filter((e) => String(e.period || '').startsWith(String(new Date().getFullYear())))
    .reduce((s, e) => s + (Number(e.amount) || 0), 0);


  return (
    <>
      <PageHeader
        title={fullName}
        subtitle={`${emp.code} · ${emp.position} · ${emp.department}`}
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/employees')}>Back</button>
            <Link className="btn btn-primary" to={`/compensation?employee=${emp.id}`}>Compensation Settings</Link>
          </div>
        }
      />

      <StatsGrid>
        <Stat
          label="Attendance This Month"
          value={presentDays !== null ? `${presentDays.toFixed(1)} days` : '—'}
          sub={otHours !== null ? `${otHours.toFixed(1)} Overtime hours` : 'No attendance data yet'}
          kind="neutral"
        />
        <Stat
          label="Available Leave Balance"
          value={`${leaveTotal.toFixed(1)} days`}
          sub={`${requestCount} leave requests logged`}
          kind="neutral"
        />
        <Stat
          label="Performance Rating"
          value={Number.isFinite(latestRating) ? (
            <span>{latestRating.toFixed(2)} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/ 5.0</span></span>
          ) : '—'}
          sub="⭐ Latest KPI Evaluation"
          kind="positive"
        />
        <Stat
          label="Active Benefits & Claims"
          value={`${activeBenefits} enrolled`}
          sub={`${pendingClaims} pending claims`}
          kind="neutral"
        />
      </StatsGrid>

      <div className="grid-2" style={{ marginBottom: 20, alignItems: 'start' }}>
        <Card title="Core HR & Employment Details" body>
          <div className="profile-cards">
            <Row label="Employee Code">{emp.code}</Row>
            <Row label="Full Name">{fullName}</Row>
            <Row label="Position">{emp.position}</Row>
            <Row label="Department">{emp.department}</Row>
            <Row label="Employment Type">{emp.employment_type}</Row>
            <Row label="Hire Date">{shortDate(emp.hire_date)}</Row>
            <div>
              <div className="stat-label">Status</div>
              <span className={`badge ${statusBadge(emp.status)}`}>{emp.status}</span>
            </div>
            <Row label="Email Address">{emp.email || '—'}</Row>
            <Row label="Mobile Number">{emp.mobile || '—'}</Row>
            <Row label="Birth Date">{emp.birth_date ? shortDate(emp.birth_date) : '—'}</Row>
          </div>
        </Card>

        <Card title="Compensation & Disbursement Details" body>
          <div className="profile-cards">
            <div>
              <div className="stat-label">Monthly Basic Salary</div>
              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: 16 }}>{money(basic)}</div>
            </div>
            <Row label="Computed Daily Rate">{money(dailyRate)} / day</Row>
            <Row label="Computed Hourly Rate">{money(hourlyRate)} / hr</Row>
            <Row label="Active Monthly Allowances">{money(monthlyAllowances)}</Row>
            <div>
              <div className="stat-label">Outstanding Loans Balance</div>
              <div style={{ fontWeight: 600, color: loanBalance > 0 ? 'var(--danger)' : 'var(--text-main)' }}>{money(loanBalance)}</div>
            </div>
            <div>
              <div className="stat-label">Payment / E-Wallet Method</div>
              <span className="badge badge-info">{emp.ewallet_provider || 'Cash'}</span>
            </div>
            <Row label="E-Wallet / Bank Account #">{emp.ewallet_account || 'Not configured'}</Row>
            <Row label="Account Holder Name">{emp.ewallet_name || 'Same as employee'}</Row>
          </div>
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <span style={{ color: 'var(--text-muted)' }}>Statutory IDs:</span>
            <span className="badge badge-muted">SSS: {emp.sss || '—'}</span>
            <span className="badge badge-muted">PhilHealth: {emp.philhealth || '—'}</span>
            <span className="badge badge-muted">Pag-IBIG: {emp.pagibig || '—'}</span>
            <span className="badge badge-muted">TIN: {emp.tin || '—'}</span>
          </div>
        </Card>
      </div>

      <div className="grid-2" style={{ marginBottom: 20, alignItems: 'start' }}>
        <Card title="Performance Reviews & KPI" right={countBadge(performance.length, 'primary')}>
          <DataTable
            columns={[
              { key: 'review_date', label: 'Review Date', render: (r) => shortDate(r.review_date) },
              { key: 'rating', label: 'Rating', render: (r) => <span className="badge badge-success">⭐ {Number(r.rating || 0).toFixed(2)}</span> },
              { key: 'bonus_amount', label: 'Performance Bonus', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{money(r.bonus_amount)}</span> },
            ]}
            rows={performance}
            empty="No performance reviews recorded."
          />
        </Card>
        <Card title="Competency Assessments" right={countBadge((emp.competencies || []).length, 'primary')}>
          <DataTable
            columns={[
              { key: 'assessment_date', label: 'Assessment Date', render: (r) => shortDate(r.assessment_date) },
              { key: 'competency_name', label: 'Competency', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.competency_name}</span> },
              { key: 'allowance_amount', label: 'Skill Allowance', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{money(r.allowance_amount)}</span> },
            ]}
            rows={emp.competencies}
            empty="No competency assessments recorded."
          />
        </Card>
      </div>

      <div className="grid-2" style={{ marginBottom: 20, alignItems: 'start' }}>
        <Card title="Training & Development" right={countBadge((emp.trainings || []).length, 'info')}>
          <DataTable
            columns={[
              { key: 'completed_date', label: 'Completed Date', render: (r) => shortDate(r.completed_date) },
              { key: 'training_name', label: 'Course / Training Program', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.training_name}</span> },
              { key: 'incentive_amount', label: 'Incentive', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{money(r.incentive_amount)}</span> },
            ]}
            rows={emp.trainings}
            empty="No training records logged."
          />
        </Card>
        <Card title="Social Recognition & Awards" right={countBadge((emp.awards || []).length, 'success')}>
          <DataTable
            columns={[
              { key: 'award_date', label: 'Award Date', render: (r) => shortDate(r.award_date) },
              { key: 'award_name', label: 'Award Citation', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>🏆 {r.award_name}</span> },
              { key: 'bonus_amount', label: 'Bonus Amount', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{money(r.bonus_amount)}</span> },
            ]}
            rows={emp.awards}
            empty="No recognition awards recorded."
          />
        </Card>
      </div>

      <div className="grid-2" style={{ marginBottom: 20, alignItems: 'start' }}>
        <Card title="Benefits & HMO Coverage" right={<Link className="btn ghost btn-sm" to="/benefits">Manage</Link>}>
          <DataTable
            columns={[
              { key: 'plan_name', label: 'Plan Name', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.plan_name || 'Benefit Plan'}</span> },
              { key: 'provider', label: 'Provider / Coverage', render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.provider || 'HMO'}</span> },
              { key: 'dependents', label: 'Dependents' },
              { key: 'monthly_premium', label: 'Premium', render: (r) => money(r.monthly_premium) },
              { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            ]}
            rows={benefits}
            empty="No active benefit enrollments."
          />
        </Card>
        <Card title="Recent Claims" right={<Link className="btn ghost btn-sm" to="/claims">All Claims</Link>}>
          <DataTable
            columns={[
              { key: 'claim_date', label: 'Date', render: (r) => shortDate(r.claim_date) },
              { key: 'category', label: 'Category', render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.category || 'General'}</span> },
              { key: 'description', label: 'Description' },
              { key: 'amount', label: 'Amount', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{money(r.amount)}</span> },
              { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            ]}
            rows={claims}
            empty="No claims logged for this employee."
          />
        </Card>
      </div>

      <div className="grid-2" style={{ marginBottom: 20, alignItems: 'start' }}>
        <Card title="Active Incentive Structures" right={countBadge(structures.filter((s) => isActive(s.is_active)).length, 'success')}>
          <DataTable
            columns={[
              { key: 'name', label: 'Incentive', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.name}</span> },
              { key: 'type', label: 'Type', render: (r) => <span className="badge badge-muted">{r.type}</span> },
              { key: 'rate', label: 'Rate', render: (r) => (r.rate_type === 'Percentage' ? `${Number(r.rate) || 0}%` : money(r.rate)) },
              { key: 'frequency', label: 'Frequency' },
              { key: 'is_active', label: 'Status', render: (r) => <Badge>{isActive(r.is_active) ? 'Active' : 'Inactive'}</Badge> },
            ]}
            rows={structures}
            empty="No incentive structures assigned."
          />
        </Card>
        <Card
          title="Incentive History"
          right={<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>YTD <strong style={{ color: 'var(--success)' }}>{money(ytdIncentives)}</strong></span>}
        >
          <DataTable
            columns={[
              { key: 'period', label: 'Period' },
              { key: 'type', label: 'Type', render: (r) => <span className="badge badge-muted">{r.type}</span> },
              { key: 'basis', label: 'Basis', render: (r) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.basis || '—'}</span> },
              { key: 'amount', label: 'Amount', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{money(r.amount)}</span> },
              { key: 'status', label: 'Status', render: (r) => <Badge>{r.status === 'Paid' ? 'Paid' : 'Earned'}</Badge> },
            ]}
            rows={earnings}
            empty="No incentives earned yet."
          />
        </Card>
      </div>

      {/* Existing profile tables, preserved and restyled into card pairs */}
      <div className="grid-2" style={{ marginBottom: 20, alignItems: 'start' }}>
        <Card title="Salary History" right={countBadge((emp.salary_history || []).length, 'muted')}>
          <DataTable
            columns={[
              { key: 'effective_date', label: 'Effective Date', render: (r) => shortDate(r.effective_date) },
              { key: 'basic_salary', label: 'Basic Salary', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{money(r.basic_salary)}</span> },
              { key: 'reason', label: 'Reason', render: (r) => <span style={{ color: 'var(--text-muted)' }}>{r.reason || '—'}</span> },
            ]}
            rows={emp.salary_history}
            empty="No salary history."
          />
        </Card>
        <Card title="Leave Balances" right={countBadge(leaveBalances.length, 'muted')}>
          <DataTable
            columns={[
              { key: 'year', label: 'Year' },
              { key: 'leave_type', label: 'Type' },
              { key: 'accrued', label: 'Accrued' },
              { key: 'used', label: 'Used' },
              { key: 'balance', label: 'Balance', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.balance}</span> },
            ]}
            rows={leaveBalances}
            empty="No leave balances on record."
          />
        </Card>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Card title="Allowances" right={countBadge((emp.allowances || []).length, 'success')}>
          <DataTable
            columns={[
              { key: 'type', label: 'Type', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.type}</span> },
              { key: 'amount', label: 'Amount', render: (r) => money(r.amount) },
              { key: 'frequency', label: 'Frequency', render: (r) => <span className="badge badge-muted">{r.frequency}</span> },
              { key: 'start_date', label: 'Start', render: (r) => shortDate(r.start_date) },
            ]}
            rows={emp.allowances}
            empty="No allowances."
          />
        </Card>
        <Card title="Loans & Deductions" right={countBadge(loans.length, 'danger')}>
          <DataTable
            columns={[
              { key: 'loan_type', label: 'Type', render: (r) => <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.loan_type}</span> },
              { key: 'monthly_deduction', label: 'Monthly', render: (r) => <span style={{ color: 'var(--danger)', fontWeight: 600 }}>-{money(r.monthly_deduction)}</span> },
              { key: 'balance', label: 'Balance', render: (r) => <span style={{ fontWeight: 600 }}>{money(r.balance)}</span> },
              { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            ]}
            rows={loans}
            empty="No active loans."
          />
        </Card>
      </div>
    </>
  );
}
