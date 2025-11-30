/**
 * Recommendation Engine Service
 * Implements waterfall priority decision tree for adaptive learning
 */

class RecommendationService {
  /**
   * Target thresholds for each skill
   */
  static TARGETS = {
    PRAISE: 10,
    ECHO: 10,
    NARRATION: 10,
    TOTAL_NEGATIVES: 3, // Combined Criticism + Questions + Commands
  };

  /**
   * Calculate 3-day moving average for session metrics
   * @param {Array} sessions - Array of session objects with tagCounts
   * @returns {Object} Moving averages for each skill
   */
  calculateMovingAverage(sessions) {
    if (!sessions || sessions.length === 0) {
      return {
        praise: 0,
        echo: 0,
        narration: 0,
        criticism: 0,
        questions: 0,
        commands: 0,
        totalPositive: 0,
        totalNegative: 0,
      };
    }

    // Get last 3 sessions (or fewer if not enough data)
    const recentSessions = sessions.slice(-3);

    let totalPraise = 0;
    let totalEcho = 0;
    let totalNarration = 0;
    let totalCriticism = 0;
    let totalQuestions = 0;
    let totalCommands = 0;

    recentSessions.forEach(session => {
      if (session.tagCounts) {
        totalPraise += session.tagCounts.praise || 0;
        totalEcho += session.tagCounts.echo || 0;
        totalNarration += session.tagCounts.narration || 0;
        totalCriticism += session.tagCounts.criticism || 0;
        totalQuestions += session.tagCounts.questions || 0;
        totalCommands += session.tagCounts.commands || 0;
      }
    });

    const count = recentSessions.length;

    return {
      praise: Math.round(totalPraise / count),
      echo: Math.round(totalEcho / count),
      narration: Math.round(totalNarration / count),
      criticism: Math.round(totalCriticism / count),
      questions: Math.round(totalQuestions / count),
      commands: Math.round(totalCommands / count),
      totalPositive: Math.round((totalPraise + totalEcho + totalNarration) / count),
      totalNegative: Math.round((totalCriticism + totalQuestions + totalCommands) / count),
    };
  }

  /**
   * Get the number of days user has been stuck on a category
   * @param {Array} moduleHistory - Array of viewed modules with timestamps
   * @param {string} category - Category to check
   * @returns {number} Number of consecutive days
   */
  getDaysStuckOnCategory(moduleHistory, category) {
    if (!moduleHistory || moduleHistory.length === 0) return 0;

    // Filter history for this category, sorted by date descending
    const categoryHistory = moduleHistory
      .filter(m => m.category === category)
      .sort((a, b) => new Date(b.viewedAt) - new Date(a.viewedAt));

    if (categoryHistory.length === 0) return 0;

    // Count consecutive days from most recent
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let daysStuck = 0;
    let checkDate = new Date(today);

    for (const record of categoryHistory) {
      const recordDate = new Date(record.viewedAt);
      recordDate.setHours(0, 0, 0, 0);

      // Check if this record is from the expected date (today - daysStuck)
      if (recordDate.getTime() === checkDate.getTime()) {
        daysStuck++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break; // Gap in consecutive days
      }
    }

    return daysStuck;
  }

  /**
   * Determine the appropriate level for a category based on history
   * @param {Array} moduleHistory - Array of viewed modules
   * @param {string} category - Category to check
   * @returns {number} Level (1-4)
   */
  determineLevel(moduleHistory, category) {
    const daysStuck = this.getDaysStuckOnCategory(moduleHistory, category);

    // Level 4: Blocker - stuck 5+ days
    if (daysStuck >= 5) return 4;

    // Count how many times they've seen this category
    const viewCount = moduleHistory.filter(m => m.category === category).length;

    // Level 1: Novice - first time or very few views
    if (viewCount <= 2) return 1;

    // Level 2: Practitioner - some experience
    if (viewCount <= 5) return 2;

    // Level 3: Refining - experienced
    return 3;
  }

  /**
   * Main recommendation logic - waterfall priority system
   * @param {Array} sessions - User's CDI sessions
   * @param {Array} moduleHistory - User's module viewing history
   * @returns {Object} Recommended category and level
   */
  getRecommendation(sessions, moduleHistory = []) {
    const avg = this.calculateMovingAverage(sessions);

    // PRIORITY 1: SAFETY FILTER - Stop the negatives
    if (avg.totalNegative >= RecommendationService.TARGETS.TOTAL_NEGATIVES) {
      // Find which negative is highest
      const negatives = [
        { category: 'CRITICISM', value: avg.criticism },
        { category: 'QUESTIONS', value: avg.questions },
        { category: 'COMMANDS', value: avg.commands },
      ];

      const highest = negatives.sort((a, b) => b.value - a.value)[0];
      const level = this.determineLevel(moduleHistory, highest.category);

      return {
        category: highest.category,
        level,
        priority: 'SAFETY',
        reason: `Your ${highest.category.toLowerCase()} count (${highest.value}) is too high. Let's work on reducing negative interactions.`,
        metrics: avg,
      };
    }

    // PRIORITY 2: ENGAGEMENT FILTER - Jumpstart interaction if silent
    if (avg.totalPositive < 5) {
      // Start with PRAISE as it's easiest to learn
      const level = this.determineLevel(moduleHistory, 'PRAISE');

      return {
        category: 'PRAISE',
        level,
        priority: 'ENGAGEMENT',
        reason: `Your total positive interactions (${avg.totalPositive}) are low. Let's jumpstart engagement with praise.`,
        metrics: avg,
      };
    }

    // PRIORITY 3: DEFICIT CALCULATOR - Build the skills with largest gap
    const deficits = [
      {
        category: 'PRAISE',
        gap: RecommendationService.TARGETS.PRAISE - avg.praise,
        value: avg.praise,
      },
      {
        category: 'ECHO',
        gap: RecommendationService.TARGETS.ECHO - avg.echo,
        value: avg.echo,
      },
      {
        category: 'NARRATION',
        gap: RecommendationService.TARGETS.NARRATION - avg.narration,
        value: avg.narration,
      },
    ];

    // Find skill with largest gap (only if gap > 0)
    const needsWork = deficits.filter(d => d.gap > 0);

    if (needsWork.length > 0) {
      const largest = needsWork.sort((a, b) => b.gap - a.gap)[0];
      const level = this.determineLevel(moduleHistory, largest.category);

      return {
        category: largest.category,
        level,
        priority: 'DEFICIT',
        reason: `Your ${largest.category.toLowerCase()} count (${largest.value}) needs work. Target is ${RecommendationService.TARGETS[largest.category]}.`,
        metrics: avg,
      };
    }

    // PRIORITY 4: MAINTENANCE - Victory lap! All targets met
    const level = this.determineLevel(moduleHistory, 'MAINTENANCE');

    return {
      category: 'MAINTENANCE',
      level,
      priority: 'MAINTENANCE',
      reason: `Excellent work! All your skills are on target. Let's maintain this momentum.`,
      metrics: avg,
    };
  }
}

// Export singleton instance
const recommendationService = new RecommendationService();
export default recommendationService;
