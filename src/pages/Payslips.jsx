import { useEffect, useMemo, useState } from 'react';
import { useResource } from '../hooks/useResource.js';
import { api } from '../api/client.js';
import { shortDate } from '../lib/format.js';
import { PageHeader, Card, Badge, Loading, ErrorBox, money } from '../components/ui.jsx';
import PayslipGate from '../components/PayslipGate.jsx';

/** Mirrors the .payslip-doc layout from payslips.php (and payslips_viewer.php modal). */
function PayslipDoc({ detail, onPrint }) {
  return (
    <div className="payslip-doc">
      <div className="ps-header">
        <div className="ps-company">{detail.company}</div>
        <div className="ps-subtitle">OFFICIAL PAYSLIP</div>
      </div>

      <div className="grid-2" style={{ borderBottom: '2px solid #111', paddingBottom: 12, marginBottom: 16 }}>
        <div>
          <div><strong>Name:</strong> {detail.employee?.name ?? '—'}</div>
          <div><strong>ID:</strong> {detail.employee?.code ?? '—'}</div>
          <div><strong>Dept:</strong> {detail.employee?.department ?? '—'}</div>
          <div><strong>Position:</strong> {detail.employee?.position ?? '—'}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div><strong>Period:</strong> {detail.period ?? '—'}</div>
          <div><strong>Pay Date:</strong> {detail.pay_date ? shortDate(detail.pay_date) : 'Pending'}</div>
          <div><strong>Days Worked:</strong> {detail.days_worked ?? '—'}</div>
          <div><strong>Status:</strong> {detail.status ? <Badge>{detail.status}</Badge> : '—'}</div>
        </div>
      </div>

      <div className="ps-cols">
        <div style={{ paddingRight: 16 }}>
          <div className="ps-col-title">EARNINGS</div>
          {(detail.earnings || []).map((e) => (
            <div className="ps-row" key={e.label}>
              <span>{e.label}</span>
              <span>{money(e.amount)}</span>
            </div>
          ))}
          <div className="ps-row ps-total" style={{ marginTop: 8 }}>
            <span>Gross Pay</span>
            <span>{money(detail.gross_pay)}</span>
          </div>
        </div>
        <div style={{ paddingLeft: 16, borderLeft: '1px solid #e5e7eb' }}>
          <div className="ps-col-title">DEDUCTIONS</div>
          {(detail.deductions || []).map((e) => (
            <div className="ps-row" key={e.label}>
              <span>{e.label}</span>
              <span>{money(e.amount)}</span>
            </div>
          ))}
          <div className="ps-row ps-total" style={{ marginTop: 8 }}>
            <span>Total Deductions</span>
            <span>{money(detail.total_deductions)}</span>
          </div>
        </div>
      </div>

      <div className="ps-total" style={{ marginTop: 24 }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>NET PAY</span>
        <span style={{ fontSize: 24, color: '#16a34a' }}>{money(detail.net_pay)}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button type="button" className="btn btn-secondary no-print" onClick={onPrint}>
          Print / Save PDF
        </button>
      </div>
    </div>
  );
}

export default function Payslips() {
  const { data, loading, error } = useResource('/api/payslips');
  const rows = useMemo(() => data ?? [], [data]);

  const [period, setPeriod] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [gate, setGate] = useState(null);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  // Filter options derived from the loaded records (PHP pulls DISTINCT from the DB).
  const periods = useMemo(
    () => [...new Set(rows.map((r) => r.period).filter(Boolean))],
    [rows],
  );
  const employees = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (r.employee_id && !map.has(String(r.employee_id))) map.set(String(r.employee_id), r.employee_name);
    });
    return [...map.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) => (!period || r.period === period) && (!employeeId || String(r.employee_id) === employeeId),
      ),
    [rows, period, employeeId],
  );

  useEffect(() => {
    if (!selectedId) return undefined;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError('');
    setDetail(null);
    api
      .get(`/api/payslips/${selectedId}/detail`)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setDetailError(e.message); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const gateRow = useMemo(() => rows.find((r) => r.id === gate?.id) || null, [rows, gate]);

  return (
    <>
      <PageHeader
        title="Payslips"
        subtitle="View and print employee payslips"
        right={
          <div className="filters-bar" style={{ margin: 0 }}>
            <select
              className="form-control"
              aria-label="Period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              <option value="">All Periods</option>
              {periods.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              className="form-control"
              aria-label="Employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              <option value="">All Employees</option>
              {employees.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </div>
        }
      />

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Records list */}
        <Card title="Payslip Records">
          <div className="table-wrap" style={{ maxHeight: 600, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Period</th>
                  <th>Net</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5}><Loading /></td></tr>
                ) : error ? (
                  <tr><td colSpan={5}><ErrorBox error={error} /></td></tr>
                ) : filtered.length > 0 ? (
                  filtered.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      style={{
                        cursor: 'pointer',
                        background: r.id === selectedId ? 'var(--primary-light)' : undefined,
                      }}
                    >
                      <td style={{ fontWeight: 600 }}>{r.employee_name}</td>
                      <td>{r.period}</td>
                      <td style={{ fontWeight: 700 }}>{money(r.net_pay)}</td>
                      <td><Badge>{r.status}</Badge></td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => { e.stopPropagation(); setSelectedId(r.id); }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="empty-state">
                      <p>No payslips yet. Run and approve payroll first.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Preview panel */}
        <Card
          title="Payslip Preview"
          right={
            selectedId ? (
              <button className="btn btn-secondary btn-sm" onClick={() => setGate({ id: selectedId })}>
                View PDF
              </button>
            ) : null
          }
        >
          <div style={{ background: 'var(--surface-alt)', padding: 16, borderRadius: 'var(--radius)' }}>
            {detailLoading ? (
              <Loading />
            ) : detailError ? (
              <ErrorBox error={detailError} />
            ) : detail ? (
              <PayslipDoc detail={detail} onPrint={() => setGate({ id: selectedId })} />
            ) : (
              <div className="empty-state">
                <p>Select a payslip to preview.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <PayslipGate
        target={gate ? { id: gate.id, label: gateRow ? `${gateRow.employee_name} — ${gateRow.period}` : `Payslip #${gate.id}` } : null}
        onClose={() => setGate(null)}
      />
    </>
  );
}
