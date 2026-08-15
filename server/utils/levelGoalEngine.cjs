/**
 * Deterministic goal engine for "Tomorrow's Goal", keyed on the parent's
 * ParentSkillLevel (1-7, see parentSkillLevelService.cjs for the ladder).
 * Replaces the old tag-count phase engine (goalDirective.cjs) and the LLM
 * notification-copy rewrite step — every payload here is finished copy,
 * no LLM involved.
 *
 * Rule: a level never re-checks a skill from a level the parent has
 * already cleared (ParentSkillProgress.currentLevel only moves forward).
 * Each level's generator evaluates only its own target skill.
 */

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
 * Map tagCounts (DB shape) into the flattened 6-field shape the level 1-4
 * generators expect. Prefers the pre-aggregated fields (praise/command)
 * when present, falls back to summing the granular sub-type fields so
 * this stays correct against older tagCounts rows.
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
 * Level 5/7-PDI need direct vs indirect commands split out — "Clear
 * Instructions" is about the ratio, not the combined total.
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
 * LEVEL 1 — Play Builder — Follow Your Child's Lead
 * @param {{commands:number, questions:number, criticisms:number, praise:number, narration:number, reflection:number}} metrics
 * @returns {GoalPayload}
 */
function generateLevel1Goal(metrics) {
  const { commands, questions, criticisms, praise, narration, reflection } = metrics;
  const totalDonts = commands + questions + criticisms;
  const totalDoSkills = praise + narration + reflection;

  // 1. Silent / Disengaged Parent Edge Case
  if (totalDonts === 0 && totalDoSkills === 0) {
    return {
      goalType: 'SKILL_FOLLOW_LEAD',
      title: 'The Silent Observer',
      baselineCount: 0,
      targetCount: 1,
      actionPrompt: 'Sit close to your child during play today and simply watch what they choose to do.',
      coachingTip: 'You do not need to teach or guide. Just enjoy watching them take the lead!',
    };
  }

  // 2. High Criticism Priority Check (Safety First)
  if (criticisms >= 3) {
    return {
      goalType: 'AVOID_CRITICISM',
      title: 'The Calm Acceptance',
      baselineCount: criticisms,
      targetCount: 1,
      actionPrompt: 'Practice silent acceptance today. Ignore minor messy play without correcting your child.',
      coachingTip: 'Take a slow, deep breath whenever you feel the urge to fix or correct.',
    };
  }

  // 3. High Multi-Don'ts Check (Commands AND Questions both >= 8)
  if (commands >= 8 && questions >= 8) {
    return {
      goalType: 'AVOID_COMMANDS',
      title: 'The Dual Pause',
      baselineCount: commands + questions,
      targetCount: 6,
      actionPrompt: 'Focus on cutting commands first today. Let your child guide play without directions.',
      coachingTip: 'Sit on your hands and count to 3 silently before speaking.',
    };
  }

  // 4. Commands Primary Focus
  if (commands >= 10 || (commands >= questions && totalDonts > 3)) {
    return {
      goalType: 'AVOID_COMMANDS',
      title: 'The Command Pause',
      baselineCount: commands,
      targetCount: Math.min(5, Math.floor(commands * 0.4)),
      actionPrompt: 'Try playing for 5 minutes without giving instructions. Let your child steer!',
      coachingTip: 'Sit on your hands and count to 3 silently before you speak.',
    };
  }

  // 5. Questions Primary Focus
  if (questions >= 8 && totalDonts > 3) {
    return {
      goalType: 'AVOID_QUESTIONS',
      title: 'The Statement Swap',
      baselineCount: questions,
      targetCount: Math.min(4, Math.floor(questions * 0.4)),
      actionPrompt: 'Swap questions for simple statements during play today.',
      coachingTip: 'Instead of asking "What are you making?", say "You are building something big!"',
    };
  }

  // 6. Moderate Don'ts Fallback (Transition to Positive Following)
  return {
    goalType: 'SKILL_FOLLOW_LEAD',
    title: 'Mirror the Leader',
    baselineCount: totalDonts,
    targetCount: 3,
    actionPrompt: 'Pick up the same toy your child picks up and copy their play actions silently.',
    coachingTip: 'Let your child be the director while you act as the fellow player.',
  };
}

/**
 * LEVEL 2 — Confidence Builder — Specific Praise
 * Flat goal: always aim for 5, regardless of today's baseline.
 * @param {{praise:number}} metrics
 * @returns {GoalPayload}
 */
function generateLevel2Goal(metrics) {
  return {
    goalType: 'BUILD_PRAISE',
    title: 'The Praise Hunt',
    baselineCount: metrics.praise,
    targetCount: 5,
    actionPrompt: 'Hunt for 5 specific things your child does well today and praise them out loud.',
    coachingTip: 'Be specific: "I love how carefully you stacked that!" lands better than just "Good job."',
  };
}

