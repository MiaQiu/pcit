import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getUserProfile, UserProfile, UserSummary } from '../api/adminApi';
import { useEnv, PROD_API_URL } from '../context/EnvContext';

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { env, prodToken } = useEnv();
  const opts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;

  const user = (location.state as { user?: UserSummary } | null)?.user;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const callOpts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;
    setLoading(true);
    setError(null);
    getUserProfile(userId, callOpts)
      .then(setProfile)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, [userId, env, prodToken]);

  function fmt(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn-secondary btn-sm" onClick={() => navigate('/users')}>← Back</button>
          <div>
            <h1>{user?.name ?? userId}</h1>
            <p className="page-subtitle">
              {user?.email && <span style={{ marginRight: 12 }}>{user.email}</span>}
              <span className="monospace" style={{ fontSize: 12, color: '#888' }}>{userId}</span>
              {env === 'prod' && <span className="env-badge prod">PROD</span>}
            </p>
          </div>
        </div>
      </div>

      {loading && <div className="loading-state">Loading…</div>}
      {error && <div className="error-state">{error}</div>}

      {!loading && !error && profile && (
        <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
          {/* Lessons completed */}
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              Lessons Completed ({profile.lessons.length})
            </h2>
            {profile.lessons.length === 0 ? (
              <div className="empty-state">No lessons completed.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Lesson</th>
                    <th>Completed At</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.lessons.map((l) => (
                    <tr key={l.lessonId}>
                      <td>{l.module ?? '—'}</td>
                      <td>{l.title}</td>
                      <td>{fmt(l.completedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Sessions */}
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              Sessions ({profile.sessions.length})
            </h2>
            {profile.sessions.length === 0 ? (
              <div className="empty-state">No sessions found.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Mode</th>
                    <th>Status</th>
                    <th>Score</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="monospace" style={{ fontSize: 12 }}>{s.id}</td>
                      <td>{s.mode}</td>
                      <td>
                        <span className={`status-badge status-${s.status.toLowerCase()}`}>
                          {s.status}
                        </span>
                      </td>
                      <td>{s.overallScore ?? '—'}</td>
                      <td>{fmt(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
