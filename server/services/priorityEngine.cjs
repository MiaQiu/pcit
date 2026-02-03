/**
 * Priority Engine - Clinical prioritization for child issues
 *
 * Evaluates child issues from User.issue and WacbSurvey data to determine
 * primary and secondary clinical levels and intervention strategies.
 */

const prisma = require('./db.cjs');

// Clinical levels ordered by priority (index 0 = highest priority)
const CLINICAL_LEVELS_BY_PRIORITY = [
  'STABILIZE',    // Level I
  'DE_ESCALATE',  // Level II
  'DIRECT',       // Level III
  'SUPPORT',      // Level IV
  'FLOURISH'      // Level V
];

// 1:1 mapping from clinical level to intervention strategy
const LEVEL_TO_STRATEGY = {
  STABILIZE: 'AGGRESSIVE_DE_ESCALATION',
  DE_ESCALATE: 'DIFFERENTIAL_ATTENTION',
  DIRECT: 'POSITIVE_REINFORCEMENT',
  SUPPORT: 'RELATIONSHIP_BUFFERING',
  FLOURISH: 'SKILL_COACHING'
};

// Maps ChildIssueScreen values to clinical levels
const ISSUE_TO_LEVEL = {
  tantrums: 'DE_ESCALATE',
  arguing: 'DE_ESCALATE',
  'not-listening': 'DIRECT',
  new_baby_in_the_house: 'SUPPORT',
  Navigating_change: 'SUPPORT',
  social: 'FLOURISH',
  frustration_tolerance: 'FLOURISH'
  // "other" is intentionally omitted (no clinical mapping)
};

// Maps WACB questions to clinical levels
const WACB_LEVEL_MAP = {
  STABILIZE: ['q4Angry', 'q6Destroy'],
  DE_ESCALATE: ['q5Scream', 'q7ProvokeFights'],
  DIRECT: ['q1Dawdle', 'q2MealBehavior', 'q3Disobey', 'q8Interrupt'],
  FLOURISH: ['q9Attention']
  // SUPPORT has no WACB questions
};

// Score threshold for WACB signal detection
const WACB_SIGNAL_THRESHOLD = 3;

/**
 * Parse User.issue field into an array of issue strings
 * Handles both JSON array strings and plain strings
 * @param {string|null} issueField - The raw issue field from User
 * @returns {string[]} Array of issue strings
 */
function parseUserIssues(issueField) {
  if (!issueField) {
    return [];
  }

  // Try to parse as JSON array
  if (typeof issueField === 'string' && issueField.startsWith('[')) {
    try {
      const parsed = JSON.parse(issueField);
      if (Array.isArray(parsed)) {
        return parsed.filter(i => typeof i === 'string' && i.trim() !== '');
      }
    } catch (e) {
      // Fall through to treat as plain string
    }
  }

  // Treat as single issue string
  return [issueField];
}

/**
 * Calculate WACB level scores from survey data
 * @param {Object} survey - WacbSurvey record
 * @returns {Object} Map of clinical level to { score, hasSignal }
 */
function calculateWacbLevelScores(survey) {
  if (!survey) {
    return {};
  }

  const levelScores = {};

  for (const [level, questions] of Object.entries(WACB_LEVEL_MAP)) {
    let totalScore = 0;
    let hasSignal = false;

    for (const question of questions) {
      const score = survey[question];
      if (typeof score === 'number') {
        totalScore += score;
        if (score >= WACB_SIGNAL_THRESHOLD) {
          hasSignal = true;
        }
      }
    }

    // Only include levels that have at least one question >= threshold
    if (hasSignal) {
      levelScores[level] = { score: totalScore, hasSignal: true };
    }
  }

  return levelScores;
}

/**
 * Evaluate priorities for a user based on issues and WACB survey
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} Priority evaluation result
 */
