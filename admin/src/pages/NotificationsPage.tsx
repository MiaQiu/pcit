import { useState, useEffect } from 'react';
import { getUsers, UserSummary } from '../api/adminApi';
import { useEnv, PROD_API_URL } from '../context/EnvContext';
import UserList from '../components/notifications/UserList';
import NotificationSender from '../components/notifications/NotificationSender';

export default function NotificationsPage() {
  const { env, prodToken } = useEnv();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    // Compute opts inside the effect so it always captures the latest env + prodToken
    const opts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;
    setLoading(true);
    setUsers([]);
    setSelectedIds(new Set());
    setFetchError(null);
    getUsers(opts)
      .then(setUsers)
      .catch((err) => {
        console.error('Failed to load users:', err);
        setFetchError(`Failed to load ${env.toUpperCase()} users: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [env, prodToken]);

  const toggleUser = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const withTokens = users.filter((u) => u.hasPushToken).map((u) => u.id);
    setSelectedIds(new Set(withTokens));
  };

  const selectNone = () => setSelectedIds(new Set());

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p className="page-subtitle">
            Send push notifications to users
            {env === 'prod' && <span className="env-badge prod">PROD</span>}
          </p>
        </div>
      </div>

      <div className="notifications-layout">
        <div className="notifications-users">
          {loading ? (
            <div className="loading-state">Loading users...</div>
          ) : fetchError ? (
            <div className="error-state">{fetchError}</div>
          ) : (
            <UserList
              users={users}
              selectedIds={selectedIds}
              onToggle={toggleUser}
              onSelectAll={selectAll}
              onSelectNone={selectNone}
            />
          )}
        </div>
        <div className="notifications-sender">
          <NotificationSender selectedIds={selectedIds} />
        </div>
      </div>
    </div>
  );
}
