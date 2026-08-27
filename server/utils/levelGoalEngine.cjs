/**
 * Deterministic goal engine for "Tomorrow's Goal", keyed on the parent's
 * ParentSkillLevel (1-9, see parentSkillLevelService.cjs for the ladder).
 * Replaces the old tag-count phase engine (goalDirective.cjs) and the LLM
 * notification-copy rewrite step — every payload here is finished copy,
 * no LLM involved.
 *
 * Rule: a level never re-checks a skill from a level the parent has
 * already cleared (ParentSkillProgress.currentLevel only moves forward).
 * Each level's generator evaluates only its own target skill.
 *
 * Levels 1-6 are defined once in parentLevelLadder.cjs and shared with
 * parentSkillLevelService.cjs's clearance gate — see that file for the
 * per-level metric/target table.
 */
const {
  QUALIFYING_SESSIONS_REQUIRED,
  CDI_FLAT_LEVELS,
  tagCountsToMetrics,
  tagCountsToPdiCommandMetrics,
} = require('./parentLevelLadder.cjs');

/**
 * @typedef {Object} GoalPayload
 * @property {string} goalType
 * @property {string} title
 * @property {number|null} baselineCount
 * @property {number|string} targetCount
 * @property {string} actionPrompt
 * @property {string} coachingTip
 */

/**
 * LEVELS 1-6 — flat, single-metric CDI levels (see parentLevelLadder.cjs).
 * @param {CDI_FLAT_LEVELS[number]} levelDef
 * @param {ReturnType<typeof tagCountsToMetrics>} metrics
 * @returns {GoalPayload}
 */
function generateFlatCdiLevelGoal(levelDef, metrics) {
  const { goalType, title, metricKey, target, actionPrompt, coachingTip } = levelDef;
  return {
    goalType,
    title,
    baselineCount: metrics[metricKey],
    targetCount: target,
    actionPrompt,
    coachingTip,
  };
}

/**
 * LEVEL 7 — Cooperation Builder — Clear Instructions (PDI)
 * @param {{directCommands:number, indirectCommands:number}} pdiMetrics
 * @returns {GoalPayload}
 */
function generateLevel7Goal(pdiMetrics) {
  const { directCommands, indirectCommands } = pdiMetrics;

  // Skill-intrinsic branch — "Clear Instructions" means direct over vague.
  if (indirectCommands > directCommands) {
    return {
      goalType: 'BUILD_COMMANDS',
      title: 'Direct It',
      baselineCount: directCommands,
      targetCount: directCommands + 2,
      actionPrompt: 'Swap "Can you put that away?" for "Put that away, please." Say what you mean directly.',
      coachingTip: 'A direct instruction gives your child a clear, single, doable action.',
    };
  }

  return {
    goalType: 'BUILD_COMMANDS',
    title: 'The Clear Ask',
    baselineCount: directCommands,
    targetCount: 5,
    actionPrompt: 'Give 5 clear, direct, one-step instructions today and follow through on each one.',
    coachingTip: 'One instruction at a time, said once, then wait — resist repeating it right away.',
  };
}

/**
 * LEVEL 8 — Boundary Builder — Calm Follow-Through
 * No backing DPICS signal exists for compliance/timeout, so the goal
 * reports progress against the qualifying-session gate (see
 * parentSkillLevelService.cjs) rather than a same-session count.
 * @param {number} [qualifyingCount]
 * @returns {GoalPayload}
 */
function generateLevel8Goal(qualifyingCount = 0) {
  return {
    goalType: 'CALM_FOLLOWTHROUGH',
    title: 'Calm Follow-Through',
    baselineCount: qualifyingCount,
    targetCount: QUALIFYING_SESSIONS_REQUIRED,
    actionPrompt: 'Give one clear instruction today and follow through calmly — no repeating, no raised voice.',
    coachingTip: `You've logged ${qualifyingCount}/${QUALIFYING_SESSIONS_REQUIRED} calm follow-through sessions — a calm, consistent tone teaches the boundary is real.`,
  };
}