async function evaluatePriorities(userId) {
  // Fetch user's issues
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { issue: true }
  });

  // Fetch latest WACB survey
  const latestSurvey = await prisma.wacbSurvey.findFirst({
    where: { userId },
    orderBy: { submittedAt: 'desc' }
  });

  // Parse issues and get levels from issues
  const issues = parseUserIssues(user?.issue);
  const issueLevels = new Set();
  for (const issue of issues) {
    const level = ISSUE_TO_LEVEL[issue];
    if (level) {
      issueLevels.add(level);
    }
  }

  // Calculate WACB level scores
  const wacbLevelScores = calculateWacbLevelScores(latestSurvey);

  // Combine signals from both sources
  const activeLevels = [];

  for (const level of CLINICAL_LEVELS_BY_PRIORITY) {
    const fromIssue = issueLevels.has(level);
    const fromWacb = wacbLevelScores[level]?.hasSignal || false;
    const wacbScore = wacbLevelScores[level]?.score || 0;

    if (fromIssue || fromWacb) {
      activeLevels.push({
        level,
        priorityIndex: CLINICAL_LEVELS_BY_PRIORITY.indexOf(level),
        fromBothSources: fromIssue && fromWacb,
        wacbScore
      });
    }
  }

  // Sort by:
  // 1. Clinical priority index (lower = higher priority)
  // 2. Confirmed by both sources (true > false)
  // 3. Higher WACB severity score
  activeLevels.sort((a, b) => {
    // First: priority index (lower wins)
    if (a.priorityIndex !== b.priorityIndex) {
      return a.priorityIndex - b.priorityIndex;
    }
    // Second: both sources wins
    if (a.fromBothSources !== b.fromBothSources) {
      return a.fromBothSources ? -1 : 1;
    }
    // Third: higher WACB score wins
    return b.wacbScore - a.wacbScore;
  });

  // Extract primary and secondary
  const primary = activeLevels[0] || null;
  const secondary = activeLevels[1] || null;

  return {
    primaryIssue: primary?.level || null,
    primaryStrategy: primary ? LEVEL_TO_STRATEGY[primary.level] : null,
    secondaryIssue: secondary?.level || null,
    secondaryStrategy: secondary ? LEVEL_TO_STRATEGY[secondary.level] : null
  };
}

/**
 * Run the priority engine for a user - finds or creates Child record and updates priorities
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} Updated Child record
 */
async function runPriorityEngine(userId) {
  // First, fetch user data to get child info for find-or-create
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      childName: true,
      childBirthday: true,
      childGender: true,
      childConditions: true
    }
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Find or create Child record
  let child = await prisma.child.findFirst({
    where: { userId }
  });

  if (!child) {
    child = await prisma.child.create({
      data: {
        userId,
        name: user.childName || 'Child',
        birthday: user.childBirthday,
        gender: user.childGender,
        conditions: user.childConditions
      }
    });
  }

  // Evaluate priorities
  const priorities = await evaluatePriorities(userId);

  // Update Child record with priorities
  const updatedChild = await prisma.child.update({
    where: { id: child.id },
    data: {
      primaryIssue: priorities.primaryIssue,
      primaryStrategy: priorities.primaryStrategy,
      secondaryIssue: priorities.secondaryIssue,
      secondaryStrategy: priorities.secondaryStrategy
    }
  });

  console.log(`[PRIORITY-ENGINE] Updated priorities for user ${userId.substring(0, 8)}:`, {
    primaryIssue: priorities.primaryIssue,
    primaryStrategy: priorities.primaryStrategy,
    secondaryIssue: priorities.secondaryIssue,
    secondaryStrategy: priorities.secondaryStrategy
  });

  return updatedChild;
}

module.exports = {
  parseUserIssues,
  calculateWacbLevelScores,
  evaluatePriorities,
  runPriorityEngine,
  // Export constants for testing
  CLINICAL_LEVELS_BY_PRIORITY,
  LEVEL_TO_STRATEGY,
  ISSUE_TO_LEVEL,
  WACB_LEVEL_MAP,
  WACB_SIGNAL_THRESHOLD
};
