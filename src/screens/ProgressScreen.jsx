import React, { useState, useEffect } from 'react';
import { Award, Calendar, Clock, ChevronRight, Loader2 } from 'lucide-react';
import sessionService from '../services/sessionService';

const ProgressScreen = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'CDI', 'PDI'

  useEffect(() => {
    loadSessions();
  }, [filter]);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);

    try {
      const options = filter !== 'ALL' ? { mode: filter } : {};
      const data = await sessionService.getSessions(options);
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getModeColor = (mode) => {
    return mode === 'CDI'
      ? 'bg-blue-100 text-blue-700 border-blue-300'
      : 'bg-purple-100 text-purple-700 border-purple-300';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="px-6 pt-12">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Your Progress</h1>

        {/* Mode Filter */}
        <div className="flex gap-2 mb-6">
          {['ALL', 'CDI', 'PDI'].map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === mode
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-4" />
            <p className="text-gray-600">Loading your sessions...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
            <p className="text-red-700">{error}</p>
            <button
              onClick={loadSessions}
              className="mt-2 text-red-600 underline text-sm"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && sessions.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              No sessions yet
            </h3>
            <p className="text-gray-600 mb-4">
              Start recording your first PCIT session to see progress here!
            </p>
          </div>
        )}

        {/* Sessions List */}
        {!loading && !error && sessions.length > 0 && (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {/* Mode Badge */}
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs font-semibold px-3 py-1 rounded-full border ${getModeColor(
                          session.mode
                        )}`}
                      >
                        {session.mode}
                      </span>
                      {session.masteryAchieved && (
                        <div className="flex items-center gap-1 text-xs font-semibold text-green-600">
                          <Award className="w-4 h-4" />
                          <span>Mastery!</span>
                        </div>
                      )}
                      {session.flaggedForReview && (
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-300">
                          Flagged
                        </span>
                      )}
                    </div>

                    {/* Date and Duration */}
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(session.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{formatDuration(session.durationSeconds)}</span>
                      </div>
                    </div>

                    {/* Tag Counts Summary */}
                    {session.tagCounts && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {Object.entries(session.tagCounts).map(([tag, count]) => (
                          <span
                            key={tag}
                            className="px-2 py-1 bg-gray-100 rounded text-gray-700"
                          >
                            {tag}: {count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Session Count */}
        {!loading && !error && sessions.length > 0 && (
          <div className="mt-6 text-center text-sm text-gray-600">
            Total sessions: {sessions.length}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressScreen;
