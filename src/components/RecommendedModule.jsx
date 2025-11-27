import React, { useState, useEffect } from 'react';
import { getModule } from '../data/learningModules';

/**
 * RecommendedModule Component
 * Displays personalized learning module recommendation based on user's progress
 */
export default function RecommendedModule() {
  const [recommendation, setRecommendation] = useState(null);
  const [module, setModule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRecommendation();
  }, []);

  const fetchRecommendation = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/learning/recommendation`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recommendation');
      }

      const data = await response.json();
      setRecommendation(data);

      // Get the module content from the library
      const moduleContent = getModule(data.category, data.level);
      setModule(moduleContent);

      // Track that user viewed this module
      await trackModuleView(data.category, data.level);

    } catch (err) {
      console.error('Error fetching recommendation:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const trackModuleView = async (category, level) => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`${import.meta.env.VITE_API_URL}/api/learning/module-view`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ category, level })
      });
    } catch (err) {
      console.error('Error tracking module view:', err);
      // Non-critical error, don't show to user
    }
  };

  const getPriorityEmoji = (priority) => {
    switch (priority) {
      case 'SAFETY':
        return '🛡️';
      case 'ENGAGEMENT':
        return '⚡';
      case 'DEFICIT':
        return '🎯';
      case 'MAINTENANCE':
        return '🏆';
      default:
        return '🎯';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'SAFETY':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'ENGAGEMENT':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'DEFICIT':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'MAINTENANCE':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-white rounded-lg shadow-lg">
        <div className="pt-6 p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading your personalized recommendation...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-white rounded-lg shadow-lg border-2 border-red-300">
        <div className="pt-6 p-6">
          <div className="text-red-600 text-center py-4">
            <p className="font-semibold">Unable to load recommendation</p>
            <p className="text-sm mt-2">{error}</p>
            <button
              onClick={fetchRecommendation}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!recommendation || !module) {
    return (
      <div className="w-full max-w-3xl mx-auto bg-white rounded-lg shadow-lg">
        <div className="pt-6 p-6">
          <div className="text-center py-8 text-gray-600">
            <p>Complete a CDI session to get your personalized recommendation!</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className={`${getPriorityColor(recommendation.priority)} border-b p-6 rounded-t-lg`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-2xl">{getPriorityEmoji(recommendation.priority)}</span>
              <span className="bg-white px-3 py-1 rounded-full text-xs font-semibold border">
                {recommendation.priority} PRIORITY
              </span>
              <span className="bg-white px-3 py-1 rounded-full text-xs font-semibold border">
                Level {module.level}: {module.levelName}
              </span>
            </div>
            <h2 className="text-2xl font-bold">{module.title}</h2>
          </div>
        </div>
        <p className="text-sm mt-2 opacity-90">{recommendation.reason}</p>
      </div>

      {/* Content */}
      <div className="pt-6 p-6 space-y-6">
        {/* Concept Section */}
        {/* <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
              1
            </div>
            Concept
          </h3>
          <p className="text-gray-700 leading-relaxed pl-10">{module.concept}</p>
        </div> */}

        {/* Action Section */}
        {/* <div>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">
              2
            </div>
            Today's Practice
          </h3>
          <ul className="space-y-3 pl-10">
            {module.action.map((step, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="text-green-600 text-xl mt-0.5 flex-shrink-0">✓</span>
                <span className="text-gray-700">{step}</span>
              </li>
            ))}
          </ul>
        </div> */}

        {/* Metrics Summary */}
        {/* {recommendation.metrics && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="text-sm font-semibold text-gray-600 mb-3">Your Recent Averages (Last 3 Sessions)</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <MetricBadge label="Praise" value={recommendation.metrics.praise} target={10} />
              <MetricBadge label="Echo" value={recommendation.metrics.echo} target={10} />
              <MetricBadge label="Narration" value={recommendation.metrics.narration} target={10} />
              <MetricBadge label="Criticism" value={recommendation.metrics.criticism} target={0} inverse />
              <MetricBadge label="Questions" value={recommendation.metrics.questions} target={0} inverse />
              <MetricBadge label="Commands" value={recommendation.metrics.commands} target={0} inverse />
            </div>
          </div>
        )} */}

        {/* Action Button */}
        <div className="mt-6 pt-6 border-t flex justify-center">
          <button
            onClick={() => window.location.href = '/recording'}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold shadow-md transition-colors"
          >
            Start CDI Session
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * MetricBadge Component
 * Displays a metric with color coding based on target
 */
function MetricBadge({ label, value, target, inverse = false }) {
  // For inverse metrics (negatives), green when low, red when high
  // For normal metrics (positives), green when high, red when low
  const isGood = inverse ? value <= target : value >= target;
  const colorClass = isGood
    ? 'bg-green-50 text-green-700 border-green-300'
    : 'bg-yellow-50 text-yellow-700 border-yellow-300';

  return (
    <div className={`${colorClass} border rounded-lg p-3 text-center`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs opacity-75">{label}</div>
    </div>
  );
}
