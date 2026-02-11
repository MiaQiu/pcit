import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getUserWeeklyReports,
  toggleWeeklyReportVisibility,
  toggleDevelopmentalVisibility,
  getUsers,
  WeeklyReportSummary,
} from '../api/adminApi';

export default function UserWeeklyReportsPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [reports, setReports] = useState<WeeklyReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [devVisible, setDevVisible] = useState(false);
  const [togglingDev, setTogglingDev] = useState(false);

  useEffect(() => {
    if (userId) {
      loadReports();
      loadDevVisibility();
    }
  }, [userId]);

  const loadReports = async () => {
    try {
      const data = await getUserWeeklyReports(userId!);
      setReports(data);
    } catch (err) {
      console.error('Failed to load weekly reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDevVisibility = async () => {
    try {
      const users = await getUsers();
      const user = users.find((u) => u.id === userId);
      if (user) {
        setDevVisible(user.developmentalVisible);
      }
    } catch (err) {
      console.error('Failed to load developmental visibility:', err);
    }
  };

  const handleToggleDev = async () => {
    setTogglingDev(true);
    setFeedback(null);
    const newVisibility = !devVisible;
    try {
      const result = await toggleDevelopmentalVisibility(userId!, newVisibility);
      setDevVisible(result.developmentalVisible);
      setFeedback({
        type: 'success',
        message: newVisibility ? 'Developmental milestones visible' : 'Developmental milestones hidden',
      });
    } catch {
      setFeedback({ type: 'error', message: 'Failed to update developmental visibility' });
    } finally {
      setTogglingDev(false);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleToggle = async (report: WeeklyReportSummary) => {
    setTogglingId(report.id);
    setFeedback(null);
    const newVisibility = !report.visibility;

    try {
      const result = await toggleWeeklyReportVisibility(report.id, newVisibility);
      setReports((prev) =>
        prev.map((r) =>
          r.id === report.id ? { ...r, visibility: result.report.visibility } : r
        )
      );
      if (newVisibility && result.notificationSent) {
        setFeedback({ type: 'success', message: 'Report visible — notification sent' });
      } else if (newVisibility) {
        setFeedback({ type: 'success', message: 'Report visible — no push token' });
      } else {
        setFeedback({ type: 'success', message: 'Report hidden' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to update visibility' });
    } finally {
      setTogglingId(null);
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const formatWeek = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}, ${s.getFullYear()}`;
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading-state">Loading weekly reports...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn-link" onClick={() => navigate(-1)} style={{ marginBottom: 8 }}>
            &larr; Back to users
          </button>
          <h1>Weekly Reports</h1>
          <p className="page-subtitle">
            User: <span style={{ fontFamily: "'SF Mono', monospace", fontSize: 13 }}>{userId}</span>
          </p>
        </div>
      </div>

      {feedback && (
        <div className={`settings-feedback ${feedback.type}`} style={{ marginBottom: 16 }}>
          {feedback.message}
        </div>
      )}

      {/* Developmental Milestones Toggle */}
      <div style={{
        backgroundColor: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#1e2939' }}>
            Developmental Milestones
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
            Show radar chart on this user's Progress screen
          </div>
        </div>
        <button
          className={`settings-toggle ${devVisible ? 'active' : ''}`}
          onClick={handleToggleDev}
          disabled={togglingDev}
          aria-label="Toggle developmental milestones visibility"
        >
          <span className="settings-toggle-knob" />
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="loading-state">No weekly reports for this user</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Week</th>
              <th>Headline</th>
              <th>Sessions</th>
              <th>Deposits</th>
              <th>Created</th>
              <th>Visible</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {formatWeek(r.weekStartDate, r.weekEndDate)}
                </td>
                <td className="cell-title">{r.headline || '—'}</td>
                <td>{r.sessionIds.length}</td>
                <td>{r.totalDeposits}</td>
                <td className="cell-date">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td>
                  <button
                    className={`settings-toggle ${r.visibility ? 'active' : ''}`}
                    onClick={() => handleToggle(r)}
                    disabled={togglingId === r.id}
                    aria-label={`Toggle visibility`}
                  >
                    <span className="settings-toggle-knob" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
