import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useEnv, PROD_API_URL } from '../../context/EnvContext';
import { syncToProd, SyncResult } from '../../api/adminApi';
import { apiFetchEnv } from '../../api/client';

export default function AdminLayout() {
  const { logout } = useAuth();
  const { env, setEnv, prodToken, setProdToken } = useEnv();

  // Prod login
  const [showProdLogin, setShowProdLogin] = useState(false);
  const [prodPassword, setProdPassword] = useState('');
  const [prodLoginError, setProdLoginError] = useState<string | null>(null);
  const [loggingInToProd, setLoggingInToProd] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleEnvClick = (target: 'dev' | 'prod') => {
    if (target === 'dev') {
      setEnv('dev');
      setShowProdLogin(false);
      return;
    }
    if (prodToken) {
      setEnv('prod');
    } else {
      setShowProdLogin(true);
    }
  };

  const handleProdLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingInToProd(true);
    setProdLoginError(null);
    try {
      const data = await apiFetchEnv<{ token: string }>(
        '/api/admin/auth/login',
        { method: 'POST', body: JSON.stringify({ password: prodPassword }) },
        { baseUrl: PROD_API_URL }
      );
      setProdToken(data.token);
      setEnv('prod');
      setShowProdLogin(false);
      setProdPassword('');
    } catch {
      setProdLoginError('Invalid password');
    } finally {
      setLoggingInToProd(false);
    }
  };

  async function handleSyncToProd() {
    if (!window.confirm('Push all lessons and keywords from dev to prod?\n\nThis will overwrite prod content but will not affect user data.')) {
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const result = await syncToProd();
      setSyncResult(result);
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">N</span>
          <span className="sidebar-title">Nora Admin</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/lessons" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} end>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            Lessons
          </NavLink>
          <NavLink to="/keywords" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Keywords
          </NavLink>
          <NavLink to="/notifications" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            Notifications
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Settings
          </NavLink>
        </nav>

        {/* Environment selector */}
        <div className="sidebar-env">
          <div className="env-label">Environment</div>
          <div className="env-toggle">
            <button
              className={`env-btn ${env === 'dev' ? 'active' : ''}`}
              onClick={() => handleEnvClick('dev')}
            >DEV</button>
            <button
              className={`env-btn ${env === 'prod' ? 'active' : ''}`}
              onClick={() => handleEnvClick('prod')}
            >PROD</button>
          </div>
          {showProdLogin && (
            <form className="prod-login-form" onSubmit={handleProdLogin}>
              <input
                type="password"
                className="prod-login-input"
                placeholder="Admin password"
                value={prodPassword}
                onChange={(e) => setProdPassword(e.target.value)}
                autoFocus
              />
              <button type="submit" className="prod-login-submit" disabled={loggingInToProd}>
                {loggingInToProd ? '…' : 'Connect'}
              </button>
              {prodLoginError && <div className="prod-login-error">{prodLoginError}</div>}
            </form>
          )}
        </div>

        <div className="sidebar-sync">
          <button className="sync-prod-btn" onClick={handleSyncToProd} disabled={syncing}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16,3 21,3 21,8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21,16 21,21 16,21"/><line x1="15" y1="15" x2="21" y2="21"/></svg>
            {syncing ? 'Syncing…' : 'Push to Prod'}
          </button>
          {syncResult && (
            <div className="sync-result sync-success">
              Synced: {syncResult.lessons} lessons, {syncResult.keywords} keywords
            </div>
          )}
          {syncError && (
            <div className="sync-result sync-error">{syncError}</div>
          )}
        </div>
        <button className="sidebar-logout" onClick={logout}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout
        </button>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
