import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers, updateUserTag, UserSummary } from '../api/adminApi';
import { useEnv, PROD_API_URL } from '../context/EnvContext';

type SortField = 'id' | 'name' | 'email' | 'createdAt' | 'lastActiveAt' | 'sessionCount' | 'tag' | 'childBirthday' | 'issue' | 'wacbTotalScore';
type SortDir = 'asc' | 'desc';

export default function UsersPage() {
  const { env, prodToken } = useEnv();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    const callOpts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;
    setLoading(true);
    setError(null);
    getUsers(callOpts)
      .then(setUsers)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load users'))
      .finally(() => setLoading(false));
  }, [env, prodToken]);

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
    let av: string | number | null = a[sortField] as string | number | null;
    let bv: string | number | null = b[sortField] as string | number | null;
    if (av == null) av = '';
    if (bv == null) bv = '';
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return sortDir === 'asc' ? cmp : -cmp;
  });

  async function handleTagChange(userId: string, tag: 'user' | 'tester') {
    const callOpts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;
    try {
      await updateUserTag(userId, tag, callOpts);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, tag } : u));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update tag');
    }
  }

  function fmt(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  const thStyle = { cursor: 'pointer', userSelect: 'none' as const, whiteSpace: 'nowrap' as const };

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
        sorted.length === 0 ? (
          <div className="empty-state">No users found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={thStyle} onClick={() => handleSort('id')}>User ID{sortIndicator('id')}</th>
                <th style={thStyle} onClick={() => handleSort('name')}>Name{sortIndicator('name')}</th>
                <th style={thStyle} onClick={() => handleSort('email')}>Email{sortIndicator('email')}</th>
                <th style={thStyle} onClick={() => handleSort('createdAt')}>Joined{sortIndicator('createdAt')}</th>
                <th style={thStyle} onClick={() => handleSort('lastActiveAt')}>Last Active{sortIndicator('lastActiveAt')}</th>
                <th style={thStyle} onClick={() => handleSort('sessionCount')}>Sessions{sortIndicator('sessionCount')}</th>
                <th style={thStyle} onClick={() => handleSort('tag')}>Tag{sortIndicator('tag')}</th>
                <th style={thStyle} onClick={() => handleSort('childBirthday')}>Child Birthday{sortIndicator('childBirthday')}</th>
                <th style={thStyle} onClick={() => handleSort('issue')}>Issue{sortIndicator('issue')}</th>
                <th style={thStyle} onClick={() => handleSort('wacbTotalScore')}>WACB Score{sortIndicator('wacbTotalScore')}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((u) => (
                <tr key={u.id}>
                  <td>
                    <button
                      className="link-btn monospace"
                      onClick={() => navigate(`/users/${u.id}`, { state: { user: u } })}
                    >
                      {u.id}
                    </button>
                  </td>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{fmt(u.createdAt)}</td>
                  <td>{fmt(u.lastActiveAt)}</td>
                  <td>{u.sessionCount}</td>
                  <td>
                    <select
                      className="tag-select"
                      value={u.tag}
                      onChange={(e) => handleTagChange(u.id, e.target.value as 'user' | 'tester')}
                    >
                      <option value="user">user</option>
                      <option value="tester">tester</option>
                    </select>
                  </td>
                  <td>{fmt(u.childBirthday)}</td>
                  <td>{u.issue ?? '—'}</td>
                  <td>{u.wacbTotalScore ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}
