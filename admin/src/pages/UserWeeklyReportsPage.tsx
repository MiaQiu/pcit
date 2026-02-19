import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getUserWeeklyReports,
  getWeeklyReport,
  generateWeeklyReportApi,
  toggleWeeklyReportVisibility,
  toggleDevelopmentalVisibility,
  getUsers,
  WeeklyReportSummary,
  WeeklyReportDetail,
} from '../api/adminApi';

const TOTAL_PAGES = 7;

export default function UserWeeklyReportsPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [reports, setReports] = useState<WeeklyReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [devVisible, setDevVisible] = useState(false);
  const [togglingDev, setTogglingDev] = useState(false);

  // Detail modal state
  const [selectedReport, setSelectedReport] = useState<WeeklyReportDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [whyExpanded, setWhyExpanded] = useState(false);

  // Generate state
  const [generating, setGenerating] = useState(false);

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
      if (user) setDevVisible(user.developmentalVisible);
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

  const handleToggle = async (report: WeeklyReportSummary, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleRowClick = async (reportId: string) => {
    setLoadingDetail(true);
    try {
      const detail = await getWeeklyReport(reportId);
      setSelectedReport(detail);
      setCurrentPage(1);
      setWhyExpanded(false);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to load report detail' });
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setFeedback(null);
    try {
      await generateWeeklyReportApi(userId!);
      setFeedback({ type: 'success', message: 'Report generated successfully' });
      await loadReports();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate report';
      setFeedback({ type: 'error', message });
    } finally {
      setGenerating(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const closeModal = () => {
    setSelectedReport(null);
    setCurrentPage(1);
    setWhyExpanded(false);
  };

  const formatWeek = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}, ${s.getFullYear()}`;
  };

  // ─── Report Pages ──────────────────────────────────────────────────

  const renderPage1 = (r: WeeklyReportDetail) => (
    <div className="wr-p1">
      <div>
        <div className="wr-p1-subtitle">Weekly Recap</div>
        <div className="wr-p1-title">{r.headline || 'Weekly Recap'}</div>
      </div>
      <div className="wr-p1-illustration">🐉</div>
    </div>
  );

  const renderPage2 = (r: WeeklyReportDetail) => (
    <div>
      <div className="wr-page-title">Your Weekly Emotional Bank Account Deposits</div>
      <div className="wr-card">
        <div className="wr-total-label">Total deposits</div>
        <div className="wr-total-row">
          <div className="wr-total-number">{r.totalDeposits}</div>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: '#F5F0FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🐉</div>
        </div>
        <div className="wr-total-tagline">Small moments. Big returns.</div>
      </div>

      <div className="wr-section-title">Your deposits breakdown</div>
      <div className="wr-deposit-grid">
        <div className="wr-deposit-card">
          <div className="wr-deposit-header">
            <div className="wr-deposit-icon" style={{ background: '#EEF2FF' }}>🕐</div>
            <div className="wr-deposit-value">{r.massageTimeMinutes}m</div>
          </div>
          <div className="wr-deposit-label">Massage time</div>
          <div className="wr-deposit-desc">Time spent co-regulating with warmth and presence.</div>
        </div>
        <div className="wr-deposit-card">
          <div className="wr-deposit-header">
            <div className="wr-deposit-icon" style={{ background: '#FFF7ED' }}>🎖️</div>
            <div className="wr-deposit-value">{r.praiseCount}</div>
          </div>
          <div className="wr-deposit-label">Confidence Boost</div>
          <div className="wr-deposit-desc">Praise that helped your child feel capable and proud.</div>
        </div>
        <div className="wr-deposit-card">
          <div className="wr-deposit-header">
            <div className="wr-deposit-icon" style={{ background: '#F3E8FF' }}>💬</div>
            <div className="wr-deposit-value">{r.echoCount}</div>
          </div>
          <div className="wr-deposit-label">Being heard (Echo)</div>
          <div className="wr-deposit-desc">You reflected feelings so they felt understood.</div>
        </div>
        <div className="wr-deposit-card">
          <div className="wr-deposit-header">
            <div className="wr-deposit-icon" style={{ background: '#FEF2F2' }}>👁️</div>
            <div className="wr-deposit-value">{r.narrateCount}</div>
          </div>
          <div className="wr-deposit-label">Being seen (Narrate)</div>
          <div className="wr-deposit-desc">You described what was happening without judgment.</div>
        </div>
      </div>
    </div>
  );

  const renderPage3 = (r: WeeklyReportDetail) => {
    const metrics = (r.growthMetrics || []) as Array<{ icon: string; value: string; label: string }>;
    const iconMap: Record<string, string> = {
      'trending-up': '📈', 'calendar': '📅', 'trophy': '🏆', 'star': '⭐',
    };
    return (
      <div>
        <div className="wr-page-title">You as a Parent This Week</div>

        {r.parentGrowthNarrative && (
          <div className="wr-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: '#F3E8FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 20 }}>💜</div>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#1E2939', lineHeight: '26px' }}>{r.parentGrowthNarrative}</div>
            </div>
          </div>
        )}

        {metrics.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {metrics.map((m, i) => (
              <div key={i} style={{ flex: 1, background: '#fff', borderRadius: 20, padding: 14, border: '2px solid #E5E7EB', textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{iconMap[m.icon] || '⭐'}</div>
                <div style={{ fontWeight: 700, fontSize: 20, color: '#1E2939' }}>{m.value}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{m.label}</div>
              </div>
            ))}
          </div>
        )}

        {r.noraObservation && (
          <div className="wr-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 16, background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>👁️</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#6366F1' }}>What Nora noticed</div>
            </div>
            <div style={{ fontSize: 15, color: '#374151', lineHeight: '23px' }}>{r.noraObservation}</div>
          </div>
        )}

        {!r.parentGrowthNarrative && !r.noraObservation && metrics.length === 0 && (
          <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 24 }}>No parent celebration data</div>
        )}
      </div>
    );
  };

  const renderPage4 = (r: WeeklyReportDetail) => {
    const moments = ((r.topMoments || []) as Array<{
      dayLabel: string; dateLabel: string; sessionTitle: string; quote: string;
    }>).filter(m => m.quote);
    return (
      <div>
        <div className="wr-page-title">Weekly Moments</div>
        {moments.length === 0 ? (
          <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 24 }}>No top moments this week</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {moments.map((m, i) => (
              <div key={i} className="wr-card">
                <div style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF', marginBottom: 10 }}>
                  {m.dayLabel} {m.dateLabel}{m.sessionTitle ? ` — ${m.sessionTitle}` : ''}
                </div>
                <div style={{ fontWeight: 700, fontSize: 20, color: '#1E2939', fontStyle: 'italic', textAlign: 'center', lineHeight: '28px' }}>
                  "{m.quote}"
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderPage5 = (r: WeeklyReportDetail) => {
    const snapshots = (r.growthSnapshots || []) as Array<{ category: string; icon: string; childQuote: string; meaning: string }>;
    const categoryIconMap: Record<string, string> = {
      'Words & Voice': '🗣️', 'Thinking & Learning': '💡', 'Playing Together': '🤝',
      'Big Feelings': '💛', 'Your Bond': '🤲',
    };
    return (
      <div>
        <div className="wr-page-title">Child's Week</div>

        {r.childSpotlight && (
          <div className="wr-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 18, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✨</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#D97706' }}>Shining moments</div>
            </div>
            <div style={{ fontSize: 15, color: '#374151', lineHeight: '24px' }}>{r.childSpotlight}</div>
          </div>
        )}

        {snapshots.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {snapshots.map((snap, i) => (
              <div key={i} className="wr-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 16 }}>{categoryIconMap[snap.category] || '✨'}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#6B7280' }}>{snap.category}</span>
                </div>
                <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 14, marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#1E2939', fontStyle: 'italic', lineHeight: '22px' }}>"{snap.childQuote}"</div>
                </div>
                <div style={{ fontSize: 14, color: '#6B7280', lineHeight: '21px' }}>{snap.meaning}</div>
              </div>
            ))}
          </div>
        )}

        {r.childProgressNote && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#F0FDF4', borderRadius: 16, padding: 14, marginTop: 16 }}>
            <span style={{ fontSize: 14 }}>🌱</span>
            <div style={{ fontSize: 14, color: '#166534', lineHeight: '21px' }}>{r.childProgressNote}</div>
          </div>
        )}

        {!r.childSpotlight && snapshots.length === 0 && (
          <div style={{ color: '#9CA3AF', textAlign: 'center', padding: 24 }}>No child celebration data</div>
        )}
      </div>
    );
  };

  const renderPage6 = (r: WeeklyReportDetail) => (
    <div>
      <div className="wr-page-title">Next Week's Focus</div>
      <div className="wr-card">
        <div className="wr-focus-header">
          <div className="wr-focus-label">Next week's gentle focus</div>
          <div className="wr-focus-icon">✨</div>
        </div>
        <div className="wr-focus-heading">
          {r.focusHeading || 'Keep practicing your skills this week.'}
        </div>
        <div className="wr-focus-subtext">
          {r.focusSubtext || "You don't need to be perfect — just consistent."}
        </div>
        <div className="wr-why-toggle" onClick={() => setWhyExpanded(!whyExpanded)}>
          <span>💡</span>
          <div className="wr-why-text">
            <div className="wr-why-title">Why this matters</div>
            <div className="wr-why-subtitle">A quick nervous-system explanation.</div>
          </div>
          <span>{whyExpanded ? '▲' : '▼'}</span>
        </div>
        {whyExpanded && r.whyExplanation && (
          <div className="wr-why-body">{r.whyExplanation}</div>
        )}
      </div>
    </div>
  );

  const renderPage7 = (r: WeeklyReportDetail) => {
    const mood = r.moodSelection;
    const ratings = (r.issueRatings || {}) as Record<string, string>;
    const issues = Object.keys(ratings);
    const MOODS = [
      { label: 'Grounded', emoji: '🌿' },
      { label: 'Tired', emoji: '🥱' },
      { label: 'Stretched', emoji: '🫠' },
      { label: 'Hopeful', emoji: '✨' },
    ];

    return (
      <div>
        <div className="wr-page-title">Quick Check-in</div>
        <div className="wr-card">
          <div className="wr-checkin-question">How are you doing this week?</div>
          <div className="wr-mood-grid">
            {MOODS.map((m) => (
              <div
                key={m.label}
                className={`wr-mood-chip ${mood === m.label ? 'selected' : ''}`}
              >
                {m.emoji} {m.label}
              </div>
            ))}
          </div>
          <div className="wr-checkin-disclaimer">
            This isn't graded — it helps your coach tailor the next suggestions.
          </div>
        </div>

        {issues.length > 0 && (
          <div className="wr-card">
            <div className="wr-checkin-question">Have you seen improvement?</div>
            {issues.map((issue) => (
              <div key={issue} className="wr-issue-row">
                <div className="wr-issue-label">{issue}</div>
                <div className="wr-rating-chips">
                  {['Better', 'Same', 'Worse'].map((rating) => (
                    <span
                      key={rating}
                      className={`wr-rating-chip ${ratings[issue] === rating ? 'selected' : ''}`}
                    >
                      {rating}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderCurrentPage = (r: WeeklyReportDetail) => {
    switch (currentPage) {
      case 1: return renderPage1(r);
      case 2: return renderPage2(r);
      case 3: return renderPage3(r);
      case 4: return renderPage4(r);
      case 5: return renderPage5(r);
      case 6: return renderPage6(r);
      case 7: return renderPage7(r);
      default: return null;
    }
  };

  // ─── Main Render ───────────────────────────────────────────────────

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
        <div className="header-actions">
          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
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
              <tr
                key={r.id}
                className="clickable-row"
                onClick={() => handleRowClick(r.id)}
              >
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
                    onClick={(e) => handleToggle(r, e)}
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

      {/* Loading overlay for detail fetch */}
      {loadingDetail && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="loading-state">Loading report...</div>
          </div>
        </div>
      )}

      {/* Detail Modal — app-style paginated view */}
      {selectedReport && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
            {/* Progress bar */}
            <div className="wr-progress">
              {Array.from({ length: TOTAL_PAGES }, (_, i) => (
                <div
                  key={i}
                  className={`wr-progress-seg ${i + 1 <= currentPage ? 'active' : ''}`}
                  onClick={() => setCurrentPage(i + 1)}
                />
              ))}
            </div>

            {/* Page content */}
            <div className="wr-page">
              {renderCurrentPage(selectedReport)}
            </div>

            {/* Generated-at meta */}
            {selectedReport.generatedAt && (
              <div className="wr-meta">
                Generated {new Date(selectedReport.generatedAt).toLocaleString()}
              </div>
            )}

            {/* Navigation buttons */}
            <div className="wr-nav">
              {currentPage > 1 ? (
                <button
                  className="wr-nav-btn secondary"
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  Back
                </button>
              ) : (
                <button
                  className="wr-nav-btn secondary"
                  onClick={closeModal}
                >
                  Close
                </button>
              )}
              {currentPage < TOTAL_PAGES ? (
                <button
                  className="wr-nav-btn primary"
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  Continue →
                </button>
              ) : (
                <button
                  className="wr-nav-btn primary"
                  onClick={closeModal}
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
