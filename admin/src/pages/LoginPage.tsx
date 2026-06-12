import { useState, FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const { login, therapistLogin } = useAuth();
  const [mode, setMode] = useState<'admin' | 'therapist'>('admin');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'admin') {
        await login(password);
      } else {
        await therapistLogin(email, password);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">N</div>
        <h1>Nora Portal</h1>
        <div className="login-tab-bar">
          <button
            type="button"
            className={`login-tab${mode === 'admin' ? ' active' : ''}`}
            onClick={() => { setMode('admin'); setError(''); }}
          >
            Admin
          </button>
          <button
            type="button"
            className={`login-tab${mode === 'therapist' ? ' active' : ''}`}
            onClick={() => { setMode('therapist'); setError(''); }}
          >
            Therapist
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          {mode === 'therapist' && (
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              disabled={loading}
            />
          )}
          <input
            type="password"
            placeholder={mode === 'admin' ? 'Admin password' : 'Password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus={mode === 'admin'}
            disabled={loading}
          />
          {error && <p className="login-error">{error}</p>}
          <button type="submit" disabled={loading || !password || (mode === 'therapist' && !email)}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
