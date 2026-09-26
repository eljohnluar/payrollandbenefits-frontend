import { useEffect } from 'react';
import { money } from '../lib/format.js';

export { money };

export function statusBadge(status) {
  return (
    {
      Paid: 'badge-success', Approved: 'badge-success', Released: 'badge-success', Closed: 'badge-success',
      Active: 'badge-success', Completed: 'badge-success',
      Draft: 'badge-warning', Pending: 'badge-warning', 'Pending Finance Approval': 'badge-warning',
      Rejected: 'badge-danger', Resigned: 'badge-danger', Terminated: 'badge-danger', Cancelled: 'badge-danger',
      Failed: 'badge-danger', 'On Hold': 'badge-danger',
      Submitted: 'badge-info', Processing: 'badge-info', Enrolled: 'badge-info',
    }[status] || 'badge-muted'
  );
}

export function Badge({ children }) {
  const cls = statusBadge(children);
  return <span className={`badge ${cls}`}>{children}</span>;
}

export function PageHeader({ title, subtitle, right }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Stat({ label, value, sub, kind = 'neutral' }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className={`stat-change ${kind}`}>{sub}</div>}
    </div>
  );
}

export function StatsGrid({ children }) {
  return <div className="stats-grid">{children}</div>;
}

export function Card({ title, right, children, body }) {
  return (
    <div className="card">
      {(title || right) && (
        <div className="card-header">
          <h2>{title}</h2>
          {right}
        </div>
      )}
      {body ? <div className="card-body">{children}</div> : children}
    </div>
  );
}

export function Loading({ text = 'Loading…' }) {
  void text;
  return (
    <div className="skel-page" aria-busy="true" aria-label="Loading content">
      <div className="skel skel-title" />
      <div className="stats-grid">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skel skel-stat" />)}
      </div>
      <div className="skel skel-card" />
      <div className="skel skel-card skel-card-sm" />
    </div>
  );
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="alert error">{error}</div>;
}

export function Notice({ children, kind = 'info' }) {
  if (!children) return null;
  return <div className={`alert ${kind}`}>{children}</div>;
}

export function DataTable({ columns, rows, loading, error, empty = 'No records yet.', foot }) {
  const head = (
    <thead>
      <tr>
        {columns.map((c) => (
          <th key={c.key} className={c.align === 'right' ? 'num' : undefined}>{c.label}</th>
        ))}
      </tr>
    </thead>
  );
  if (loading) {
    return (
      <div className="table-wrap" aria-busy="true" aria-label="Loading table">
        <table>
          {head}
          <tbody>
            {[0, 1, 2, 3, 4, 5].map((r) => (
              <tr key={r}>
                {columns.map((c, ci) => (
                  <td key={c.key} className={c.align === 'right' ? 'num' : undefined}>
                    <span className="skel skel-cell" style={{ width: `${45 + ((r * 23 + ci * 17) % 50)}%` }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (error) return <ErrorBox error={error} />;
  return (
    <div className="table-wrap">
      <table>
        {head}
        <tbody>
          {rows && rows.length > 0 ? (
            rows.map((row, i) => (
              <tr key={row.id ?? i}>
                {columns.map((c) => (
                  <td key={c.key} className={c.align === 'right' ? 'num' : undefined}>
                    {c.render ? c.render(row) : row[c.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          )}
        </tbody>
        {foot && rows && rows.length > 0 && (
          <tfoot>
            <tr>
              {foot.map((cell, i) => (
                <td key={i} className={columns[i]?.align === 'right' ? 'num' : undefined}>{cell}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', zIndex: 1000, overflowY: 'auto' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: wide ? 720 : 480, boxShadow: '0 20px 60px rgba(17,24,39,.25)' }}
      >
        <div className="card-header">
          <h2>{title}</h2>
          <button className="btn ghost" style={{ padding: '4px 9px' }} onClick={onClose}>Close</button>
        </div>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
