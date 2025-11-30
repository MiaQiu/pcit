import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, User, Baby, Calendar, Loader2, ChevronRight } from 'lucide-react';
import sessionService from '../services/sessionService';

const ProgressScreen = () => {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('parent'); // 'parent' or 'child'
  const [timeRange] = useState(14); // Past 2 weeks

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await sessionService.getSessions({});
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter sessions from past 2 weeks
  const getRecentSessions = () => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - timeRange);

    return sessions.filter(session => {
      const sessionDate = new Date(session.createdAt);
      return sessionDate >= twoWeeksAgo;
    }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  };

  // Group sessions by date
  const groupSessionsByDate = (sessions) => {
    const grouped = {};
    sessions.forEach(session => {
      // Use ISO date string (YYYY-MM-DD) as key for consistent parsing
      const date = new Date(session.createdAt);
      const dateKey = date.toISOString().split('T')[0]; // "2025-11-22"
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(session);
    });
    return grouped;
  };

  // Calculate parent's progress timeline
  const calculateParentTimeline = () => {
    const recentSessions = getRecentSessions();
    const cdiSessions = recentSessions.filter(s => s.mode === 'CDI');
    const pdiSessions = recentSessions.filter(s => s.mode === 'PDI');

    // Group by date
    const cdiByDate = groupSessionsByDate(cdiSessions);
    const pdiByDate = groupSessionsByDate(pdiSessions);

    // Calculate daily totals for CDI
    const cdiTimeline = Object.entries(cdiByDate).map(([date, sessions]) => {
      const metrics = {
        date,
        praise: 0,
        echo: 0,
        narration: 0,
        command: 0,
        question: 0,
        criticism: 0,
        sessionCount: sessions.length
      };

      sessions.forEach(session => {
        if (session.tagCounts) {
          metrics.praise += session.tagCounts.praise || 0;
          metrics.echo += session.tagCounts.echo || 0;
          metrics.narration += session.tagCounts.narration || 0;
          metrics.command += session.tagCounts.command || 0;
          metrics.question += session.tagCounts.question || 0;
          metrics.criticism += session.tagCounts.criticism || 0;
        }
      });

      return metrics;
    });

    // Calculate daily totals for PDI
    const pdiTimeline = Object.entries(pdiByDate).map(([date, sessions]) => {
      const metrics = {
        date,
        directCommand: 0,
        indirectCommand: 0,
        correctTimeout: 0,
        incorrectTimeout: 0,
        sessionCount: sessions.length
      };

      sessions.forEach(session => {
        if (session.tagCounts) {
          metrics.directCommand += session.tagCounts.direct_command || 0;
          metrics.indirectCommand += session.tagCounts.indirect_command || 0;
          metrics.correctTimeout += session.tagCounts.correct_timeout || 0;
        }
      });

      return metrics;
    });

    return { cdiTimeline, pdiTimeline };
  };

  // Calculate child's progress timeline
  const calculateChildTimeline = () => {
    const recentSessions = getRecentSessions();
    const cdiSessions = recentSessions.filter(s => s.mode === 'CDI');
    const pdiSessions = recentSessions.filter(s => s.mode === 'PDI');

    // Group by date
    const cdiByDate = groupSessionsByDate(cdiSessions);
    const pdiByDate = groupSessionsByDate(pdiSessions);

    // Calculate daily totals for CDI
    const cdiTimeline = Object.entries(cdiByDate).map(([date, sessions]) => {
      const metrics = {
        date,
        utteranceRate: 0,
        speechDuration: 0,
        reflectionRate: 0,
        sessionCount: sessions.length
      };

      // Extract child metrics from sessions if available
      sessions.forEach(session => {
        if (session.childMetrics) {
          metrics.utteranceRate += session.childMetrics.utteranceRate || 0;
          metrics.speechDuration += session.childMetrics.speechDuration || 0;
          metrics.reflectionRate += session.childMetrics.reflectionRate || 0;
        }
      });

      // Average utteranceRate across sessions
      if (sessions.length > 0 && metrics.utteranceRate > 0) {
        metrics.utteranceRate = metrics.utteranceRate / sessions.length;
      }

      return metrics;
    });

    // Calculate daily totals for PDI
    const pdiTimeline = Object.entries(pdiByDate).map(([date, sessions]) => {
      const metrics = {
        date,
        complianceRate: 0,
        positiveResponses: 0,
        negativeResponses: 0,
        deescalationTime: 0,
        sessionCount: sessions.length
      };

      // Extract child metrics from sessions if available
      sessions.forEach(session => {
        if (session.childMetrics) {
          metrics.complianceRate += session.childMetrics.complianceRate || 0;
          metrics.positiveResponses += session.childMetrics.positiveResponses || 0;
          metrics.negativeResponses += session.childMetrics.negativeResponses || 0;
          metrics.deescalationTime += session.childMetrics.deescalationTime || 0;
        }
      });

      // Average across sessions
      if (sessions.length > 0) {
        if (metrics.complianceRate > 0) {
          metrics.complianceRate = metrics.complianceRate / sessions.length;
        }
        if (metrics.deescalationTime > 0) {
          metrics.deescalationTime = metrics.deescalationTime / sessions.length;
        }
      }

      return metrics;
    });

    return { cdiTimeline, pdiTimeline };
  };

  // Calculate trend (comparing first half vs second half of timeline)
  const calculateTrend = (timeline, metric) => {
    if (timeline.length < 2) return 'neutral';
    const midpoint = Math.floor(timeline.length / 2);
    const firstHalf = timeline.slice(0, midpoint);
    const secondHalf = timeline.slice(midpoint);

    const firstAvg = firstHalf.reduce((sum, item) => sum + (item[metric] || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, item) => sum + (item[metric] || 0), 0) / secondHalf.length;

    if (secondAvg > firstAvg * 1.1) return 'up';
    if (secondAvg < firstAvg * 0.9) return 'down';
    return 'neutral';
  };

  const parentTimeline = calculateParentTimeline();
  const childTimeline = calculateChildTimeline();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading progress...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="px-6 pt-12">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Progress Timeline</h1>
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
          <Calendar className="w-4 h-4" />
          <span>Past 2 Weeks</span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Tab Selector */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('parent')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'parent'
                ? 'bg-green-500 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            <User className="w-5 h-5" />
            Parent's Progress
          </button>
          <button
            onClick={() => setActiveTab('child')}
            className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'child'
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            <Baby className="w-5 h-5" />
            Child's Progress
          </button>
        </div>

        {/* Parent's Progress Timeline */}
        {activeTab === 'parent' && (
          <div className="space-y-6">
            {/* CDI Section */}
            {parentTimeline.cdiTimeline.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">CDI Skills Timeline</h2>

                {/* DO Skills */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-green-600 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                    DO Skills (PEN)
                  </h3>
                  <MetricTimeline
                    timeline={parentTimeline.cdiTimeline}
                    metric="praise"
                    label="Labeled Praise"
                    color="green"
                  />
                  <MetricTimeline
                    timeline={parentTimeline.cdiTimeline}
                    metric="echo"
                    label="Echo"
                    color="green"
                  />
                  <MetricTimeline
                    timeline={parentTimeline.cdiTimeline}
                    metric="narration"
                    label="Narration"
                    color="green"
                  />
                </div>

                {/* DON'T Skills */}
                <div>
                  <h3 className="text-sm font-semibold text-red-600 mb-4 flex items-center">
                    <span className="w-2 h-2 bg-red-600 rounded-full mr-2"></span>
                    DON'T Skills (Avoid)
                  </h3>
                  <MetricTimeline
                    timeline={parentTimeline.cdiTimeline}
                    metric="command"
                    label="Commands"
                    color="red"
                    inverse
                  />
                  <MetricTimeline
                    timeline={parentTimeline.cdiTimeline}
                    metric="question"
                    label="Questions"
                    color="red"
                    inverse
                  />
                  <MetricTimeline
                    timeline={parentTimeline.cdiTimeline}
                    metric="criticism"
                    label="Criticism"
                    color="red"
                    inverse
                  />
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <p className="text-gray-600">No CDI sessions in the past 2 weeks</p>
              </div>
            )}

            {/* PDI Section */}
            {parentTimeline.pdiTimeline.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">PDI Skills Timeline</h2>

                <MetricTimeline
                  timeline={parentTimeline.pdiTimeline}
                  metric="directCommand"
                  label="Direct Commands"
                  color="green"
                />
                <MetricTimeline
                  timeline={parentTimeline.pdiTimeline}
                  metric="indirectCommand"
                  label="Indirect Commands"
                  color="red"
                  inverse
                />
                <MetricTimeline
                  timeline={parentTimeline.pdiTimeline}
                  metric="correctTimeout"
                  label="Correct Time-Out"
                  color="green"
                />
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <p className="text-gray-600">No PDI sessions in the past 2 weeks</p>
              </div>
            )}
          </div>
        )}

        {/* Child's Progress Timeline */}
        {activeTab === 'child' && (
          <div className="space-y-6">
            {/* CDI Section */}
            {childTimeline.cdiTimeline.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">CDI Metrics Timeline</h2>

                <MetricTimeline
                  timeline={childTimeline.cdiTimeline}
                  metric="utteranceRate"
                  label="Child Utterance Rate"
                  color="blue"
                  unit="per min"
                />
                <MetricTimeline
                  timeline={childTimeline.cdiTimeline}
                  metric="speechDuration"
                  label="Speech Duration"
                  color="purple"
                  unit="sec"
                />
                <MetricTimeline
                  timeline={childTimeline.cdiTimeline}
                  metric="reflectionRate"
                  label="Reflection/Imitation"
                  color="green"
                />

                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-800">
                    <strong>Info:</strong> Child metrics are now stored in the database. Metrics will appear here once sessions are processed with child tracking enabled.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <p className="text-gray-600">No CDI sessions in the past 2 weeks</p>
              </div>
            )}

            {/* PDI Section */}
            {childTimeline.pdiTimeline.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-4">PDI Metrics Timeline</h2>

                <MetricTimeline
                  timeline={childTimeline.pdiTimeline}
                  metric="complianceRate"
                  label="Compliance Rate"
                  color="green"
                  unit="%"
                />
                <MetricTimeline
                  timeline={childTimeline.pdiTimeline}
                  metric="positiveResponses"
                  label="Positive Responses"
                  color="green"
                />
                <MetricTimeline
                  timeline={childTimeline.pdiTimeline}
                  metric="negativeResponses"
                  label="Negative Responses"
                  color="red"
                  inverse
                />
                <MetricTimeline
                  timeline={childTimeline.pdiTimeline}
                  metric="deescalationTime"
                  label="De-escalation Time"
                  color="orange"
                  unit="sec"
                  inverse
                />

                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-800">
                    <strong>Info:</strong> Child metrics are now stored in the database. Metrics will appear here once sessions are processed with child tracking enabled.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <p className="text-gray-600">No PDI sessions in the past 2 weeks</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Timeline component for each metric
const MetricTimeline = ({ timeline, metric, label, color, unit = '', inverse = false }) => {
  const trend = calculateTrend(timeline, metric);

  // For rate-based metrics (with units like %, per min), show average instead of sum
  // For deescalation time (sec), also show average since it's an average time metric
  const isRateMetric = unit === '%' || unit === 'per min';
  const isAverageMetric = isRateMetric || (unit === 'sec' && metric === 'deescalationTime');
  const values = timeline.map(item => item[metric] || 0).filter(v => v > 0);
  const total = values.length > 0
    ? (isAverageMetric
        ? values.reduce((sum, val) => sum + val, 0) / values.length
        : values.reduce((sum, val) => sum + val, 0))
    : 0;

  const maxValue = Math.max(...timeline.map(item => item[metric] || 0), 1);

  const colorClasses = {
    green: {
      bg: 'bg-green-500',
      light: 'bg-green-100',
      text: 'text-green-700',
      border: 'border-green-200'
    },
    red: {
      bg: 'bg-red-500',
      light: 'bg-red-100',
      text: 'text-red-700',
      border: 'border-red-200'
    },
    blue: {
      bg: 'bg-blue-500',
      light: 'bg-blue-100',
      text: 'text-blue-700',
      border: 'border-blue-200'
    },
    purple: {
      bg: 'bg-purple-500',
      light: 'bg-purple-100',
      text: 'text-purple-700',
      border: 'border-purple-200'
    },
    orange: {
      bg: 'bg-orange-500',
      light: 'bg-orange-100',
      text: 'text-orange-700',
      border: 'border-orange-200'
    }
  };

  const colors = colorClasses[color];

  // Determine if trend is good based on metric type
  const getTrendIcon = () => {
    if (trend === 'neutral') return null;

    const isGoodTrend = inverse ? trend === 'down' : trend === 'up';

    if (isGoodTrend) {
      return <TrendingUp className="w-4 h-4 text-green-600" />;
    } else {
      return <TrendingDown className="w-4 h-4 text-red-600" />;
    }
  };

  return (
    <div className="mb-6 pb-6 border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">{label}</span>
          {getTrendIcon()}
        </div>
        <div className="text-right">
          <span className="text-lg font-bold text-gray-900">
            {isAverageMetric ? total.toFixed(1) : Math.round(total)}
          </span>
          {unit && <span className="text-xs text-gray-500 ml-1">{unit}</span>}
          <p className="text-xs text-gray-500">{isAverageMetric ? 'avg' : 'total'}</p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="flex items-end justify-around gap-1 h-32 mb-2 bg-gray-50 rounded p-2">
        {timeline.map((item, index) => {
          const value = item[metric] || 0;
          const heightPx = maxValue > 0 ? Math.max((value / maxValue) * 112, value > 0 ? 8 : 0) : 0; // 112px = 128px - 16px padding

          return (
            <div key={index} className="flex-1 flex items-end justify-center" style={{ maxWidth: '60px' }}>
              <div className="w-full relative group">
                {value > 0 && (
                  <div
                    className={`w-full ${colors.bg} rounded-t transition-all hover:opacity-80 cursor-pointer`}
                    style={{ height: `${heightPx}px` }}
                  ></div>
                )}
                {/* Tooltip */}
                {value > 0 && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                    <div className={`${colors.light} ${colors.border} border rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg`}>
                      <p className="font-semibold">
                        {isAverageMetric ? value.toFixed(1) : Math.round(value)}{unit}
                      </p>
                      <p className="text-gray-600 text-xs">
                        {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Date labels */}
      <div className="flex gap-1">
        {timeline.map((item, index) => (
          <div key={index} className="flex-1 text-center">
            <p className="text-xs text-gray-500 transform rotate-0">
              {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Calculate trend helper
const calculateTrend = (timeline, metric) => {
  if (timeline.length < 2) return 'neutral';
  const midpoint = Math.floor(timeline.length / 2);
  const firstHalf = timeline.slice(0, midpoint);
  const secondHalf = timeline.slice(midpoint);

  const firstAvg = firstHalf.reduce((sum, item) => sum + (item[metric] || 0), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, item) => sum + (item[metric] || 0), 0) / secondHalf.length;

  if (secondAvg > firstAvg * 1.1) return 'up';
  if (secondAvg < firstAvg * 0.9) return 'down';
  return 'neutral';
};

export default ProgressScreen;