/**
 * LEVEL 3 — Attention Builder — Narration
 * Flat goal: always aim for 5.
 * @param {{narration:number}} metrics
 * @returns {GoalPayload}
 */
function generateLevel3Goal(metrics) {
  return {
    goalType: 'BUILD_NARRATION',
    title: 'The Broadcaster',
    baselineCount: metrics.narration,
    targetCount: 5,
    actionPrompt: 'Fill the quiet moments by describing your child\'s actions like a sports commentator, 5 times today.',
    coachingTip: 'Narrate what you see, not what you think — "You picked the red block" not "You like red."',
  };
}

/**
 * LEVEL 4 — Communication Builder — Reflection (Echo)
 * Flat goal: always aim for 5.
 * @param {{reflection:number}} metrics
 * @returns {GoalPayload}
 */
function generateLevel4Goal(metrics) {
  return {
    goalType: 'BUILD_ECHO',
    title: 'Parrot Mode',
    baselineCount: metrics.reflection,
    targetCount: 5,
    actionPrompt: 'Act like a parrot today — repeat what your child says 5 times with enthusiasm.',
    coachingTip: 'Repeating their words tells your child "I hear you, and what you say matters."',
  };
}

/**
 * LEVEL 5 — Cooperation Builder — Clear Instructions (PDI)
 * @param {{directCommands:number, indirectCommands:number}} pdiMetrics
 * @returns {GoalPayload}
 */
function generateLevel5Goal(pdiMetrics) {
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
 * LEVEL 6 — Boundary Builder — Calm Follow-Through
 * No backing DPICS signal exists for compliance/timeout, so the goal
 * reports progress against the 2-qualifying-session gate (see
 * parentSkillLevelService.cjs) rather than a same-session count.
 * @param {number} [qualifyingCount]
 * @returns {GoalPayload}
 */
function generateLevel6Goal(qualifyingCount = 0) {
  return {
    goalType: 'CALM_FOLLOWTHROUGH',
    title: 'Calm Follow-Through',
    baselineCount: qualifyingCount,
    targetCount: 2,
    actionPrompt: 'Give one clear instruction today and follow through calmly — no repeating, no raised voice.',
    coachingTip: `You've logged ${qualifyingCount}/2 calm follow-through sessions — a calm, consistent tone teaches the boundary is real.`,
  };
}

/**
 * LEVEL 7 — Confident Parent — Putting It All Together
 * Every component skill already graduated individually — no per-metric
 * branching. Reports progress against the 2-qualifying-session gate.
 * @param {'CDI'|'PDI'} mode
 * @param {number} [qualifyingCount]
 * @returns {GoalPayload}
 */
function generateLevel7Goal(mode, qualifyingCount = 0) {
  const actionPrompt = mode === 'PDI'
    ? 'Give a clear instruction today and follow through calmly — let your steadiness do the talking.'
    : 'Blend praise, narration, and reflection naturally today — trust yourself to reach for the right tool in the moment.';

  return {
    goalType: 'INTEGRATE_SKILLS',
    title: 'Confident Parent',
    baselineCount: qualifyingCount,
    targetCount: 2,
    actionPrompt,
    coachingTip: `You've logged ${qualifyingCount}/2 sessions where it all came together — you have every tool now.`,
  };
}

/**
 * Used when the session's mode doesn't match what the current level is
 * tracking (e.g. a level 5/6 parent doing a CDI session — levels 1-4 are
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
 * @param {number} level - ParentSkillProgress.currentLevel (1-7)
 * @param {Object} tagCounts - raw DB tagCounts for this session
 * @param {'CDI'|'PDI'} mode
 * @param {{level6QualifyingCount?: number, level7QualifyingCount?: number}} [progress]
 * @returns {GoalPayload}
 */
function generateGoalForLevel(level, tagCounts, mode, progress = {}) {
  const metrics = tagCountsToMetrics(tagCounts);

  if (level <= 1) return generateLevel1Goal(metrics);
  if (level === 2) return generateLevel2Goal(metrics);
  if (level === 3) return generateLevel3Goal(metrics);
  if (level === 4) return generateLevel4Goal(metrics);
  if (level === 5 && mode === 'PDI') return generateLevel5Goal(tagCountsToPdiCommandMetrics(tagCounts));
  if (level === 6 && mode === 'PDI') return generateLevel6Goal(progress.level6QualifyingCount || 0);
  if (level >= 7) return generateLevel7Goal(mode, progress.level7QualifyingCount || 0);
  // level 5 or 6, session mode doesn't match that level's own track
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
  generateLevel1Goal,
  generateLevel2Goal,
  generateLevel3Goal,
  generateLevel4Goal,
  generateLevel5Goal,
  generateLevel6Goal,
  generateLevel7Goal,
  generateMaintenanceGoal,
};
