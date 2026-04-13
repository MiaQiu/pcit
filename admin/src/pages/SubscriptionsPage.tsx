import { useState, useEffect } from 'react';
import { getSubscriptions, sendTrialExpiryEmails, SubscriptionUser } from '../api/adminApi';
import { useEnv, PROD_API_URL } from '../context/EnvContext';

type SortField = 'name' | 'email' | 'createdAt' | 'subscriptionStatus' | 'subscriptionPlan' | 'trialEndDate' | 'subscriptionEndDate';
type SortDir = 'asc' | 'desc';

const STATUS_COLORS: Record<string, string> = {
  TRIAL: '#f59e0b',
  ACTIVE: '#10b981',
  EXPIRED: '#ef4444',
  CANCELLED: '#6b7280',
  NONE: '#9ca3af',
  INACTIVE: '#9ca3af',
};

const STATUS_FILTER_OPTIONS = ['', 'TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'NONE', 'INACTIVE'];

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function fmt(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function SubscriptionsPage() {
  const { env, prodToken } = useEnv();

  const [users, setUsers] = useState<SubscriptionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ found: number; sent: number; failed: number } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [daysInput, setDaysInput] = useState('3');

  useEffect(() => {
    const callOpts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;
    setLoading(true);
    setError(null);
    getSubscriptions(statusFilter || undefined, callOpts)
      .then(setUsers)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [env, prodToken, statusFilter]);

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function sortIndicator(field: SortField) {
    if (field !== sortField) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  const sorted = [...users].sort((a, b) => {
    let av = (a[sortField] ?? '') as string;
    let bv = (b[sortField] ?? '') as string;
    const cmp = av.localeCompare(bv, undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  async function handleSendEmails() {
    const days = parseInt(daysInput, 10);
    if (isNaN(days) || days < 1 || days > 30) {
      alert('Days must be between 1 and 30');
      return;
    }
    if (!window.confirm(`Send trial expiry reminder emails to all users whose trial ends in ${days} day${days !== 1 ? 's' : ''}?`)) return;

    const callOpts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;
    setSending(true);
    setSendResult(null);
    setSendError(null);
    try {
      const result = await sendTrialExpiryEmails(days, callOpts);
      setSendResult({ found: result.found, sent: result.sent, failed: result.failed });
    } catch (err: unknown) {
      setSendError(err instanceof Error ? err.message : 'Failed to send emails');
    } finally {
      setSending(false);
    }
  }

  // Stats
  const countByStatus = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.subscriptionStatus] = (acc[u.subscriptionStatus] ?? 0) + 1;
    return acc;
  }, {});

  const thStyle = { cursor: 'pointer', userSelect: 'none' as const, whiteSpace: 'nowrap' as const };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Subscriptions</h1>
          <p className="page-subtitle">
            {users.length} user{users.length !== 1 ? 's' : ''}
            {statusFilter ? ` with status ${statusFilter}` : ''}
            {env === 'prod' && <span className="env-badge prod">PROD</span>}
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {Object.entries(countByStatus).map(([status, count]) => (
          <div key={status} style={{
            background: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={{
              display: 'inline-block',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: STATUS_COLORS[status] ?? '#9ca3af',
            }} />
            <span style={{ fontWeight: 600 }}>{count}</span>
            <span style={{ color: '#6b7280', fontSize: 13 }}>{status}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Filter by status</label>
          <select
            className="tag-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ height: 36, paddingLeft: 8, paddingRight: 8 }}
          >
            {STATUS_FILTER_OPTIONS.map(s => (
              <option key={s} value={s}>{s || 'All statuses'}</option>
            ))}
          </select>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
              Send expiry reminders — trial ending in
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                min={1}
                max={30}
                value={daysInput}
                onChange={(e) => setDaysInput(e.target.value)}
                style={{ width: 56, height: 36, borderRadius: 6, border: '1px solid #d1d5db', padding: '0 8px', fontSize: 14 }}
              />
              <span style={{ fontSize: 14, color: '#374151' }}>days</span>
              <button
                className="btn btn-primary"
                onClick={handleSendEmails}
                disabled={sending}
                style={{ height: 36 }}
              >
                {sending ? 'Sending…' : 'Send Emails'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {sendResult && (
        <div className="success-banner" style={{ marginBottom: 16 }}>
          Emails sent — found: {sendResult.found}, sent: {sendResult.sent}, failed: {sendResult.failed}
        </div>
      )}
      {sendError && (
        <div className="error-state" style={{ marginBottom: 16 }}>{sendError}</div>
      )}

      {loading && <div className="loading-state">Loading…</div>}
      {error && <div className="error-state">{error}</div>}

      {!loading && !error && (
        sorted.length === 0 ? (
          <div className="empty-state">No users found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={thStyle} onClick={() => handleSort('name')}>Name{sortIndicator('name')}</th>
                <th style={thStyle} onClick={() => handleSort('email')}>Email{sortIndicator('email')}</th>
                <th style={thStyle} onClick={() => handleSort('subscriptionStatus')}>Status{sortIndicator('subscriptionStatus')}</th>
                <th style={thStyle} onClick={() => handleSort('subscriptionPlan')}>Plan{sortIndicator('subscriptionPlan')}</th>
                <th style={thStyle} onClick={() => handleSort('trialEndDate')}>Trial End{sortIndicator('trialEndDate')}</th>
                <th style={thStyle} onClick={() => handleSort('subscriptionEndDate')}>Sub End{sortIndicator('subscriptionEndDate')}</th>
                <th style={thStyle} onClick={() => handleSort('createdAt')}>Joined{sortIndicator('createdAt')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => {
                const trialDays = daysUntil(u.trialEndDate);
                return (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{u.email}</td>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        background: `${STATUS_COLORS[u.subscriptionStatus] ?? '#9ca3af'}22`,
                        color: STATUS_COLORS[u.subscriptionStatus] ?? '#6b7280',
                        borderRadius: 12,
                        padding: '2px 10px',
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {u.subscriptionStatus}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: '#4b5563' }}>{u.subscriptionPlan}</td>
                    <td>
                      {u.trialEndDate ? (
                        <span style={{ color: trialDays !== null && trialDays <= 3 && trialDays >= 0 ? '#f59e0b' : undefined }}>
                          {fmt(u.trialEndDate)}
                          {trialDays !== null && trialDays >= 0 && trialDays <= 7 && (
                            <span style={{ fontSize: 11, marginLeft: 4, color: trialDays <= 3 ? '#f59e0b' : '#9ca3af' }}>
                              ({trialDays}d)
                            </span>
                          )}
                          {trialDays !== null && trialDays < 0 && (
                            <span style={{ fontSize: 11, marginLeft: 4, color: '#ef4444' }}>(expired)</span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td>{fmt(u.subscriptionEndDate)}</td>
                    <td>{fmt(u.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}
