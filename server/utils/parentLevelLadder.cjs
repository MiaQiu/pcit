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
    title: 'Avoid Corrections',
    metricKey: 'criticisms',
    target: 3,
    direction: 'reduce',
    actionPrompt: 'Keep corrections under 3 during a 5-minute play session today! Practice silent acceptance and let minor messes go.',
    coachingTip: 'Take a slow, deep breath whenever you feel the urge to fix or correct.',
  },
  2: {
    goalType: 'AVOID_COMMANDS',
    title: 'Avoid Commands',
    metricKey: 'commands',
    target: 3,
    direction: 'reduce',
    actionPrompt: 'Keep commands under 3 during a 5-minute play session today! Let your child steer without giving instructions.',
    coachingTip: 'Sit on your hands and count to 3 silently before you speak.',
  },
  3: {
    goalType: 'AVOID_QUESTIONS',
    title: 'Avoid Questions',
    metricKey: 'questions',
    target: 3,
    direction: 'reduce',
    actionPrompt: 'Keep questions under 3 during a 5-minute play session today! Swap questions for simple statements about what you see.',
    coachingTip: 'Instead of asking "What are you making?", say "You are building something big!"',
  },
  4: {
    goalType: 'BUILD_PRAISE',
    title: 'Labelled Praise',
    metricKey: 'praise',
    target: 10,
    direction: 'build',
    actionPrompt: 'Give 10 labeled praises in 5 minutes of play today! Catch your child doing good and speak it out loud.',
    coachingTip: 'Be specific: "I love how carefully you stacked that!" lands better than just "Good job."',
  },
  5: {
    goalType: 'BUILD_NARRATION',
    title: 'Narration',
    metricKey: 'narration',
    target: 10,
    direction: 'build',
    actionPrompt: 'Give 10 narrations during a 5-minute play session today! Describe your child\'s actions like a sports commentator.',
    coachingTip: 'Narrate what you see, not what you think — "You picked the red block" not "You like red."',
  },
  6: {
    goalType: 'BUILD_ECHO',
    title: 'Echo',
    metricKey: 'reflection',
    target: 10,
    direction: 'build',
    actionPrompt: 'Give 10 echoes during a 5-minute play session today! Repeat what your child says with enthusiasm like an attentive parrot.',
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

/**
 * zh-CN / zh-TW copy for levels 1-6's title/actionPrompt/coachingTip — the
 * only parts of CDI_FLAT_LEVELS a parent actually reads (goalType/metricKey/
 * target/direction are internal and language-independent). Keyed the same
 * way the rest of the server does — see getLanguageInstruction's
 * zh-TW/zh-CN branches in server/utils/languageUtils.cjs — and reusing that
 * file's official skill-name translations (Echo → 回应/回應, Narrate →
 * 行为描述/行為描述, Labeled Praise → 具体赞美/具體讚美) for consistency with
 * the LLM-written parts of the report.
 * @type {Record<string, Record<number, {title:string, actionPrompt:string, coachingTip:string}>>}
 */
const CDI_FLAT_LEVELS_TRANSLATIONS = {
  'zh-CN': {
    1: {
      title: '避免纠正',
      actionPrompt: '今天的5分钟玩耍时间里，把纠正次数控制在3次以内！练习默默接纳，让小小的凌乱过去就好。',
      coachingTip: '每当你想开口纠正时，先深深吸一口气，慢慢放松下来。',
    },
    2: {
      title: '避免指令',
      actionPrompt: '今天的5分钟玩耍时间里，把指令次数控制在3次以内！不发出指令，让孩子自己主导。',
      coachingTip: '把手放在身下坐着，开口前先在心里默数到3。',
    },
    3: {
      title: '避免提问',
      actionPrompt: '今天的5分钟玩耍时间里，把提问次数控制在3次以内！把提问换成你所见的简单描述句。',
      coachingTip: '不要问"你在做什么？"，试着说"你正在搭一个很大的东西！"',
    },
    4: {
      title: '具体赞美',
      actionPrompt: '今天5分钟的玩耍时间里，给出10次具体赞美！留意孩子做得好的地方，大声说出来。',
      coachingTip: '越具体越好：比起只说"做得好"，说"我很喜欢你把积木叠得这么仔细！"更有效。',
    },
    5: {
      title: '行为描述',
      actionPrompt: '今天5分钟的玩耍时间里，给出10次行为描述！像体育解说员一样，描述孩子的动作。',
      coachingTip: '描述你看到的，而不是你想到的——说"你拿起了红色的积木"，而不是"你喜欢红色"。',
    },
    6: {
      title: '回应',
      actionPrompt: '今天5分钟的玩耍时间里，给出10次回应！像专注的小鹦鹉一样，热情地重复孩子说的话。',
      coachingTip: '重复孩子的话，是在告诉他们："我在听，你说的话很重要。"',
    },
  },
  'zh-TW': {
    1: {
      title: '避免糾正',
      actionPrompt: '今天的5分鐘玩耍時間裡，把糾正次數控制在3次以內！練習默默接納，讓小小的凌亂過去就好。',
      coachingTip: '每當你想開口糾正時，先深深吸一口氣，慢慢放鬆下來。',
    },
    2: {
      title: '避免指令',
      actionPrompt: '今天的5分鐘玩耍時間裡，把指令次數控制在3次以內！不發出指令，讓孩子自己主導。',
      coachingTip: '把手放在身下坐著，開口前先在心裡默數到3。',
    },
    3: {
      title: '避免提問',
      actionPrompt: '今天的5分鐘玩耍時間裡，把提問次數控制在3次以內！把提問換成你所見的簡單描述句。',
      coachingTip: '不要問「你在做什麼？」，試著說「你正在搭一個很大的東西！」',
    },
    4: {
      title: '具體讚美',
      actionPrompt: '今天5分鐘的玩耍時間裡，給出10次具體讚美！留意孩子做得好的地方，大聲說出來。',
      coachingTip: '越具體越好：比起只說「做得好」，說「我很喜歡你把積木疊得這麼仔細！」更有效。',
    },
    5: {
      title: '行為描述',
      actionPrompt: '今天5分鐘的玩耍時間裡，給出10次行為描述！像體育主播一樣，描述孩子的動作。',
      coachingTip: '描述你看到的，而不是你想到的——說「你拿起了紅色的積木」，而不是「你喜歡紅色」。',
    },
    6: {
      title: '回應',
      actionPrompt: '今天5分鐘的玩耍時間裡，給出10次回應！像專注的小鸚鵡一樣，熱情地重複孩子說的話。',
      coachingTip: '重複孩子的話，是在告訴他們：「我在聽，你說的話很重要。」',
    },
  },
};

/**
 * Returns a level 1-6 definition with title/actionPrompt/coachingTip in the
 * requested language, falling back to the English CDI_FLAT_LEVELS entry when
 * the language isn't translated (or is English/unset) — same safe-default
 * pattern as getLanguageInstruction. goalType/metricKey/target/direction are
 * never translated (internal, language-independent).
 * @param {number} level
 * @param {string|null|undefined} language
 * @returns {CDI_FLAT_LEVELS[number]|undefined}
 */
function getFlatLevelText(level, language) {
  const base = CDI_FLAT_LEVELS[level];
  if (!base) return undefined;
  const translation = language ? CDI_FLAT_LEVELS_TRANSLATIONS[language]?.[level] : undefined;
  return translation ? { ...base, ...translation } : base;
}

module.exports = {
  QUALIFYING_SESSIONS_REQUIRED,
  CDI_FLAT_LEVELS,
  CDI_FLAT_LEVELS_TRANSLATIONS,
  tagCountsToMetrics,
  tagCountsToPdiCommandMetrics,
  isFlatLevelCleared,
  getFlatLevelText,
};
