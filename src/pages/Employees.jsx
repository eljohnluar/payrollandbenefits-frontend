import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useResource } from '../hooks/useResource.js';
import { PageHeader, StatsGrid, Stat, DataTable, Card, Badge, money } from '../components/ui.jsx';

const DEPARTMENTS = ['IT Department', 'HR Department', 'Finance Department', 'Operations', 'Marketing'];
const STATUSES = ['Active', 'On Leave', 'Resigned', 'Terminated'];

const muted = { fontSize: 11, color: 'var(--text-muted)' };

export default function Employees() {
  const { data, loading, error } = useResource('/api/employees');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Departments present in the roster (union with the canonical list) for the filter.
  const filterDepartments = useMemo(() => {
    const depts = new Set(DEPARTMENTS);
    (data || []).forEach((e) => e.department && depts.add(e.department));
    return [...depts].sort();
  }, [data]);

  // Client-side filtering, mirroring employees.php's search / dept_filter / status_filter.
  const rows = useMemo(() => {
    let list = data || [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((e) =>
        [`${e.first_name} ${e.last_name}`, e.code, e.email, e.position, e.department]
          .some((v) => String(v || '').toLowerCase().includes(q))
      );
    }
    if (deptFilter) list = list.filter((e) => e.department === deptFilter);
    if (statusFilter) list = list.filter((e) => e.status === statusFilter);
    return list;
  }, [data, search, deptFilter, statusFilter]);

  const stats = useMemo(() => {
    const list = data || [];
    const count = (s) => list.filter((e) => e.status === s).length;
    return { total: list.length, active: count('Active'), leave: count('On Leave'), resigned: count('Resigned') };
  }, [data]);

  const columns = [
    { key: 'code', label: 'Code', render: (r) => <Link to={`/employees/${r.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>{r.code}</Link> },
    { key: 'name', label: 'Name', render: (r) => (
      <div>
        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{r.first_name} {r.last_name}</div>
        <div style={muted}>{r.email}</div>
      </div>
    ) },
    { key: 'department', label: 'Department' },
    { key: 'position', label: 'Position' },
    { key: 'employment_type', label: 'Type' },
    { key: 'basic_salary', label: 'Basic Salary', align: 'right', render: (r) => money(r.basic_salary) },
    { key: 'ewallet_provider', label: 'E-Wallet', render: (r) => r.ewallet_provider
      ? <span className="badge badge-primary">{r.ewallet_provider}</span>
      : <span style={{ color: 'var(--text-muted)' }}>—</span> },
    { key: 'hire_date', label: 'Hired', render: (r) => r.hire_date },
    { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
    { key: 'actions', label: '', align: 'right', render: (r) => (
      <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <Link className="btn ghost btn-sm" to={`/employees/${r.id}`}>View</Link>
      </span>
    ) },
  ];

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle="Employee records are managed in the Core HRMS module — this view is read-only."
      />

      <StatsGrid>
        <Stat label="Total Employees" value={stats.total} />
        <Stat label="Active" value={<span style={{ color: 'var(--text-main)' }}>{stats.active}</span>} />
        <Stat label="On Leave" value={<span style={{ color: 'var(--warning)' }}>{stats.leave}</span>} kind="warning" />
        <Stat label="Resigned" value={<span style={{ color: 'var(--danger)' }}>{stats.resigned}</span>} kind="negative" />
      </StatsGrid>

      <div className="filters-bar">
        <input
          className="form-control"
          type="text"
          placeholder="Search employees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 250 }}
        />
        <select className="form-control" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="">All Departments</option>
          {filterDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <Card>
        <DataTable columns={columns} rows={rows} loading={loading} error={error} empty="No employees found." />
      </Card>
    </>
  );
}
