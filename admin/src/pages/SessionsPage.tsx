import { useState, useEffect, useCallback } from 'react';
import { searchSessions, rerunCdiCoaching, SessionSummary } from '../api/adminApi';
import { useEnv, PROD_API_URL } from '../context/EnvContext';

type RunState = 'idle' | 'running' | 'done' | 'error';

export default function SessionsPage() {
  const { env, prodToken } = useEnv();
  const opts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;

  const [sessionId, setSessionId] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Per-row rerun state: sessionId → { state, error }
  const [rerunState, setRerunState] = useState<Record<string, { state: RunState; error?: string }>>({});

  const runSearch = useCallback(async (params: Parameters<typeof searchSessions>[0], callOpts: typeof opts) => {
    setLoading(true);
    setSearchError(null);
    setSessions([]);
    try {
      const results = await searchSessions(params, callOpts);
      setSessions(results);
      setSearched(true);
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load sessions with no coaching cards on mount and env change
  useEffect(() => {
    const callOpts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;
    setRerunState({});
    runSearch({ limit: 20 }, callOpts);
  }, [env, prodToken, runSearch]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(
      {
        sessionId: sessionId.trim() || undefined,
        userId: userId.trim() || undefined,
        from: from || undefined,
        to: to || undefined,
        limit: 50,
      },
      opts
    );
  };

  const handleRerun = async (id: string) => {
    setRerunState((prev) => ({ ...prev, [id]: { state: 'running' } }));
    try {
      await rerunCdiCoaching(id, opts);
      setRerunState((prev) => ({ ...prev, [id]: { state: 'done' } }));
      // Update hasCoachingCards in local state
      setSessions((prev) => prev.map((s) => s.id === id ? { ...s, hasCoachingCards: true } : s));
    } catch (err: unknown) {
      setRerunState((prev) => ({
        ...prev,
        [id]: { state: 'error', error: err instanceof Error ? err.message : 'Failed' },
      }));
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Sessions</h1>
          <p className="page-subtitle">
            Search CDI sessions and re-run coaching
            {env === 'prod' && <span className="env-badge prod">PROD</span>}
          </p>
        </div>
      </div>

      <form className="sessions-search-form" onSubmit={handleSearch}>
        <input
          className="form-input"
          placeholder="Session ID"
          value={sessionId}
          onChange={(e) => setSessionId(e.target.value)}
        />
        <input
          className="form-input"
          placeholder="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <input
          className="form-input"
          type="date"
          title="From"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          className="form-input"
          type="date"
          title="To"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {searchError && <div className="error-state">{searchError}</div>}

      {searched && !loading && (
        sessions.length === 0 ? (
          <div className="empty-state">No CDI sessions found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Session ID</th>
                <th>User ID</th>
                <th>Status</th>
                <th>Error</th>
                <th>Created At</th>
                <th>Cards</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const rs = rerunState[s.id];
                return (
                  <tr key={s.id}>
                    <td className="monospace">{s.id}</td>
                    <td className="monospace">{s.userId}</td>
                    <td>
                      <span className={`status-badge status-${s.analysisStatus.toLowerCase()}`}>
                        {s.analysisStatus}
                      </span>
                    </td>
                    <td className="session-error-cell">
                      {s.analysisError && <span className="session-error" title={s.analysisError}>{s.analysisError}</span>}
                      {s.enrichmentError && <span className="session-error" title={s.enrichmentError}>{s.enrichmentError}</span>}
                    </td>
                    <td>{new Date(s.createdAt).toLocaleString()}</td>
                    <td>{s.hasCoachingCards ? '✓' : '—'}</td>
                    <td>
                      <div className="rerun-cell">
                        <button
                          className="btn-secondary btn-sm"
                          onClick={() => handleRerun(s.id)}
                          disabled={rs?.state === 'running'}
                        >
                          {rs?.state === 'running' ? 'Running…' : 'Re-run CDI Coaching'}
                        </button>
                        {rs?.state === 'done' && <span className="rerun-success">✓ Done</span>}
                        {rs?.state === 'error' && <span className="rerun-error">{rs.error}</span>}
                      </div>
                    </td>
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
