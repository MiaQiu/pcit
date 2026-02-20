/**
 * Focus Areas - Client-side priority evaluation
 *
 * Mirrors the server's priority engine logic (server/services/priorityEngine.cjs)
 * to compute personalized focus areas from onboarding data.
 */

import { OnboardingData } from '../contexts/OnboardingContext';

// Clinical levels ordered by priority (index 0 = highest priority)
const CLINICAL_LEVELS_BY_PRIORITY = [
  'STABILIZE',
  'DE_ESCALATE',
  'DIRECT',
  'SUPPORT',
  'FLOURISH',
] as const;

type ClinicalLevel = (typeof CLINICAL_LEVELS_BY_PRIORITY)[number];

// Maps ChildIssueScreen values to clinical levels
const ISSUE_TO_LEVEL: Record<string, ClinicalLevel> = {
  tantrums: 'DE_ESCALATE',
  arguing: 'DE_ESCALATE',
  'not-listening': 'DIRECT',
  new_baby_in_the_house: 'SUPPORT',
  moving_house: 'SUPPORT',
  parental_divorce: 'SUPPORT',
  social: 'FLOURISH',
  frustration_tolerance: 'FLOURISH',
};

// Maps WACB questions to clinical levels
const WACB_LEVEL_MAP: Record<ClinicalLevel, string[]> = {
  STABILIZE: ['q4Angry', 'q6Destroy'],
  DE_ESCALATE: ['q5Scream', 'q7ProvokeFights'],
  DIRECT: ['q1Dawdle', 'q2MealBehavior', 'q3Disobey', 'q8Interrupt'],
  SUPPORT: [],
  FLOURISH: ['q9Attention'],
};

// Score threshold for WACB signal detection
const WACB_SIGNAL_THRESHOLD = 3;

// Clinical level to user-facing focus area string
const LEVEL_TO_FOCUS_AREA: Record<ClinicalLevel, string> = {
  STABILIZE: 'Stay calm during intense moments',
  DE_ESCALATE: 'Manage big feelings calmly',
  DIRECT: 'Improve listening and cooperation',
  SUPPORT: 'Navigate life changes with confidence',
  FLOURISH: 'Build stronger connection through play',
};

export const DEFAULT_FOCUS_AREAS = [
    'Build stronger connection through play',
    'Improve listening and cooperation',
    'Monitor & support child\'s social & emotional development',
];

const UNIVERSAL_DEFAULT = 'Build stronger connection through play';

/**
 * Evaluate personalized focus areas from onboarding data.
 * Mirrors evaluatePriorities() from server/services/priorityEngine.cjs.
 */
export function evaluateFocusAreas(
  issues: OnboardingData['issue'],
  wacb: OnboardingData['wacb']
): string[] {
  // Parse issues into array
  const issueArray: string[] = Array.isArray(issues)
    ? issues
    : issues
      ? [issues]
      : [];

  // Map issues to clinical levels
  const issueLevels = new Set<ClinicalLevel>();
  for (const issue of issueArray) {
    const level = ISSUE_TO_LEVEL[issue];
    if (level) {
      issueLevels.add(level);
    }
  }

  // Calculate WACB level scores
  const wacbSignals: Record<string, { score: number; hasSignal: boolean }> = {};
  if (wacb) {
    for (const [level, questions] of Object.entries(WACB_LEVEL_MAP)) {
      let totalScore = 0;
      let hasSignal = false;

      for (const question of questions) {
        const score = (wacb as Record<string, number | undefined>)[question];
        if (typeof score === 'number') {
          totalScore += score;
          if (score >= WACB_SIGNAL_THRESHOLD) {
            hasSignal = true;
          }
        }
      }

      if (hasSignal) {
        wacbSignals[level] = { score: totalScore, hasSignal: true };
      }
    }
  }

  // Combine signals and sort by priority
  const activeLevels: {
    level: ClinicalLevel;
    priorityIndex: number;
    fromBothSources: boolean;
    wacbScore: number;
  }[] = [];

  for (const level of CLINICAL_LEVELS_BY_PRIORITY) {
    const fromIssue = issueLevels.has(level);
    const fromWacb = wacbSignals[level]?.hasSignal || false;
    const wacbScore = wacbSignals[level]?.score || 0;

    if (fromIssue || fromWacb) {
      activeLevels.push({
        level,
        priorityIndex: CLINICAL_LEVELS_BY_PRIORITY.indexOf(level),
        fromBothSources: fromIssue && fromWacb,
        wacbScore,
      });
    }
  }

  // Sort: priority index asc, both sources first, higher WACB score first
  activeLevels.sort((a, b) => {
    if (a.priorityIndex !== b.priorityIndex) {
      return a.priorityIndex - b.priorityIndex;
    }
    if (a.fromBothSources !== b.fromBothSources) {
      return a.fromBothSources ? -1 : 1;
    }
    return b.wacbScore - a.wacbScore;
  });

  // No signals detected — return defaults
  if (activeLevels.length === 0) {
    return DEFAULT_FOCUS_AREAS;
  }

  // Map to focus area strings and take top 3
  const focusAreas = activeLevels
    .slice(0, 3)
    .map((entry) => LEVEL_TO_FOCUS_AREA[entry.level]);

  // Pad to 3 if fewer active levels
  while (focusAreas.length < 3) {
    if (!focusAreas.includes(UNIVERSAL_DEFAULT)) {
      focusAreas.push(UNIVERSAL_DEFAULT);
    } else {
      // Pick the next unused focus area by priority
      const unused = CLINICAL_LEVELS_BY_PRIORITY.map(
        (l) => LEVEL_TO_FOCUS_AREA[l]
      ).find((area) => !focusAreas.includes(area));
      if (unused) {
        focusAreas.push(unused);
      } else {
        break;
      }
    }
  }

  return focusAreas;
}
