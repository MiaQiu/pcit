import type { ParentSkillLevel } from '@nora/core';
import { Ionicons } from '@expo/vector-icons';

// Parenting Level — the 9-level "Personalized Learning Journey" ladder.
// Single source of truth for level ordering, i18n keys, icons, and
// skill-tap-through, consumed by ReportScreen_v2, ReportDetailScreen,
// LevelUpModal, ProfileReportScreen, and ParentLevelDetailScreen — those
// screens previously each carried their own hardcoded copy of this list.

export const PARENT_SKILL_LEVEL_ORDER: ParentSkillLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Level number -> i18n key on profileReport.levels.* (title/skill/goal/learn/clearGoal).
export const PARENT_SKILL_LEVEL_KEYS: Record<ParentSkillLevel, string> = {
  1: 'calmBuilder',
  2: 'patienceBuilder',
  3: 'presenceBuilder',
  4: 'confidenceBuilder',
  5: 'attentionBuilder',
  6: 'communicationBuilder',
  7: 'cooperationBuilder',
  8: 'boundaryBuilder',
  9: 'confidentParent',
};

export const PARENT_SKILL_LEVEL_ICONS: Record<ParentSkillLevel, keyof typeof Ionicons.glyphMap> = {
  1: 'leaf-outline',
  2: 'hand-left-outline',
  3: 'ear-outline',
  4: 'star-outline',
  5: 'locate-outline',
  6: 'chatbubble-outline',
  7: 'flag-outline',
  8: 'shield-checkmark-outline',
  9: 'trophy-outline',
};

// Levels that tap through to a reportData.skills[] entry (ProfileReportScreen's
// Personalized Learning Journey roadmap). Levels without an entry here are
// avoid-type or PDI-only and have no dedicated skills-list item to open.
export const PARENT_SKILL_LEVEL_SKILL_LABEL: Partial<Record<ParentSkillLevel, string>> = {
  4: 'Praise (Labeled)',
  5: 'Narrate',
  6: 'Echo',
};
