/**
 * Priority Engine - Clinical prioritization for child issues
 *
 * Evaluates child issues from User.issue and WacbSurvey data to determine
 * primary and secondary clinical levels and intervention strategies.
 */

const prisma = require('./db.cjs');
const { decryptSensitiveData } = require('../utils/encryption.cjs');

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
  // Current picker options (see nora-mobile ChildIssueScreen.tsx)
  big_feelings_tantrums: 'DE_ESCALATE',
  listening_cooperation: 'DE_ESCALATE',
  social: 'FLOURISH',
  attention_focus: 'FLOURISH',
  parenting_strategies: 'FLOURISH',
  adhd: 'DE_ESCALATE',
  // "anxiety_confidence", "developmental_concerns", and "other" are
  // intentionally omitted — no clinical mapping yet (pending clinical review)

  // Legacy values kept for users who selected them before the picker was
  // updated; no longer offered in the UI
  behavior_challenges: 'DE_ESCALATE',
  big_emotions: 'DE_ESCALATE',
  frustration_tolerance: 'FLOURISH',
  new_baby_in_the_house: 'SUPPORT',
  moving_house: 'SUPPORT',
  parental_divorce: 'SUPPORT',
};

// Maps Child Snapshot survey questions to clinical levels
const WACB_LEVEL_MAP = {
  STABILIZE: ['q8Destroy', 'q9Aggression'],
  DE_ESCALATE: ['q3Tantrum', 'q4Defiance', 'q10LieSteal'],
  DIRECT: ['q1Dawdle', 'q2Disobey', 'q6Restless', 'q7TaskCompletion'],
  FLOURISH: ['q5FocusDemand']
  // SUPPORT has no snapshot questions
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

  // Fetch latest Child Snapshot survey
  const latestSurvey = await prisma.childSnapshotSurvey.findFirst({
    where: { userId },
    orderBy: { submittedAt: 'desc' }
  });

  // Parse issues and get levels from issues
  const issues = parseUserIssues(user?.issue);
  const issueLevels = new Set();
  const levelUserIssues = {};  // level -> [issue strings]

  for (const issue of issues) {
    const level = ISSUE_TO_LEVEL[issue];
    if (level) {
      issueLevels.add(level);
      if (!levelUserIssues[level]) levelUserIssues[level] = [];
      levelUserIssues[level].push(issue);
    }
  }

  // Calculate WACB level scores and track which questions fired
  const wacbLevelScores = calculateWacbLevelScores(latestSurvey);
  const levelWacbQuestions = {};  // level -> [question keys with signal]

  if (latestSurvey) {
    for (const [level, questions] of Object.entries(WACB_LEVEL_MAP)) {
      for (const question of questions) {
        const score = latestSurvey[question];
        if (typeof score === 'number' && score >= WACB_SIGNAL_THRESHOLD) {
          if (!levelWacbQuestions[level]) levelWacbQuestions[level] = [];
          levelWacbQuestions[level].push(question);
        }
      }
    }
  }

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
        fromUserIssue: fromIssue,
        fromWacb,
        fromBothSources: fromIssue && fromWacb,
        wacbScore,
        userIssues: levelUserIssues[level] || [],
        wacbQuestions: levelWacbQuestions[level] || [],
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
    secondaryStrategy: secondary ? LEVEL_TO_STRATEGY[secondary.level] : null,
    activeLevels
  };
}

/**
 * Run the priority engine for a user - finds or creates Child record and updates priorities
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} Updated Child record
 */
