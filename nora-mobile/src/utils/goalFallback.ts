import type { ParentSkillLevel } from '@nora/core';
import { PARENT_SKILL_LEVEL_KEYS } from '../constants/parentSkillLevels';

export type GoalDirection = 'build' | 'reduce';

export type DerivedGoal = {
  focusSkill: string;
  currentNumber: number | null;
  targetNumber: number | string | null;
  description: string;
  direction: GoalDirection;
  goalType: string | null;
};

type StatKey = 'criticism' | 'command' | 'question' | 'praise' | 'narration' | 'echo';

// Mirrors server/utils/parentLevelLadder.cjs's CDI_FLAT_LEVELS (levels 1-6)
// — keep target numbers and goalTypes in sync with that file by hand.
const CDI_FLAT_LEVEL_TARGETS: Partial<Record<ParentSkillLevel, {
  statKey: StatKey;
  target: number;
  direction: GoalDirection;
  goalType: string;
}>> = {
  1: { statKey: 'criticism', target: 3, direction: 'reduce', goalType: 'AVOID_CRITICISM' },
  2: { statKey: 'command', target: 3, direction: 'reduce', goalType: 'AVOID_COMMANDS' },
  3: { statKey: 'question', target: 3, direction: 'reduce', goalType: 'AVOID_QUESTIONS' },
  4: { statKey: 'praise', target: 10, direction: 'build', goalType: 'BUILD_PRAISE' },
  5: { statKey: 'narration', target: 10, direction: 'build', goalType: 'BUILD_NARRATION' },
  6: { statKey: 'echo', target: 10, direction: 'build', goalType: 'BUILD_ECHO' },
};

// goalType values (from server/utils/levelGoalEngine.cjs) whose baseline/
// target are a REDUCTION (get under the target), not a build-up (climb to
// it). The server's goalDirective payload carries no explicit `direction`
// field, so this is how both screens reconstruct it. Shared here instead of
// duplicated per-screen.
export const REDUCE_GOAL_TYPES = new Set(['AVOID_CRITICISM', 'AVOID_COMMANDS', 'AVOID_QUESTIONS']);

// goalType -> report.skillLabel.* key, for goalTypes that track exactly one
// PCIT skill/avoid item. Used instead of the server's flavor title (e.g.
// "The Calm Acceptance") so the card names the actual thing to work on.
// goalTypes with no single backing item (CALM_FOLLOWTHROUGH, INTEGRATE_SKILLS,
// MAINTAIN_SKILLS) fall back to the level's own skill name.
export const GOAL_TYPE_SKILL_LABEL_KEY: Record<string, string> = {
  AVOID_CRITICISM: 'criticism',
  AVOID_COMMANDS: 'commands',
  AVOID_QUESTIONS: 'questions',
  BUILD_PRAISE: 'praiseLabeleld',
  BUILD_NARRATION: 'narrate',
  BUILD_ECHO: 'echo',
};

// Extracts the 6 flat-level metrics from a session's raw tagCounts (DB
// shape). Prefers the pre-aggregated fields (praise/command) when present,
// falls back to summing granular sub-type fields — same preference order as
// server/utils/parentLevelLadder.cjs's tagCountsToMetrics.
const rawMetricsFromStats = (stats: Record<string, any> | undefined): Record<StatKey, number> => {
  const s = stats || {};
  const commands = s.command != null ? s.command : (s.direct_command || 0) + (s.indirect_command || 0);
  const praiseSum = (s.product_praise || 0) + (s.action_praise || 0) + (s.growth_praise || 0) + (s.regulatory_praise || 0);
  const praise = s.praise != null ? s.praise : praiseSum;
  return {
    criticism: s.criticism || 0,
    command: commands,
    question: s.question || 0,
    praise,
    narration: s.narration || 0,
    echo: s.echo || 0,
  };
};

/**
 * Fallback for sessions analyzed before goalDirective existed on the
 * coaching payload (see server/utils/levelGoalEngine.cjs) — reconstructs a
 * same-shape goal from the parent's current level and this session's raw
 * tag counts (reportData.stats), using the same metrics/thresholds as
 * parentSkillLevelService.cjs's level-up gate. Shared by ReportScreen_v2,
 * ReportScreen_v3, and ReportDetailScreen, which previously each carried
 * their own copy.
 */
