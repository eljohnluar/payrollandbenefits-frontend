import { useState } from 'react';
import { useCallback, useEffect } from 'react';
import { useResource } from '../hooks/useResource.js';
import { api, qs } from '../api/client.js';
import { PageHeader, Card, DataTable, Badge, Stat, StatsGrid, Field, money } from '../components/ui.jsx';

export default function ClaimTracker() {
  const { data: employees } = useResource('/api/employees');
  const { data: allClaims } = useResource('/api/claims');
  const [claimId, setClaimId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [status, setStatus] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/api/claims' + qs({ employee_id: employeeId, status })).then((r) => setRows(r?.data ?? [])).finally(() => setLoading(false));
  }, [employeeId, status]);

  useEffect(() => { load(); }, [load]);

  const claims = allClaims || [];
  const selected = claims.find((c) => String(c.id) === String(claimId)) || null;

  const count = (s) => rows.filter((r) => r.status === s).length;
  const sum = (s) => rows.filter((r) => r.status === s).reduce((a, r) => a + Number(r.amount || 0), 0);

  return (
    <>
      <PageHeader title="Claim Tracker" subtitle="Track the review and disbursement status of employee reimbursement claims" />
      <div className="card" style={{ maxWidth: 700, margin: '0 auto' }}>
        <div className="card-header">
          <select className="form-control" style={{ width: '100%' }} value={claimId} onChange={(e) => setClaimId(e.target.value)}>
            <option value="">-- Select an Employee Claim to Track --</option>
            {claims.map((c) => (
              <option key={c.id} value={c.id}>
                {c.claim_number} - {c.employee_name} - {c.category} ({money(c.amount)}) - {c.status}
              </option>
            ))}
          </select>
        </div>
        <div className="card-body">
          {selected ? <ClaimTimeline claim={selected} /> : (
            <div className="empty-state">Select a claim to view its timeline tracking.</div>
          )}
        </div>
      </div>

      <Card body>
        <div className="form-row">
          <Field label="Employee">
            <select className="form-control" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">All employees</option>
              {(employees || []).map((emp) => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              {['Pending', 'Approved', 'Rejected', 'Paid'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      <StatsGrid>
        <Stat label="Pending" value={count('Pending')} sub={money(sum('Pending'))} />
        <Stat label="Approved" value={count('Approved')} sub={money(sum('Approved'))} />
        <Stat label="Paid" value={count('Paid')} sub={money(sum('Paid'))} />
        <Stat label="Rejected" value={count('Rejected')} sub={money(sum('Rejected'))} />
      </StatsGrid>

      <Card>
        <DataTable
          loading={loading}
          columns={[
            { key: 'claim_number', label: 'Claim #' },
            { key: 'employee_name', label: 'Employee' },
            { key: 'category', label: 'Category' },
            { key: 'amount', label: 'Amount', align: 'right', render: (r) => money(r.amount) },
            { key: 'claim_date', label: 'Filed' },
            { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
          ]}
          rows={rows}
          empty="No claims match your filters."
        />
      </Card>
    </>
  );
}

function ClaimTimeline({ claim }) {
  const st = claim.status;

  const t2 = st === 'Rejected' ? 'rejected' : ['Approved', 'Paid'].includes(st) ? 'done' : 'pending';
  const t3 = st === 'Rejected' ? 'rejected' : ['Approved', 'Paid'].includes(st) ? 'done' : 'pending';
  const t4 = st === 'Paid' ? 'done' : 'pending';

  const steps = [
    { state: 'done', icon: '✓', title: 'Claim Submitted', sub: claim.claim_date },
    { state: t2, icon: glyph(t2, '2'), title: 'HR Review', sub: t2 === 'pending' ? 'Awaiting HR review...' : t2 === 'rejected' ? 'Claim was rejected during review' : 'Completed by HR' },
    { state: t3, icon: glyph(t3, '3'), title: 'HR Approval', sub: t3 === 'pending' ? 'Awaiting HR manager approval' : t3 === 'rejected' ? 'Claim was rejected' : 'Approved by HR' },
    { state: t4, icon: glyph(t4, '4'), title: 'Finance Disbursement', sub: t4 === 'done' ? "Funds transferred to employee's E-Wallet" : 'Awaiting Finance disbursement approval' },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-alt)', padding: 16, borderRadius: 'var(--radius)', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', marginBottom: 2 }}>👤 {claim.employee_name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{claim.category} • {claim.claim_number}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-main)' }}>{money(claim.amount)}</div>
        </div>
        <Badge>{claim.status}</Badge>
      </div>
      <div className="timeline" style={{ paddingLeft: 16 }}>
        {steps.map((s) => (
          <div className="timeline-step" key={s.title}>
            <div className="timeline-line" />
            <div className={`timeline-circle ${s.state}`}>{s.icon}</div>
            <div className="timeline-body">
              <h4 style={{ fontWeight: 600, color: 'var(--text-main)' }}>{s.title}</h4>
              <p>{s.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function glyph(state, n) {
  return state === 'done' ? '✓' : state === 'rejected' ? '✕' : n;
}