/**
 * LEVEL 9 — Confident Parent — Putting It All Together
 * Every component skill already graduated individually — no per-metric
 * branching. Reports progress against the qualifying-session gate.
 * @param {'CDI'|'PDI'} mode
 * @param {number} [qualifyingCount]
 * @returns {GoalPayload}
 */
function generateLevel9Goal(mode, qualifyingCount = 0) {
  const actionPrompt = mode === 'PDI'
    ? 'Give a clear instruction today and follow through calmly — let your steadiness do the talking.'
    : 'Blend praise, narration, and reflection naturally today — trust yourself to reach for the right tool in the moment.';

  return {
    goalType: 'INTEGRATE_SKILLS',
    title: 'Confident Parent',
    baselineCount: qualifyingCount,
    targetCount: QUALIFYING_SESSIONS_REQUIRED,
    actionPrompt,
    coachingTip: `You've logged ${qualifyingCount}/${QUALIFYING_SESSIONS_REQUIRED} sessions where it all came together — you have every tool now.`,
  };
}

/**
 * Used when the session's mode doesn't match what the current level is
 * tracking (e.g. a level 7/8 parent doing a CDI session — levels 1-6 are
 * already cleared and there's nothing left to check for CDI).
 * @param {'CDI'|'PDI'} mode
 * @returns {GoalPayload}
 */
function generateMaintenanceGoal(mode) {
  const actionPrompt = mode === 'PDI'
    ? 'Keep giving clear, calm instructions today — you\'ve already built this skill.'
    : 'Keep blending praise, narration, and reflection today — your foundations are strong.';

  return {
    goalType: 'MAINTAIN_SKILLS',
    title: 'Keep It Up',
    baselineCount: null,
    targetCount: 'Maintain',
    actionPrompt,
    coachingTip: 'You\'ve already built this skill — today is about keeping it natural.',
  };
}

/**
 * Dispatch to the correct level generator.
 * @param {number} level - ParentSkillProgress.currentLevel (1-9)
 * @param {Object} tagCounts - raw DB tagCounts for this session
 * @param {'CDI'|'PDI'} mode
 * @param {{level6QualifyingCount?: number, level7QualifyingCount?: number}} [progress]
 * @returns {GoalPayload}
 */
function generateGoalForLevel(level, tagCounts, mode, progress = {}) {
  const metrics = tagCountsToMetrics(tagCounts);
  const flatLevel = level <= 1 ? 1 : level;
  const flatDef = CDI_FLAT_LEVELS[flatLevel];

  if (flatDef && mode === 'CDI') return generateFlatCdiLevelGoal(flatDef, metrics);
  if (level === 7 && mode === 'PDI') return generateLevel7Goal(tagCountsToPdiCommandMetrics(tagCounts));
  if (level === 8 && mode === 'PDI') return generateLevel8Goal(progress.level6QualifyingCount || 0);
  if (level >= 9) return generateLevel9Goal(mode, progress.level7QualifyingCount || 0);
  // level 7 or 8, session mode doesn't match that level's own track
  return generateMaintenanceGoal(mode);
}

/**
 * Build the home-screen banner strings directly from the deterministic
 * payload — no LLM call. Matches the {postSession, tomorrow} shape the
 * mobile app already reads (HomeScreen_v2.tsx).
 * @param {GoalPayload} payload
 * @param {string|null} childName
 * @returns {{postSession: string, tomorrow: string}}
 */
function formatNotifications(payload, childName) {
  const name = childName || 'your child';
  return {
    postSession: `Nice work with ${name} today! You're working on: ${payload.title}.`,
    tomorrow: `Tomorrow's goal: ${payload.actionPrompt}`,
  };
}

/**
 * Build the "Tomorrow's Goal" headline sentence shown on ReportDetailScreen.
 * @param {GoalPayload} payload
 * @returns {string}
 */
function formatGoalHeadline(payload) {
  return `${payload.title} — ${payload.actionPrompt}`;
}

module.exports = {
  generateGoalForLevel,
  formatNotifications,
  formatGoalHeadline,
  tagCountsToMetrics,
  tagCountsToPdiCommandMetrics,
  generateFlatCdiLevelGoal,
  generateLevel7Goal,
  generateLevel8Goal,
  generateLevel9Goal,
  generateMaintenanceGoal,
};
