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

// Mirrors server/utils/parentLevelLadder.cjs's CDI_FLAT_LEVELS (levels 1-6)
// — keep target numbers and goalTypes in sync with that file by hand.
const CDI_FLAT_LEVEL_TARGETS: Partial<Record<ParentSkillLevel, {
  statKey: 'criticism' | 'command' | 'question' | 'praise' | 'narration' | 'echo';
  target: number;
  direction: GoalDirection;
  goalType: string;
}>> = {
  1: { statKey: 'criticism', target: 3, direction: 'reduce', goalType: 'AVOID_CRITICISM' },
  2: { statKey: 'command', target: 3, direction: 'reduce', goalType: 'AVOID_COMMANDS' },
  3: { statKey: 'question', target: 3, direction: 'reduce', goalType: 'AVOID_QUESTIONS' },
  4: { statKey: 'praise', target: 5, direction: 'build', goalType: 'BUILD_PRAISE' },
  5: { statKey: 'narration', target: 5, direction: 'build', goalType: 'BUILD_NARRATION' },
  6: { statKey: 'echo', target: 5, direction: 'build', goalType: 'BUILD_ECHO' },
};

/**
 * Fallback for sessions analyzed before goalDirective existed on the
 * coaching payload (see server/utils/levelGoalEngine.cjs) — reconstructs a
 * same-shape goal from the parent's current level and this session's raw
 * tag counts (reportData.stats), using the same metrics/thresholds as
 * parentSkillLevelService.cjs's level-up gate. Shared by ReportScreen_v2
 * and ReportDetailScreen, which previously each carried their own copy.
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
  const s = stats || {};

  const flatDef = CDI_FLAT_LEVEL_TARGETS[level];
  if (flatDef && mode === 'CDI') {
    const commands = s.command != null ? s.command : (s.direct_command || 0) + (s.indirect_command || 0);
    const praise = (s.product_praise || 0) + (s.action_praise || 0) + (s.growth_praise || 0) + (s.regulatory_praise || 0);
    const raw: Record<typeof flatDef.statKey, number> = {
      criticism: s.criticism || 0,
      command: commands,
      question: s.question || 0,
      praise,
      narration: s.narration || 0,
      echo: s.echo || 0,
    };
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
    return { focusSkill, currentNumber: s.direct_command || 0, targetNumber: null, description, direction: 'build', goalType: 'BUILD_COMMANDS' };
  }
  // Session mode doesn't match this level's own track (e.g. a level 7+
  // parent doing a CDI session) — no live count to show, just the goal copy.
  return { focusSkill, currentNumber: null, targetNumber: null, description, direction: 'build', goalType: null };
};
