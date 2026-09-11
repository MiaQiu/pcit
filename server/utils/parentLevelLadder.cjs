/**
 * Single source of truth for the 9-level parent-skill ladder's levels 1-6 —
 * each a single CDI session, single DPICS metric, flat target. Consumed by
 * BOTH server/utils/levelGoalEngine.cjs (today's goal card) and
 * server/services/parentSkillLevelService.cjs (level-clearance gate), so a
 * level's goal-card target and its clearance threshold are always the same
 * number by construction — see doc/goal.md.
 *
 * Levels 7-9 (PDI / qualifying-session levels) have divergent goal-card vs.
 * clearance logic and stay defined directly in the two consumer files; only
 * the shared QUALIFYING_SESSIONS_REQUIRED constant is centralized here.
 */

// Levels 7->8, 8->9, and level 9's own completion counter all clear after
// this many non-consecutive qualifying sessions.
const QUALIFYING_SESSIONS_REQUIRED = 2;

/**
 * Map tagCounts (DB shape) into the flattened 6-field shape the flat-level
 * checks expect. Prefers the pre-aggregated fields (praise/command) when
 * present, falls back to summing the granular sub-type fields so this stays
 * correct against older tagCounts rows.
 * @param {Object} tagCounts
 * @returns {{commands:number, questions:number, criticisms:number, praise:number, narration:number, reflection:number}}
 */
function tagCountsToMetrics(tagCounts = {}) {
  const directCommand = tagCounts.direct_command || 0;
  const indirectCommand = tagCounts.indirect_command || 0;
  const praiseSum = (tagCounts.product_praise || 0) + (tagCounts.action_praise || 0)
    + (tagCounts.growth_praise || 0) + (tagCounts.regulatory_praise || 0);

  return {
    commands:   tagCounts.command != null ? tagCounts.command : (directCommand + indirectCommand),
    questions:  tagCounts.question || 0,
    criticisms: tagCounts.criticism || 0,
    praise:     tagCounts.praise != null ? tagCounts.praise : praiseSum,
    narration:  tagCounts.narration || 0,
    reflection: tagCounts.echo || 0,
  };
}

/**
 * Level 7 (PDI, "Clear Instructions") needs direct vs indirect commands
 * split out — the goal is about the ratio, not the combined total.
 * @param {Object} tagCounts
 * @returns {{directCommands:number, indirectCommands:number}}
 */
function tagCountsToPdiCommandMetrics(tagCounts = {}) {
  return {
    directCommands:   tagCounts.direct_command   || 0,
    indirectCommands: tagCounts.indirect_command || 0,
  };
}

/**
 * Levels 1-6: one CDI session, one DPICS metric, flat target. The same
 * target number is used both as the goal-card "aim for" value and as the
 * level-clearance threshold.
 * @type {Record<number, {goalType:string, title:string, metricKey:string, target:number, direction:'build'|'reduce', actionPrompt:string, coachingTip:string}>}
 */
const CDI_FLAT_LEVELS = {
  1: {
    goalType: 'AVOID_CRITICISM',
    title: 'The Calm Acceptance',
    metricKey: 'criticisms',
    target: 3,
    direction: 'reduce',
    actionPrompt: 'Practice silent acceptance today. Ignore minor messy play without correcting your child.',
    coachingTip: 'Take a slow, deep breath whenever you feel the urge to fix or correct.',
  },
  2: {
    goalType: 'AVOID_COMMANDS',
    title: 'The Command Pause',
    metricKey: 'commands',
    target: 3,
    direction: 'reduce',
    actionPrompt: 'Try playing for 5 minutes without giving instructions. Let your child steer!',
    coachingTip: 'Sit on your hands and count to 3 silently before you speak.',
  },
  3: {
    goalType: 'AVOID_QUESTIONS',
    title: 'The Statement Swap',
    metricKey: 'questions',
    target: 3,
    direction: 'reduce',
    actionPrompt: 'Swap questions for simple statements during play today.',
    coachingTip: 'Instead of asking "What are you making?", say "You are building something big!"',
  },
  4: {
    goalType: 'BUILD_PRAISE',
    title: 'The Praise Hunt',
    metricKey: 'praise',
    target: 10,
    direction: 'build',
    actionPrompt: 'Hunt for 10 specific things your child does well today and praise them out loud.',
    coachingTip: 'Be specific: "I love how carefully you stacked that!" lands better than just "Good job."',
  },
  5: {
    goalType: 'BUILD_NARRATION',
    title: 'The Broadcaster',
    metricKey: 'narration',
    target: 10,
    direction: 'build',
    actionPrompt: 'Fill the quiet moments by describing your child\'s actions like a sports commentator, 10 times today.',
    coachingTip: 'Narrate what you see, not what you think — "You picked the red block" not "You like red."',
  },
  6: {
    goalType: 'BUILD_ECHO',
    title: 'Parrot Mode',
    metricKey: 'reflection',
    target: 10,
    direction: 'build',
    actionPrompt: 'Act like a parrot today — repeat what your child says 10 times with enthusiasm.',
    coachingTip: 'Repeating their words tells your child "I hear you, and what you say matters."',
  },
};

/**
 * @param {CDI_FLAT_LEVELS[number]} levelDef
 * @param {ReturnType<typeof tagCountsToMetrics>} metrics
 * @returns {boolean}
 */
function isFlatLevelCleared(levelDef, metrics) {
  const count = metrics[levelDef.metricKey];
  return levelDef.direction === 'reduce' ? count <= levelDef.target : count >= levelDef.target;
}

module.exports = {
  QUALIFYING_SESSIONS_REQUIRED,
  CDI_FLAT_LEVELS,
  tagCountsToMetrics,
  tagCountsToPdiCommandMetrics,
  isFlatLevelCleared,
};
