import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCodingReviewSessions, CodingReviewSession } from '../api/adminApi';
import { useEnv, PROD_API_URL } from '../context/EnvContext';

function AccuracyBadge({ pct }: { pct: number }) {
  const color = pct >= 90 ? '#065f46' : pct >= 70 ? '#92400e' : '#991b1b';
  const bg = pct >= 90 ? '#d1fae5' : pct >= 70 ? '#fef3c7' : '#fee2e2';
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: bg, color }}>
      {pct}%
    </span>
  );
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function CodingReviewListPage() {
  const navigate = useNavigate();
  const { env, prodToken } = useEnv();
  const [sessions, setSessions] = useState<CodingReviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('all');

  useEffect(() => {
    const opts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;
    setLoading(true);
    setError(null);
    getCodingReviewSessions(opts)
      .then(setSessions)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [env, prodToken]);

  const filtered = sessions.filter(s => {
    if (filter === 'pending') return !s.codingReviewedAt;
    if (filter === 'reviewed') return !!s.codingReviewedAt;
    return true;
  });

  const pending = sessions.filter(s => !s.codingReviewedAt).length;
  const reviewed = sessions.filter(s => !!s.codingReviewedAt).length;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Coding Review</h1>
        <div className="status-strip">
          <span className="status-chip">Total: {sessions.length}</span>
          <span className="status-chip status-chip-amber">Pending: {pending}</span>
          <span className="status-chip status-chip-green">Reviewed: {reviewed}</span>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        {(['all', 'pending', 'reviewed'] as const).map(f => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading && <div className="loading-state">Loading sessions…</div>}
      {error && <div className="error-state">{error}</div>}

      {!loading && !error && (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Mode</th>
                <th>Language</th>
                <th>Date</th>
                <th>Accuracy</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-light)', padding: '32px' }}>No sessions found</td></tr>
              )}
              {filtered.map(s => (
                <tr
                  key={s.id}
                  className="clickable-row"
                  onClick={() => navigate(`/coding-review/${s.id}`)}
                >
                  <td><code style={{ fontSize: 12 }}>{s.id}</code></td>
                  <td><span className="mode-badge">{s.mode}</span></td>
                  <td style={{ fontSize: 13 }}>{s.language ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmt(s.createdAt)}</td>
                  <td>
                    {s.accuracy !== null
                      ? <AccuracyBadge pct={s.accuracy} />
                      : <span style={{ color: 'var(--text-light)' }}>—</span>}
                  </td>
                  <td>
                    {s.codingReviewedAt
                      ? <span className="badge badge-green">Reviewed</span>
                      : <span className="badge badge-amber">Pending</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
