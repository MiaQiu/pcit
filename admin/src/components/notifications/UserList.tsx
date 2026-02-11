import { UserSummary } from '../../api/adminApi';

interface Props {
  users: UserSummary[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
}

export default function UserList({ users, selectedIds, onToggle, onSelectAll, onSelectNone }: Props) {
  const withToken = users.filter((u) => u.hasPushToken);

  return (
    <div>
      <div className="user-list-header">
        <span>{selectedIds.size} of {withToken.length} users with push tokens selected</span>
        <div className="user-list-actions">
          <button className="btn-link" onClick={onSelectAll}>Select all with tokens</button>
          <button className="btn-link" onClick={onSelectNone}>Clear</button>
        </div>
      </div>

      <table className="data-table compact">
        <thead>
          <tr>
            <th style={{ width: 40 }}></th>
            <th>Name</th>
            <th>Email</th>
            <th>Push</th>
            <th>Sessions</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className={!u.hasPushToken ? 'row-disabled' : ''}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedIds.has(u.id)}
                  onChange={() => onToggle(u.id)}
                  disabled={!u.hasPushToken}
                />
              </td>
              <td>{u.name}</td>
              <td className="cell-mono">{u.email}</td>
              <td>
                <span className={`status-dot ${u.hasPushToken ? 'active' : 'inactive'}`} />
              </td>
              <td>{u.sessionCount}</td>
              <td className="cell-date">{new Date(u.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-state">No users found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
