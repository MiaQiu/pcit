import type { ParentSkillLevel } from '@nora/core';

// Parenting Level — level number -> i18n key on the shared 7-level ladder
// (same keys/copy as ProfileReportScreen's Personalized Learning Journey).
// Shared by ReportScreen_v2 and LevelUpModal.
export const PARENT_SKILL_LEVEL_KEYS: Record<ParentSkillLevel, string> = {
  1: 'playBuilder',
  2: 'confidenceBuilder',
  3: 'attentionBuilder',
  4: 'communicationBuilder',
  5: 'cooperationBuilder',
  6: 'boundaryBuilder',
  7: 'confidentParent',
};