export const deriveGoalFromLevel = (
  level: ParentSkillLevel,
  stats: Record<string, any> | undefined,
  mode: 'CDI' | 'PDI',
  t: (key: string) => string
): DerivedGoal => {
  const key = PARENT_SKILL_LEVEL_KEYS[level];
  const focusSkill = t(`profileReport.levels.${key}.skill`);
  const description = t(`profileReport.levels.${key}.clearGoal`);

  const flatDef = CDI_FLAT_LEVEL_TARGETS[level];
  if (flatDef && mode === 'CDI') {
    const raw = rawMetricsFromStats(stats);
    return {
      focusSkill,
      currentNumber: raw[flatDef.statKey],
      targetNumber: flatDef.target,
      description,
      direction: flatDef.direction,
      goalType: flatDef.goalType,
    };
  }
  if (level >= 7 && mode === 'PDI') {
    const s = stats || {};
    return { focusSkill, currentNumber: s.direct_command || 0, targetNumber: null, description, direction: 'build', goalType: 'BUILD_COMMANDS' };
  }
  // Session mode doesn't match this level's own track (e.g. a level 7+
  // parent doing a CDI session) — no live count to show, just the goal copy.
  return { focusSkill, currentNumber: null, targetNumber: null, description, direction: 'build', goalType: null };
};

/**
 * Given a goalType (from a session's goalDirective, real or derived) and a
 * DIFFERENT session's raw stats, extract that same session's count for the
 * metric the goalType tracks. Used to compare "this session's goal count"
 * against a prior session's count for that same metric (e.g. ReportScreen_v3's
 * regressed/achieved framing) — independent of what level that prior
 * session was nominally at. Only meaningful for the flat levels 1-6
 * goalTypes; returns null for anything else (levels 7-9, maintenance).
 */
export const extractMetricForGoalType = (
  goalType: string | null | undefined,
  stats: Record<string, any> | undefined
): number | null => {
  if (!goalType) return null;
  const entry = Object.values(CDI_FLAT_LEVEL_TARGETS).find(d => d?.goalType === goalType);
  if (!entry) return null;
  return rawMetricsFromStats(stats)[entry.statKey];
};

// Levels 7->8, 8->9, and level 9's own completion counter all clear after
// this many non-consecutive qualifying sessions — mirrors
// server/utils/parentLevelLadder.cjs's QUALIFYING_SESSIONS_REQUIRED.
const QUALIFYING_SESSIONS_REQUIRED = 2;

const CRITERIA_SYMBOL: Record<GoalDirection, string> = { reduce: '≤', build: '≥' };

/**
 * The literal clearance threshold for a goalType, e.g. "Criticism ≤ 3" —
 * built straight from the same target/direction data that drives clearance
 * (CDI_FLAT_LEVEL_TARGETS), NOT the hand-authored profileReport clearGoal
 * marketing sentence. Levels 7-9 have compound / qualifying-session criteria
 * with no single metric, so those three read from i18n templates that state
 * the actual gate logic in parentSkillLevelService.cjs (see
 * computeLevelUpdate's currentLevel === 7/8/9 branches).
 */
export const criteriaForGoalType = (
  goalType: string | null | undefined,
  t: (key: string, options?: Record<string, any>) => string
): string | null => {
  if (!goalType) return null;

  const flatEntry = Object.entries(CDI_FLAT_LEVEL_TARGETS).find(([, def]) => def?.goalType === goalType);
  if (flatEntry) {
    const [, def] = flatEntry;
    const labelKey = GOAL_TYPE_SKILL_LABEL_KEY[goalType];
    const skill = labelKey ? t(`report.skillLabel.${labelKey}`) : goalType;
    return t('reportV2.criteriaFlat', { skill, symbol: CRITERIA_SYMBOL[def!.direction], target: def!.target });
  }

  const buildTarget = CDI_FLAT_LEVEL_TARGETS[4]?.target ?? 10;
  switch (goalType) {
    case 'BUILD_COMMANDS':
      return t('reportV2.criteriaLevel7', { count: QUALIFYING_SESSIONS_REQUIRED });
    case 'CALM_FOLLOWTHROUGH':
      return t('reportV2.criteriaLevel8', { count: QUALIFYING_SESSIONS_REQUIRED });
    case 'INTEGRATE_SKILLS':
      return t('reportV2.criteriaLevel9', { count: QUALIFYING_SESSIONS_REQUIRED, target: buildTarget });
    default:
      return null;
  }
};

// Level -> the goalType it tracks (see CDI_FLAT_LEVELS in
// server/utils/parentLevelLadder.cjs for 1-6; 7-9 are fixed 1:1, defined in
// parentSkillLevelService.cjs).
const GOAL_TYPE_BY_LEVEL: Partial<Record<ParentSkillLevel, string>> = {
  ...Object.fromEntries(Object.entries(CDI_FLAT_LEVEL_TARGETS).map(([level, def]) => [Number(level), def!.goalType])),
  7: 'BUILD_COMMANDS',
  8: 'CALM_FOLLOWTHROUGH',
  9: 'INTEGRATE_SKILLS',
};

/**
 * Same as criteriaForGoalType, keyed by ladder level instead of a session's
 * goalType — for screens that list the static ladder (e.g.
 * ParentLevelDetailScreen) rather than showing one session's own goal.
 */
export const criteriaForLevel = (
  level: ParentSkillLevel,
  t: (key: string, options?: Record<string, any>) => string
): string | null => criteriaForGoalType(GOAL_TYPE_BY_LEVEL[level], t);
