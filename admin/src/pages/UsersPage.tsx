import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers, UserSummary } from '../api/adminApi';
import { useEnv, PROD_API_URL } from '../context/EnvContext';

export default function UsersPage() {
  const { env, prodToken } = useEnv();
  const opts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const callOpts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;
    setLoading(true);
    setError(null);
    getUsers(callOpts)
      .then(setUsers)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load users'))
      .finally(() => setLoading(false));
  }, [env, prodToken]);

  function fmt(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="page-subtitle">
            {users.length} registered users
            {env === 'prod' && <span className="env-badge prod">PROD</span>}
          </p>
        </div>
      </div>

      {loading && <div className="loading-state">Loading…</div>}
      {error && <div className="error-state">{error}</div>}

      {!loading && !error && (
        users.length === 0 ? (
          <div className="empty-state">No users found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Last Active</th>
                <th>Sessions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <button
                      className="link-btn monospace"
                      onClick={() => navigate(`/users/${u.id}`, { state: { user: u, opts } })}
                    >
                      {u.id}
                    </button>
                  </td>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{fmt(u.createdAt)}</td>
                  <td>{fmt(u.lastActiveAt)}</td>
                  <td>{u.sessionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}
