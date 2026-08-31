/**
 * Child Snapshot focus areas — shared derivation of the 4 focus-area categories
 * from a ChildSnapshotSurvey. Used by ProfileReportScreen (the "Snapshot"
 * carousel + learning journey) and ProfileScreen (the merged "Primary Focus
 * Area" row).
 *
 * The 10 Snapshot items group into 4 categories; each category's severity is
 * the worst single item in the group rather than anything hardcoded.
 */

import type { ChildSnapshotSurvey } from '@nora/core';

export type FocusSeverity = 'high' | 'moderate' | 'mild';

export type FocusAreaKey = 'routines' | 'cooperation' | 'selfControl' | 'boundaries';

// Raw 1-5 Likert (Never..Very Often) → clinical point weight, same mapping the
// server uses to score submissions (see server/routes/wacb-survey.cjs).
const VALUE_TO_POINTS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 6, 5: 7 };
export const toPoints = (raw: number | null | undefined): number | null =>
  raw != null ? (VALUE_TO_POINTS[raw] ?? raw) : null;

// A category is "high" if any item scored 6-7 pts (raw Often/Very Often),
// "moderate" if any item scored >= 3 pts (raw Sometimes), else "mild".
export const severityForPoints = (points: Array<number | null>): FocusSeverity => {
  const values = points.filter((p): p is number => p != null);
  if (values.some(p => p >= 6)) return 'high';
  if (values.some(p => p >= 3)) return 'moderate';
  return 'mild';
};

export const FOCUS_AREA_GROUPS = [
  { key: 'routines', icon: 'time-outline', iconBg: '#FDECC8', iconColor: '#C2790C', fields: ['q1Dawdle'] as const },
  { key: 'cooperation', icon: 'chatbubbles-outline', iconBg: '#E0E7FF', iconColor: '#4F46E5', fields: ['q2Disobey', 'q3Tantrum', 'q4Defiance'] as const },
  { key: 'selfControl', icon: 'locate-outline', iconBg: '#DBEAFE', iconColor: '#2563EB', fields: ['q5FocusDemand', 'q6Restless', 'q7TaskCompletion'] as const },
  { key: 'boundaries', icon: 'flash', iconBg: '#FCE0E0', iconColor: '#DC2626', fields: ['q8Destroy', 'q9Aggression', 'q10LieSteal'] as const },
] as const;

export interface FocusAreaData {
  key: FocusAreaKey;
  icon: string;
  iconBg: string;
  iconColor: string;
  severity: FocusSeverity;
}

// Carousel / list order: most severe first (high → moderate → mild). Ties keep
// the group order defined in FOCUS_AREA_GROUPS.
export const SEVERITY_RANK: Record<FocusSeverity, number> = { high: 0, moderate: 1, mild: 2 };

export const computeFocusAreas = (survey: ChildSnapshotSurvey): FocusAreaData[] =>
  FOCUS_AREA_GROUPS.map(group => ({
    key: group.key as FocusAreaKey,
    icon: group.icon,
    iconBg: group.iconBg,
    iconColor: group.iconColor,
    severity: severityForPoints(group.fields.map(field => toPoints(survey[field]))),
  })).sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

// Maps a pre-selected User.issue key (ChildIssueScreen values + legacy values)
// onto one of the 4 Snapshot categories, so the Profile "Primary Focus Area"
// row can fold the two lists together. Issues with no clean category home
// (anxiety, developmental concerns, parenting strategies, life changes, other)
// are intentionally absent — the Profile screen shows those as-is alongside
// the categories.
export const ISSUE_TO_FOCUS_AREA: Record<string, FocusAreaKey> = {
  // current ChildIssueScreen options
  big_feelings_tantrums: 'cooperation',
  listening_cooperation: 'cooperation',
  attention_focus: 'selfControl',
  adhd: 'selfControl',
  // legacy values kept for users who selected them before the picker changed
  behavior_challenges: 'cooperation',
  big_emotions: 'cooperation',
  frustration_tolerance: 'cooperation',
  defiance: 'cooperation',
  aggression: 'boundaries',
  emotional: 'cooperation',
  routine: 'routines',
};
