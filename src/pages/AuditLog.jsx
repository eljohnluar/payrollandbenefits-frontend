import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../api/client.js';
import { PageHeader, Card, DataTable, Badge, Notice } from '../components/ui.jsx';

const parseTs = (iso) => new Date(String(iso).replace(' ', 'T').replace(/\+00$/, '+00:00'));
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = parseTs(iso);
  return Number.isNaN(d.getTime()) ? String(iso).slice(0, 10) : d.toLocaleDateString();
};
const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = parseTs(iso);
  return Number.isNaN(d.getTime()) ? String(iso).slice(11, 19) : d.toLocaleTimeString();
};

const shortenDetails = (details) => {
  if (!details) return '—';
  const text = typeof details === 'string' ? details : JSON.stringify(details);
  return text.length > 70 ? `${text.slice(0, 70)}…` : text;
};

export default function AuditLog() {
  const [filters, setFilters] = useState({ search: '', module: '', date_from: '', date_to: '' });
  const [rows, setRows] = useState([]);
  const [modules, setModules] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/api/audit' + qs({ ...filters, limit: 300 }));
      setRows(res?.data ?? []);
      setModules(res?.modules ?? []);
      setTotal(res?.total ?? 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle="Every user action with date, time and IP address"
        right={<span className="badge badge-muted">{total} entries</span>}
      />
      <Notice kind="error">{error}</Notice>

      <div className="filters-bar">
        <input className="form-control" placeholder="Search action or details…" value={filters.search} onChange={set('search')} style={{ maxWidth: 260 }} />
        <select className="form-control" value={filters.module} onChange={set('module')} style={{ maxWidth: 180 }}>
          <option value="">All modules</option>
          {modules.map((m) => <option key={m}>{m}</option>)}
        </select>
        <input className="form-control" type="date" value={filters.date_from} onChange={set('date_from')} style={{ maxWidth: 170 }} title="Date from" />
        <input className="form-control" type="date" value={filters.date_to} onChange={set('date_to')} style={{ maxWidth: 170 }} title="Date to" />
        <button className="btn btn-secondary" onClick={load}>Refresh</button>
      </div>

      <Card title="User Actions">
        <DataTable
          loading={loading}
          columns={[
            { key: 'date', label: 'Date', render: (r) => fmtDate(r.created_at) },
            { key: 'time', label: 'Time', render: (r) => fmtTime(r.created_at) },
            { key: 'user_name', label: 'User', render: (r) => <span style={{ fontWeight: 600 }}>{r.user_name || 'System'}</span> },
            { key: 'action', label: 'Action', render: (r) => <Badge>{r.action}</Badge> },
            { key: 'module', label: 'Module' },
            { key: 'ip_address', label: 'IP Address', render: (r) => <code style={{ fontSize: 12 }}>{r.ip_address || '—'}</code> },
            { key: 'details', label: 'Details', render: (r) => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{shortenDetails(r.details)}</span> },
          ]}
          rows={rows}
          empty="No matching audit entries."
        />
      </Card>
    </>
  );
}
