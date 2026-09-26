import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useResource } from '../hooks/useResource.js';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { PageHeader, Card, Badge, Notice, ErrorBox, Loading, money } from '../components/ui.jsx';

const STATUSES = ['Pending', 'Approved', 'Rejected', 'Paid'];

export default function Claims() {
  const { user } = useAuth();
  const role = String(user?.role || '');
  const canReview = role === 'Admin' || role === 'HR';
  const canDisburse = role === 'Admin' || role === 'Finance';
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useResource('/api/claims');
  const [notice, setNotice] = useState({ kind: 'info', msg: '' });
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);

  const claims = data || [];
  const counts = useMemo(() => {
    const map = {};
    for (const c of claims) map[c.status] = (map[c.status] || 0) + 1;
    return map;
  }, [claims]);
  const rows = status ? claims.filter((c) => c.status === status) : claims;

  useEffect(() => {
    if (!selectedId) { setDetail(null); return undefined; }
    let alive = true;
    api.get(`/api/claims/${selectedId}`)
      .then((payload) => { if (alive) setDetail(payload?.data ?? payload); })
      .catch((e) => { if (alive) setNotice({ kind: 'error', msg: e.message }); });
    return () => { alive = false; };
  }, [selectedId]);

  async function decide(id, next) {
    try {
      const updated = await api.post(`/api/claims/${id}/decision`, { status: next });
      setNotice({ kind: 'success', msg: `Claim marked ${next}.${next === 'Approved' ? ' Finance can now disburse it.' : ''}` });
      setDetail(updated?.data ?? updated);
      reload();
    } catch (e) {
      setNotice({ kind: 'error', msg: e.message });
    }
  }

  async function disburse(id) {
    if (!window.confirm('Finance disbursement approval: release this reimbursement to the employee?')) return;
    try {
      const updated = await api.post(`/api/claims/${id}/disburse`, {});
      setNotice({ kind: 'success', msg: 'Claim approved and disbursed by Finance — marked Paid.' });
      setDetail(updated?.data ?? updated);
      reload();
    } catch (e) {
      setNotice({ kind: 'error', msg: e.message });
    }
  }

  return (
    <>
      <PageHeader title="Claims Management" subtitle="Manually review and process employee reimbursement claims." right={
        <Link to="/claims/new" className="btn btn-primary">+ Log Claim</Link>
      } />
      <Notice kind={notice.kind}>{notice.msg}</Notice>
      <div className="filters-bar">
        <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Claims ({claims.length})</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s} ({counts[s] || 0})</option>)}
        </select>
      </div>
      <div className="claims-grid">
        <Card title="Claims">
          {loading ? <Loading /> : error ? <ErrorBox error={error} /> : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Employee</th><th>Category</th><th>Amount</th><th>Receipt Date</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {rows.length ? rows.map((c) => (
                    <tr key={c.id} style={selectedId === c.id ? { background: 'var(--primary-light)' } : undefined}>
                      <td style={{ fontWeight: 600 }}>{c.employee_name}</td>
                      <td>{c.category}</td>
                      <td>{money(c.amount)}</td>
                      <td>{c.claim_date}</td>
                      <td><Badge>{c.status}</Badge></td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedId(c.id)}>View</button>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={6} className="empty-state">No claims found.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Claim Detail" body>
          {detail ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{money(detail.amount)}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{detail.claim_number}</div>
                </div>
                <Badge>{detail.status}</Badge>
              </div>
              <div style={{ fontSize: 13 }}>
                <div style={{ marginBottom: 8 }}><span style={{ color: 'var(--text-muted)' }}>Employee:</span> {detail.employee_name}</div>
                <div style={{ marginBottom: 8 }}><span style={{ color: 'var(--text-muted)' }}>Category:</span> {detail.category}</div>
                <div style={{ marginBottom: 8 }}><span style={{ color: 'var(--text-muted)' }}>Receipt date:</span> {detail.claim_date}</div>
                <div style={{ marginTop: 16 }}>
                  <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Business purpose</div>
                  <div style={{ background: 'var(--surface-alt)', padding: 10, borderRadius: 'var(--radius)', whiteSpace: 'pre-wrap' }}>
                    {detail.description || '—'}
                  </div>
                </div>
              </div>
              {detail.status === 'Pending' && canReview && (
                <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <button className="btn btn-success" style={{ flex: 1 }} onClick={() => decide(detail.id, 'Approved')}>Approve</button>
                  <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => decide(detail.id, 'Rejected')}>Reject</button>
                </div>
              )}
              {detail.status === 'Pending' && !canReview && (
                <div style={{ ...{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }, fontSize: 12, color: 'var(--text-muted)' }}>
                  Awaiting HR review.
                </div>
              )}
              {detail.status === 'Approved' && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                    Approved — requires Finance disbursement before payment.
                  </div>
                  {canDisburse && (
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => disburse(detail.id)}>
                      Approve Disbursement (Finance)
                    </button>
                  )}
                </div>
              )}
              {detail.status === 'Paid' && detail.disbursed_at && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
                  Disbursed by Finance on {String(detail.disbursed_at).slice(0, 10)}.
                </div>
              )}
            </>
          ) : (
            <div className="empty-state"><p>Select a claim to review its receipt and business purpose.</p></div>
          )}
        </Card>
      </div>
    </>
  );
}
