import { useEffect, useMemo, useState } from 'react';
import { useResource } from '../hooks/useResource.js';
import { api } from '../api/client.js';
import { shortDate } from '../lib/format.js';
import {
  PageHeader, StatsGrid, Stat, Card, Badge, Modal, Notice, Loading, ErrorBox, money,
} from '../components/ui.jsx';
import PayslipGate from '../components/PayslipGate.jsx';

/** Official payslip document layout, shared by the preview panel and print. */
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

const YEARS = ['2026', '2025', '2024'];
const defaultYear = () => {
  const y = String(new Date().getFullYear());
  return YEARS.includes(y) ? y : YEARS[0];
};

/* Period strings like "September 2026" carry the year; fall back to pay_date. */
function rowYear(r) {
  const m = String(r.period || '').match(/20\d{2}/);
  if (m) return m[0];
  if (r.pay_date) return String(new Date(String(r.pay_date).replace(' ', 'T')).getFullYear());
  return '';
}

export default function Payslips() {
  const { data: runs } = useResource('/api/payroll/runs');
  const { data, loading, error, reload } = useResource('/api/payslips');
  const rows = useMemo(() => data ?? [], [data]);

  const [year, setYear] = useState(defaultYear);
  const [runId, setRunId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [gate, setGate] = useState(null);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteNotice, setDeleteNotice] = useState('');

  // Default the run selector to the newest run, like the old viewer page did.
  useEffect(() => {
    if (!runId && runs && runs.length) setRunId(String(runs[0].id));
  }, [runs, runId]);

  const employees = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (r.employee_id && !map.has(String(r.employee_id))) map.set(String(r.employee_id), r.employee_name);
    });
    return [...map.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  }, [rows]);

  const yearRows = useMemo(() => rows.filter((r) => rowYear(r) === year), [rows, year]);
  const filtered = useMemo(
    () =>
      yearRows.filter(
        (r) => (!runId || String(r.payroll_run_id) === runId) && (!employeeId || String(r.employee_id) === employeeId),
      ),
    [yearRows, runId, employeeId],
  );

  const totalNetYtd = useMemo(
    () => yearRows.reduce((sum, r) => sum + Number(r.net_pay || 0), 0),
    [yearRows],
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

  const gateLabel = (r) => (r ? `${r.employee_name} — ${r.period}` : `Payslip #${selectedId}`);
  const selectedRow = useMemo(() => rows.find((r) => r.id === selectedId) || null, [rows, selectedId]);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    api
      .del(`/api/payslips/${deleteTarget.id}`)
      .then(() => {
        setDeleteNotice(`Payslip for ${deleteTarget.employee_name} moved to the Archive.`);
        if (selectedId === deleteTarget.id) setSelectedId(null);
        setDeleteTarget(null);
        reload();
      })
      .catch((e) => setDeleteError(e.message))
      .finally(() => setDeleting(false));
  };

  const reset = () => {
    setYear(defaultYear());
    setRunId(runs && runs.length ? String(runs[0].id) : '');
    setEmployeeId('');
  };

  return (
    <>
      <PageHeader
        title="Payslips"
        subtitle="View, print and download official employee payslips"
        right={<button className="btn btn-secondary" onClick={reset}>Reset Filters</button>}
      />

      {deleteNotice && <Notice kind="success">{deleteNotice}</Notice>}

      <div className="filters-bar">
        <select className="form-control" aria-label="Year" value={year} onChange={(e) => setYear(e.target.value)} style={{ maxWidth: 120 }}>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="form-control" aria-label="Payroll run" value={runId} onChange={(e) => setRunId(e.target.value)} style={{ maxWidth: 240 }}>
          <option value="">All Runs</option>
          {(runs || []).map((r) => <option key={r.id} value={r.id}>{r.period} — {r.status}</option>)}
        </select>
        <select className="form-control" aria-label="Employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">All Employees</option>
          {employees.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>

      <StatsGrid>
        <Stat label={`Total Payslips (${year})`} value={yearRows.length} />
        <Stat
          label="Total Net Earnings YTD"
          value={<span style={{ color: 'var(--success)' }}>{money(totalNetYtd)}</span>}
          kind="positive"
        />
      </StatsGrid>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Records list */}
        <Card title="Payslip Records">
          <div className="table-wrap" style={{ maxHeight: 600, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Period</th>
                  <th style={{ textAlign: 'right' }}>Gross</th>
                  <th style={{ textAlign: 'right' }}>Net</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6}><Loading /></td></tr>
                ) : error ? (
                  <tr><td colSpan={6}><ErrorBox error={error} /></td></tr>
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
                      <td className="num">{money(r.gross_pay)}</td>
                      <td style={{ fontWeight: 700 }}>{money(r.net_pay)}</td>
                      <td><Badge>{r.status}</Badge></td>
                      <td>
                        <span style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedId(r.id)}>View</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setGate({ id: r.id, label: `${r.employee_name} — ${r.period}` })}>PDF</button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => { setDeleteError(''); setDeleteTarget(r); }}
                          >
                            Delete
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      <p>No payslips found for {year}. Run and approve payroll first.</p>
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
              <button className="btn btn-secondary btn-sm" onClick={() => setGate({ id: selectedId, label: gateLabel(selectedRow) })}>
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
              <PayslipDoc detail={detail} onPrint={() => setGate({ id: selectedId, label: gateLabel(selectedRow) })} />
            ) : (
              <div className="empty-state">
                <p>Select a payslip to preview.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Delete confirmation — soft delete to the Archive. */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Payslip">
        <p>
          Delete the {deleteTarget?.period} payslip for {deleteTarget?.employee_name}?
          It will be moved to the <strong>Archive</strong> and can be restored from there.
        </p>
        <ErrorBox error={deleteError} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Move to Archive'}
          </button>
        </div>
      </Modal>

      <PayslipGate target={gate} onClose={() => setGate(null)} />
    </>
  );
}
