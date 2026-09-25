import { useEffect, useMemo, useState } from 'react';
import { useResource } from '../hooks/useResource.js';
import { api } from '../api/client.js';
import { shortDate } from '../lib/format.js';
import {
  PageHeader, StatsGrid, Stat, Card, DataTable, Badge, Modal, ErrorBox, Loading, money,
} from '../components/ui.jsx';
import PayslipGate from '../components/PayslipGate.jsx';

/* Mirrors the .payslip-doc layout from payslips_viewer.php (same as payslips.php preview). */
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

/* Period strings like "2026-01" / "Jan 2026" carry the year; fall back to pay_date. */
function rowYear(r) {
  const m = String(r.period || '').match(/20\d{2}/);
  if (m) return m[0];
  if (r.pay_date) return String(new Date(String(r.pay_date).replace(' ', 'T')).getFullYear());
  return '';
}

export default function PayslipsViewer() {
  const { data: runs } = useResource('/api/payroll/runs');
  const { data, loading, error, reload } = useResource('/api/payslips');
  const [year, setYear] = useState(defaultYear);
  const [runId, setRunId] = useState('');

  const [viewing, setViewing] = useState(null); // row whose payslip-doc modal is open
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteNotice, setDeleteNotice] = useState('');
  const [gate, setGate] = useState(null);

  // Keep the existing behavior: default the run selector to the newest run.
  useEffect(() => {
    if (!runId && runs && runs.length) setRunId(String(runs[0].id));
  }, [runs, runId]);

  const rows = useMemo(() => data ?? [], [data]);
  const yearRows = useMemo(() => rows.filter((r) => rowYear(r) === year), [rows, year]);
  const filtered = useMemo(
    () => (runId ? yearRows.filter((r) => String(r.payroll_run_id) === runId) : yearRows),
    [yearRows, runId],
  );

  const totalNetYtd = useMemo(
    () => yearRows.reduce((sum, r) => sum + Number(r.net_pay || 0), 0),
    [yearRows],
  );

  useEffect(() => {
    if (!viewing) return undefined;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError('');
    setDetail(null);
    api
      .get(`/api/payslips/${viewing.id}/detail`)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((e) => { if (!cancelled) setDetailError(e.message); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [viewing]);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    api
      .del(`/api/payslips/${deleteTarget.id}`)
      .then(() => {
        setDeleteNotice(`Payslip for ${deleteTarget.employee_name} moved to the Archive.`);
        setDeleteTarget(null);
        reload();
      })
      .catch((e) => setDeleteError(e.message))
      .finally(() => setDeleting(false));
  };

  const reset = () => {
    setYear(defaultYear());
    setRunId(runs && runs.length ? String(runs[0].id) : '');
  };

  return (
    <>
      <PageHeader
        title="Payslip Viewer"
        subtitle="View and download official payroll records"
        right={
          <button
            className="btn btn-secondary"
            disabled
            title="ZIP export is not available yet — the backend has no ZIP endpoint. Use “View PDF” per payslip."
          >
            Export All (ZIP)
          </button>
        }
      />

      <Notice kind="success">{deleteNotice}</Notice>

      <div className="filters-bar">
        <select className="form-control" aria-label="Year" value={year} onChange={(e) => setYear(e.target.value)}>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="form-control" aria-label="Payroll run" value={runId} onChange={(e) => setRunId(e.target.value)}>
          <option value="">All Runs</option>
          {(runs || []).map((r) => <option key={r.id} value={r.id}>{r.period} — {r.status}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={reset}>Reset</button>
      </div>

      <StatsGrid>
        <Stat label={`Total Payslips (${year})`} value={yearRows.length} />
        <Stat
          label="Total Net Earnings YTD"
          value={<span style={{ color: 'var(--success)' }}>{money(totalNetYtd)}</span>}
          kind="positive"
        />
      </StatsGrid>

      <Card title="Payslips">
        <DataTable
          loading={loading}
          error={error}
          columns={[
            { key: 'period', label: 'Period', render: (r) => <span style={{ fontWeight: 600 }}>{r.period}</span> },
            { key: 'pay_date', label: 'Pay Date', render: (r) => (r.pay_date ? shortDate(r.pay_date) : 'Pending') },
            { key: 'gross_pay', label: 'Gross Pay', align: 'right', render: (r) => money(r.gross_pay) },
            {
              key: 'deductions',
              label: 'Deductions',
              align: 'right',
              // List rows may omit total_deductions — derive from gross − net.
              render: (r) => {
                const ded = r.total_deductions ?? Number(r.gross_pay || 0) - Number(r.net_pay || 0);
                return <span style={{ color: 'var(--danger)' }}>−{money(Math.max(ded, 0))}</span>;
              },
            },
            {
              key: 'net_pay',
              label: 'Net Pay',
              align: 'right',
              render: (r) => <span style={{ fontWeight: 700, color: 'var(--success)' }}>{money(r.net_pay)}</span>,
            },
            { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
            {
              key: 'actions',
              label: '',
              render: (r) => (
                <span style={{ display: 'inline-flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setViewing(r)}>View</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setGate({ id: r.id, label: `${r.employee_name} — ${r.period}` })}>View PDF</button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => { setDeleteError(''); setDeleteTarget(r); }}
                  >
                    Delete
                  </button>
                </span>
              ),
            },
          ]}
          rows={filtered}
          empty={`No payslips found for ${year}.`}
        />
      </Card>

      {/* Payslip document modal — mirrors the reference "viewMyPayslip" modal. */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title="Payslip Viewer" wide>
        {detailLoading ? (
          <Loading />
        ) : detailError ? (
          <ErrorBox error={detailError} />
        ) : detail ? (
          <PayslipDoc detail={detail} onPrint={() => setGate({ id: viewing.id, label: `${viewing.employee_name} — ${viewing.period}` })} />
        ) : null}
      </Modal>

      {/* Delete confirmation (replaces the reference window.confirm). */}
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
