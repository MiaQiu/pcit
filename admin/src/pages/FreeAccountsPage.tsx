import { useState, useEffect } from 'react';
import {
  getFreeAccountWhitelist,
  addToFreeAccountWhitelist,
  removeFromFreeAccountWhitelist,
  toggleFreeAccount,
  getUsers,
  WhitelistEntry,
  UserSummary,
} from '../api/adminApi';
import { useEnv, PROD_API_URL } from '../context/EnvContext';

export default function FreeAccountsPage() {
  const { env, prodToken } = useEnv();

  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [grantedUsers, setGrantedUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [emailInput, setEmailInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const callOpts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getFreeAccountWhitelist(callOpts),
      getUsers(callOpts),
    ])
      .then(([wl, users]) => {
        setEntries(wl);
        setGrantedUsers(users.filter(u => u.isFreeAccount));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [env, prodToken]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const email = emailInput.trim();
    if (!email) return;
    setAdding(true);
    setAddResult(null);
    setAddError(null);
    try {
      const { entry, userGranted } = await addToFreeAccountWhitelist(email, callOpts);
      setEntries(prev => [entry, ...prev.filter(e => e.id !== entry.id)]);
      if (userGranted) {
        // Refresh granted users list so the newly-granted user appears
        const users = await getUsers(callOpts);
        setGrantedUsers(users.filter(u => u.isFreeAccount));
      }
      setEmailInput('');
      setAddResult(userGranted
        ? `Added and immediately granted to ${email} (account already exists).`
        : `Added ${email} to whitelist. Free access will be granted when they sign up.`
      );
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveWhitelist(entry: WhitelistEntry) {
    if (!window.confirm(`Remove ${entry.email} from the whitelist?\n\nNote: this does NOT revoke free access if they have already signed up.`)) return;
    setRemovingId(entry.id);
    try {
      await removeFromFreeAccountWhitelist(entry.id, callOpts);
      setEntries(prev => prev.filter(e => e.id !== entry.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setRemovingId(null);
    }
  }

  async function handleRevokeUser(user: UserSummary) {
    if (!window.confirm(`Revoke free access for ${user.name} (${user.email})?\n\nThey will be subject to normal subscription rules.`)) return;
    setRevokingId(user.id);
    try {
      await toggleFreeAccount(user.id, false, callOpts);
      setGrantedUsers(prev => prev.filter(u => u.id !== user.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to revoke');
    } finally {
      setRevokingId(null);
    }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Free Accounts</h1>
          <p className="page-subtitle">
            {grantedUsers.length} active · {entries.filter(e => !grantedUsers.some(u => u.email.toLowerCase() === e.email.toLowerCase())).length} pending signup
            {env === 'prod' && <span className="env-badge prod">PROD</span>}
          </p>
        </div>
      </div>

      {/* Add form */}
      <div style={{
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '20px 24px',
        marginBottom: 32,
      }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>Grant free access</h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
          If the account exists, access is granted immediately. Otherwise the email is whitelisted and access is granted automatically at signup.
        </p>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="email"
            placeholder="user@example.com"
            value={emailInput}
            onChange={e => setEmailInput(e.target.value)}
            disabled={adding}
            style={{
              flex: 1,
              maxWidth: 360,
              height: 38,
              borderRadius: 8,
              border: '1px solid #d1d5db',
              padding: '0 12px',
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={adding || !emailInput.trim()}
            style={{ height: 38 }}
          >
            {adding ? 'Granting…' : 'Grant'}
          </button>
        </form>
        {addResult && <p style={{ marginTop: 10, color: '#166534', fontSize: 13 }}>{addResult}</p>}
        {addError && <p style={{ marginTop: 10, color: '#dc2626', fontSize: 13 }}>{addError}</p>}
      </div>

      {loading && <div className="loading-state">Loading…</div>}
      {error && <div className="error-state">{error}</div>}

      {!loading && !error && (<>

        {/* Granted users (already signed up) */}
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
          Active — signed up ({grantedUsers.length})
        </h2>
        {grantedUsers.length === 0 ? (
          <div className="empty-state" style={{ marginBottom: 32 }}>No granted users yet.</div>
        ) : (
          <table className="data-table" style={{ marginBottom: 40 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Joined</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {grantedUsers.map(user => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{user.email}</td>
                  <td style={{ fontSize: 13, color: '#6b7280' }}>{fmt(user.createdAt)}</td>
                  <td>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: '2px 10px', height: 26 }}
                      disabled={revokingId === user.id}
                      onClick={() => handleRevokeUser(user)}
                    >
                      {revokingId === user.id ? '…' : 'Revoke'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Whitelist (pending signup) — hide entries where the user already signed up */}
        {(() => {
          const activeEmails = new Set(grantedUsers.map(u => u.email.toLowerCase()));
          const pending = entries.filter(e => !activeEmails.has(e.email.toLowerCase()));
          return (<>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
              Pending signup — whitelist ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <div className="empty-state">No pending emails.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Whitelisted</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map(entry => (
                    <tr key={entry.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{entry.email}</td>
                      <td style={{ fontSize: 13, color: '#6b7280' }}>{fmt(entry.createdAt)}</td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 12, padding: '2px 10px', height: 26 }}
                          disabled={removingId === entry.id}
                          onClick={() => handleRemoveWhitelist(entry)}
                        >
                          {removingId === entry.id ? '…' : 'Remove'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>);
        })()}

      </>)}
    </div>
  );
}