async function runPriorityEngine(userId, { snapshotSurveyId } = {}) {
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
    const childName = user.childName ? decryptSensitiveData(user.childName) : 'Child';
    child = await prisma.child.create({
      data: {
        userId,
        name: childName,
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

  // Append ChildIssuePriority history rows
  if (priorities.activeLevels.length > 0) {
    const now = new Date();
    const promises = priorities.activeLevels.map((entry, i) =>
      prisma.childIssuePriority.create({
        data: {
          childId: child.id,
          clinicalLevel: entry.level,
          strategy: LEVEL_TO_STRATEGY[entry.level],
          priorityRank: i + 1,
          fromUserIssue: entry.fromUserIssue,
          fromWacb: entry.fromWacb,
          userIssues: entry.userIssues.length > 0 ? JSON.stringify(entry.userIssues) : null,
          wacbQuestions: entry.wacbQuestions.length > 0 ? JSON.stringify(entry.wacbQuestions) : null,
          wacbScore: entry.wacbScore || null,
          computedAt: now,
          snapshotSurveyId: snapshotSurveyId || null,
        }
      })
    );
    await Promise.all(promises);
  }

  console.log(`[PRIORITY-ENGINE] Updated priorities for user ${userId.substring(0, 8)}:`, {
    primaryIssue: priorities.primaryIssue,
    primaryStrategy: priorities.primaryStrategy,
    secondaryIssue: priorities.secondaryIssue,
    secondaryStrategy: priorities.secondaryStrategy,
    activeLevelsCount: priorities.activeLevels.length
  });

  return updatedChild;
}

// Same logic as the copy in server/routes/admin.cjs (calculateChildAgeInMonths)
// — duplicated locally per this codebase's existing convention rather than
// centralized. Prefers an exact birthday when available; falls back to a
// year-only estimate (assumes a January birth month) otherwise.
function calculateChildAgeInMonths(birthday, birthYear) {
  const today = new Date();
  if (birthday) {
    const birthDate = new Date(birthday);
    return (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());
  }
  return birthYear ? (today.getFullYear() - birthYear) * 12 : null;
}

/**
 * Builds the matching context used to rank Home Cards for a user (see
 * GET /api/config/home-cards in config.cjs): a weighted tag set for topic
 * matching, plus every one of the user's children's ages/genders for
 * age-range/gender matching.
 *
 * tagWeights combines:
 *   - User.issue / User.parentGoal values (weight 2 — explicit, first-party
 *     signal), parsed via parseUserIssues (same JSON-or-string shape both
 *     fields are written in).
 *   - Child.primaryIssue / secondaryIssue ClinicalLevel values across all of
 *     the user's children (weight 1 — derived/coarser signal; this is how
 *     WACB survey signal folds in, since runPriorityEngine already computes
 *     these from WACB + issue, without re-deriving that math here).
 *
 * childAges/childGenders resolve per Child row, falling back to the legacy
 * single-child User fields (User.childBirthday/childBirthYear/childGender)
 * when a Child row is missing that data — and synthesize one entry straight
 * from the User fields if the user has no Child row at all yet (Child rows
 * are created lazily by runPriorityEngine/pcitAnalysisService, not at signup).
 *
 * @param {string} userId
 * @returns {Promise<{ tagWeights: Map<string, number>, childAges: number[], childGenders: string[] }>}
 */
async function getUserMatchContext(userId) {
  const [user, children] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { issue: true, parentGoal: true, childBirthday: true, childBirthYear: true, childGender: true },
    }),
    prisma.child.findMany({
      where: { userId },
      select: { birthday: true, gender: true, primaryIssue: true, secondaryIssue: true },
    }),
  ]);

  const tagWeights = new Map();
  for (const tag of parseUserIssues(user?.issue)) tagWeights.set(tag, 2);
  for (const tag of parseUserIssues(user?.parentGoal)) tagWeights.set(tag, 2);

  const childRows = children.length > 0 ? children : [{ birthday: null, gender: null, primaryIssue: null, secondaryIssue: null }];
  const childAges = [];
  const childGenders = [];

  for (const child of childRows) {
    if (child.primaryIssue && !tagWeights.has(child.primaryIssue)) tagWeights.set(child.primaryIssue, 1);
    if (child.secondaryIssue && !tagWeights.has(child.secondaryIssue)) tagWeights.set(child.secondaryIssue, 1);

    const ageMonths = calculateChildAgeInMonths(child.birthday || user?.childBirthday, user?.childBirthYear);
    if (ageMonths != null) childAges.push(ageMonths);

    const gender = child.gender || user?.childGender;
    if (gender) childGenders.push(gender);
  }

  return { tagWeights, childAges, childGenders };
}

module.exports = {
  parseUserIssues,
  calculateWacbLevelScores,
  evaluatePriorities,
  runPriorityEngine,
  getUserMatchContext,
  // Export constants for testing
  CLINICAL_LEVELS_BY_PRIORITY,
  LEVEL_TO_STRATEGY,
  ISSUE_TO_LEVEL,
  WACB_LEVEL_MAP,
  WACB_SIGNAL_THRESHOLD
};
