import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserSummary } from '../../api/adminApi';

interface Props {
  users: UserSummary[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

export default function UserList({ users, selectedIds, onToggle, onSelectAll, onSelectNone }: Props) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');

  const withToken = users.filter((u) => u.hasPushToken);
  const filtered = filter
    ? users.filter((u) => u.id.toLowerCase().includes(filter.toLowerCase()))
    : users;

  return (
    <div>
      <div className="user-list-header">
        <span>{selectedIds.size} of {withToken.length} users with push tokens selected</span>
        <div className="user-list-actions">
          <button className="btn-link" onClick={onSelectAll}>Select all with tokens</button>
          <button className="btn-link" onClick={onSelectNone}>Clear</button>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Filter by user ID..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            fontSize: 14,
            fontFamily: 'inherit',
            width: 300,
            outline: 'none',
          }}
        />
      </div>

      <table className="data-table compact">
        <thead>
          <tr>
            <th style={{ width: 40 }}></th>
            <th>User ID</th>
            <th>Push</th>
            <th>Sessions</th>
            <th>Joined</th>
            <th style={{ width: 100 }}>Reports</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((u) => (
            <tr key={u.id} className={!u.hasPushToken ? 'row-disabled' : ''}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedIds.has(u.id)}
                  onChange={() => onToggle(u.id)}
                  disabled={!u.hasPushToken}
                />
              </td>
              <td className="cell-mono">{u.id}</td>
              <td>
                <span className={`status-dot ${u.hasPushToken ? 'active' : 'inactive'}`} />
              </td>
              <td>{u.sessionCount}</td>
              <td className="cell-date">{new Date(u.createdAt).toLocaleDateString()}</td>
              <td>
                <button
                  className="btn-secondary-sm"
                  onClick={() => navigate(`/users/${u.id}/weekly-reports`)}
                >
                  Weekly
                </button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-state">
                {filter ? 'No users match filter' : 'No users found'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
