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

  const envOpts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;

  useEffect(() => {
    setLoading(true);
    setSelectedIds(new Set());
    getUsers(envOpts)
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [env]);

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
