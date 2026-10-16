import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getSessionReport, SessionReport, SessionReportResult } from '../api/adminApi';
import { useEnv, PROD_API_URL } from '../context/EnvContext';

// Renders **bold** spans inside plain text — the subset of markdown the
// legacy coaching sections use (mobile renders them with MarkdownText).
function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  );
}

export default function SessionReportPage() {
  const { userId, sessionId } = useParams<{ userId: string; sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { env, prodToken } = useEnv();

  const userName = (location.state as { userName?: string } | null)?.userName;

  const [result, setResult] = useState<SessionReportResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const callOpts = env === 'prod' ? { baseUrl: PROD_API_URL, token: prodToken ?? undefined } : undefined;
    setLoading(true);
    setError(null);
    getSessionReport(sessionId, callOpts)
      .then(setResult)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load session report'))
      .finally(() => setLoading(false));
  }, [sessionId, env, prodToken]);

  function fmt(dateStr: string) {
    return new Date(dateStr).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function fmtDuration(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  const report: SessionReport | null = result?.status === 'completed' ? result.report : null;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn-secondary btn-sm" onClick={() => (userId ? navigate(`/users/${userId}`) : navigate(-1))}>
            ← Back
          </button>
          <div>
            <h1>Session Report</h1>
            <p className="page-subtitle">
              {userName && <span style={{ marginRight: 12 }}>{userName}</span>}
              <span className="monospace" style={{ fontSize: 12, color: '#888' }}>{sessionId}</span>
              {env === 'prod' && <span className="env-badge prod">PROD</span>}
              {report?.isFirstSession && (
                <span className="status-badge status-completed" style={{ marginLeft: 8 }}>First Session</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {loading && <div className="loading-state">Loading…</div>}
      {error && <div className="error-state">{error}</div>}

      {!loading && !error && result?.status === 'not_found' && (
        <div className="empty-state">Session not found.</div>
      )}

      {!loading && !error && result?.status === 'processing' && (
        <div className="empty-state">Analysis still in progress — {result.message}</div>
      )}

      {!loading && !error && result?.status === 'failed' && (
        <div className="error-state">Analysis failed: {result.message}</div>
      )}

      {!loading && !error && report && (
        <div style={{ maxWidth: 760 }}>
          {/* Session meta */}
          <div className="wr-card" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>Mode</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1E2939' }}>{report.mode}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>Date</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1E2939' }}>{fmt(report.createdAt)}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>Duration</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1E2939' }}>{fmtDuration(report.durationSeconds)}</div>
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6B7280' }}>Emotional Deposit</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#6837EA' }}>+{report.noraScore}</div>
            </div>
          </div>

          {/* Skills (Confidence Builders) */}
          <div className="wr-card">
            <div className="wr-section-title" style={{ marginBottom: 12 }}>Confidence Builders</div>
            {report.skills.map((skill) => {
              const pct = Math.min(100, Math.round((skill.progress / 10) * 100));
              return (
                <div key={skill.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{skill.label}</span>
                    <span style={{ fontWeight: 700, color: '#6837EA' }}>{skill.progress}</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: '#F3E8FF', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: '#8C49D5' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Areas to avoid (Play Interruptions) */}
          <div className="wr-card">
            <div className="wr-section-title" style={{ marginBottom: 12 }}>Play Interruptions</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {report.areasToAvoid.map((area) => (
                <div
                  key={area.label}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 14,
                    background: area.count >= 3 ? '#FEF2F2' : '#F9FAFB',
                    border: `1px solid ${area.count >= 3 ? '#FCA5A5' : '#E5E7EB'}`,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#374151' }}>{area.label}</span>
                  <span style={{ marginLeft: 8, fontWeight: 700, fontSize: 13, color: area.count >= 3 ? '#DC2626' : '#6B7280' }}>
                    {area.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Moment */}
          {(report.topMoment || report.audioUrl) && (
            <div className="wr-card">
              <div className="wr-section-title" style={{ marginBottom: 8 }}>Top Moment</div>
              {report.topMomentCelebration && (
                <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 8 }}>{report.topMomentCelebration}</div>
              )}
              {report.topMoment && (
                <div style={{ fontStyle: 'italic', fontSize: 15, color: '#1E2939', marginBottom: report.audioUrl ? 12 : 0 }}>
                  "{report.topMoment}"
                </div>
              )}
              {report.audioUrl && (
                <audio controls src={report.audioUrl} style={{ width: '100%' }} />
              )}
            </div>
          )}

          {/* Coach's Corner (first session) — old ReportScreen.tsx format:
              legacy coaching sections ({title, content}), falling back to the
              raw coachingSummary when sections are absent */}
          {report.isFirstSession && (report.coachingCards?.length || report.coachingSummary) ? (
            <div className="wr-card">
              <div className="wr-section-title" style={{ marginBottom: 12 }}>Coach's Corner</div>
              {report.coachingCards?.length ? (
                report.coachingCards.map((section, i) => (
                  <div key={i} style={{ marginTop: i > 0 ? 16 : 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1E2939', marginBottom: 4 }}>{section.title}</div>
                    <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{renderBold(section.content)}</div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{report.coachingSummary}</div>
              )}
            </div>
          ) : null}

          {/* Coach's Corner (later sessions) */}
          {!report.isFirstSession && (report.coachCorner || report.skillCoaching) && (
            <div className="wr-card">
              <div className="wr-section-title" style={{ marginBottom: 12 }}>Coach's Corner</div>
              {report.coachCorner ? (
                <>
                  {/* Went well */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#3BA55D', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Went well
                    </div>
                    {report.coachCorner.didWell.theme && (
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1E2939', marginBottom: 4 }}>{report.coachCorner.didWell.theme}</div>
                    )}
                    {report.coachCorner.didWell.howItHelps && (
                      <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, marginBottom: 8 }}>{report.coachCorner.didWell.howItHelps}</div>
                    )}
                    {report.coachCorner.didWell.examples.map((ex, i) => (
                      <div key={i} style={{ marginBottom: 8 }}>
                        <div style={{ fontStyle: 'italic', fontSize: 13, color: '#374151', background: '#F9FAFB', borderRadius: 10, padding: 10 }}>
                          "{ex.quote}"
                        </div>
                        {ex.benefit && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{ex.benefit}</div>}
                      </div>
                    ))}
                  </div>

                  {/* Grow next */}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#D97706', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Grow next
                    </div>
                    {report.coachCorner.growthFocus.heading && (
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1E2939', marginBottom: 4 }}>{report.coachCorner.growthFocus.heading}</div>
                    )}
                    {report.coachCorner.growthFocus.newSkillIntro && (
                      <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, marginBottom: 8 }}>{report.coachCorner.growthFocus.newSkillIntro}</div>
                    )}
                    {report.coachCorner.growthFocus.benchmark && (
                      <div style={{ background: '#FBE7D2', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: '#C2694B', marginBottom: 2 }}>Benchmark</div>
                        <div style={{ fontSize: 14, color: '#1E2939' }}>{report.coachCorner.growthFocus.benchmark}</div>
                      </div>
                    )}
                    {report.coachCorner.growthFocus.gap && (
                      <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, marginBottom: 8 }}>{report.coachCorner.growthFocus.gap}</div>
                    )}
                    {report.coachCorner.growthFocus.strategy && (
                      <div style={{ fontSize: 14, color: '#1E2939', fontWeight: 600, lineHeight: 1.5, marginBottom: 8 }}>{report.coachCorner.growthFocus.strategy}</div>
                    )}

                    {report.coachCorner.wordBank.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 12, color: '#6B7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                          Word Bank
                        </div>
                        {report.coachCorner.wordBank.map((g, gi) => (
                          <div key={gi} style={{ marginBottom: 10 }}>
                            {g.goal && <div style={{ fontWeight: 700, fontSize: 13, color: '#1E2939', marginBottom: 4 }}>{g.goal}</div>}
                            {g.categories.map((c, ci) => (
                              <div key={ci} style={{ marginBottom: 6 }}>
                                {c.name && <div style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', marginBottom: 4 }}>{c.name}</div>}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {c.examples.map((line, li) => (
                                    <span key={li} style={{ padding: '6px 10px', borderRadius: 10, background: '#F5F0FF', fontSize: 13, color: '#6837EA' }}>
                                      "{line}"
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{report.skillCoaching}</div>
              )}
            </div>
          )}

          {/* How We'll Practice Together — first-session only; sits right after
              Coach's Corner, as in the old ReportScreen.tsx */}
          {report.isFirstSession && report.firstSessionInsights?.howWePracticeTogether.sentences.length ? (
            <div className="wr-card">
              <div className="wr-section-title" style={{ marginBottom: 8 }}>How We'll Practice Together</div>
              {report.firstSessionInsights.howWePracticeTogether.sentences.map((sentence, i) => (
                <div key={i} style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, marginBottom: 8 }}>{renderBold(sentence)}</div>
              ))}
            </div>
          ) : null}

          {/* Learning Moments / Crisis Moment — not part of the first-session report */}
          {report.isFirstSession ? null : report.learningMoments ? (
            <div className="wr-card">
              <div className="wr-section-title" style={{ marginBottom: 8 }}>Learning Moment</div>
              {report.learningMoments.summary && (
                <div style={{ fontSize: 14, color: '#374151', marginBottom: 12 }}>{report.learningMoments.summary}</div>
              )}
              {report.learningMoments.points.map((pt, i) => (
                <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < report.learningMoments!.points.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1E2939', marginBottom: 4 }}>{pt.title}</div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginBottom: pt.quote || pt.suggestedRewrite ? 8 : 0 }}>{pt.explanation}</div>
                  {pt.quote && (
                    <div style={{ fontStyle: 'italic', fontSize: 13, color: '#374151', background: '#F9FAFB', borderRadius: 10, padding: 10, marginBottom: pt.suggestedRewrite ? 8 : 0 }}>
                      {pt.quote}
                    </div>
                  )}
                  {pt.suggestedRewrite && (
                    <div style={{ fontSize: 13, color: '#0B9A6B' }}>
                      <strong>Try instead: </strong>{pt.suggestedRewrite}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : report.crisisMoment ? (
            <div className="wr-card">
              <div className="wr-section-title" style={{ marginBottom: 8 }}>{report.crisisMoment.title || 'Crisis Moment'}</div>
              <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {report.crisisMoment.coaching || report.crisisMoment.description}
              </div>
            </div>
          ) : null}

          {/* About the Child — the server-selected item (selectedAboutChild),
              same as mobile; falls back to the first extracted one for older
              sessions predating selection */}
          {(() => {
            const item = report.selectedAboutChild || report.aboutChild?.[0];
            if (!item?.Description) return null;
            return (
              <div className="wr-card">
                <div className="wr-section-title" style={{ marginBottom: 8 }}>
                  {report.isFirstSession ? 'What We Learned About the Child' : 'About the Child'}
                </div>
                {item.Title && (
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1E2939', marginBottom: 4 }}>{item.Title}</div>
                )}
                {/* Old ReportScreen.tsx (first session) shows Description then
                    Details; ReportDetailScreen shows Details || Description */}
                {report.isFirstSession ? (
                  <>
                    <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5 }}>{item.Description}</div>
                    {item.Details && (
                      <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5, marginTop: 8 }}>{item.Details}</div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.5 }}>{item.Details || item.Description}</div>
                )}
              </div>
            );
          })()}

          {/* Tomorrow's Goal */}
          {(report.tomorrowGoalDirective || report.tomorrowGoal) && (
            <div className="wr-card">
              <div className="wr-section-title" style={{ marginBottom: 8 }}>Tomorrow's Goal</div>
              {report.tomorrowGoalDirective ? (
                <>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#1E2939', marginBottom: 4 }}>
                    {report.tomorrowGoalDirective.focusSkill}
                    {report.tomorrowGoalDirective.currentNumber != null && report.tomorrowGoalDirective.targetNumber != null && (
                      <span style={{ color: '#6B7280', fontWeight: 500 }}>
                        {' '}({report.tomorrowGoalDirective.currentNumber} → {report.tomorrowGoalDirective.targetNumber})
                      </span>
                    )}
                  </div>
                  {report.tomorrowGoalDirective.actionPrompt && (
                    <div style={{ fontSize: 14, color: '#374151' }}>{report.tomorrowGoalDirective.actionPrompt}</div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 14, color: '#374151' }}>{report.tomorrowGoal}</div>
              )}
            </div>
          )}

          {/* Transcript (collapsible) */}
          <div className="wr-card">
            <div
              className="wr-section-title"
              style={{ marginBottom: showTranscript ? 12 : 0, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
              onClick={() => setShowTranscript((v) => !v)}
            >
              <span>Transcript ({report.transcript.length} lines)</span>
              <span>{showTranscript ? '▲' : '▼'}</span>
            </div>
            {showTranscript && (
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {report.transcript.map((line, i) => (
                  <div key={i} style={{ marginBottom: 8, fontSize: 13, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 700, color: line.role === 'child' ? '#D97706' : '#6837EA' }}>
                      {line.role === 'child' ? 'Child' : 'Parent'}:
                    </span>{' '}
                    <span style={{ color: '#374151' }}>{line.text}</span>
                    {line.pcitTag && (
                      <span className="monospace" style={{ marginLeft: 8, color: '#9CA3AF' }}>[{line.pcitTag}]</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
