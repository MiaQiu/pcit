/**
 * Onboarding Progress Configuration
 * Defines the order of onboarding screens and auto-calculates progress
 */

export type OnboardingScreenName =
  | 'NameInput'
  | 'Relationship'
  | 'ChildName'
  | 'ChildGender'
  | 'ChildBirthday'
  | 'ChildIssue'
  | 'WacbQuestion1'
  | 'WacbQuestion2'
  | 'WacbQuestion3'
  | 'WacbQuestion4'
  | 'WacbQuestion5'
  | 'WacbQuestion6'
  | 'WacbQuestion7'
  | 'WacbQuestion8'
  | 'WacbQuestion9'
  | 'Reassurance'
  | 'DepressionQuestion1'
  | 'DepressionQuestion2'
  | 'SelfCare';

// Define the order of screens that should show progress
const ONBOARDING_STEPS: OnboardingScreenName[] = [
  'NameInput',          // Step 1
  'Relationship',       // Step 2
  'ChildName',          // Step 3
  'ChildGender',        // Step 4
  'ChildBirthday',      // Step 5
  'ChildIssue',         // Step 6
  'WacbQuestion1',      // Step 7
  'WacbQuestion2',      // Step 9
  'WacbQuestion3',      // Step 10
  'WacbQuestion4',      // Step 11
  'WacbQuestion5',      // Step 12
  'WacbQuestion6',      // Step 13
  'WacbQuestion7',      // Step 14
  'WacbQuestion8',      // Step 15
  'WacbQuestion9',      // Step 16
  'Reassurance',        // Step 17
  'DepressionQuestion1',// Step 18
  'DepressionQuestion2',// Step 19
  'SelfCare',           // Step 20
];

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length;

/**
 * Calculate progress percentage for a given screen
 * @param screenName - Name of the onboarding screen
 * @returns Progress percentage (0-100)
 */
export function getOnboardingProgress(screenName: OnboardingScreenName): number {
  const stepIndex = ONBOARDING_STEPS.indexOf(screenName);

  if (stepIndex === -1) {
    console.warn(`Screen "${screenName}" not found in onboarding steps`);
    return 0;
  }

  // Step number is index + 1 (since arrays are 0-indexed)
  const stepNumber = stepIndex + 1;

  // Calculate percentage: (stepNumber / totalSteps) * 100
  const progress = Math.round((stepNumber / TOTAL_ONBOARDING_STEPS) * 100);

  return progress;
}

/**
 * Get step number for a screen (1-indexed)
 */
export function getStepNumber(screenName: OnboardingScreenName): number {
  const stepIndex = ONBOARDING_STEPS.indexOf(screenName);
  return stepIndex === -1 ? 0 : stepIndex + 1;
}

/**
 * Phase-based onboarding progress
 */
export interface OnboardingPhase {
  name: string;
  screens: string[];
}

export const ONBOARDING_PHASES: OnboardingPhase[] = [
  {
    name: 'Basic data',
    screens: ['NameInput', 'Relationship', 'ChildName', 'ChildGender', 'ChildBirthday', 'ChildIssue'],
  },
  {
    name: 'Developmental snapshot',
    screens: [
      'WacbQuestion1', 'WacbQuestion2', 'WacbQuestion3', 'WacbQuestion4', 'WacbQuestion5',
      'WacbQuestion6', 'WacbQuestion7', 'WacbQuestion8', 'WacbQuestion9',
      'DepressionQuestion1', 'DepressionQuestion2',
    ],
  },
  {
    name: 'Nora advantage',
    screens: ['FocusAreas', 'GuidanceIntro', 'GrowthIntro'],
  },
  {
    name: 'Setup for success',
    screens: ['Intro1', 'Intro2', 'Intro3'],
  },
];

export interface PhaseProgress {
  phase: number;
  step: number;
  totalSteps: number;
  phaseName: string;
}

export function getPhaseProgress(screenName: string): PhaseProgress {
  for (let i = 0; i < ONBOARDING_PHASES.length; i++) {
    const phase = ONBOARDING_PHASES[i];
    const stepIndex = phase.screens.indexOf(screenName);
    if (stepIndex !== -1) {
      return {
        phase: i + 1,
        step: stepIndex + 1,
        totalSteps: phase.screens.length,
        phaseName: phase.name,
      };
    }
  }
  return { phase: 1, step: 1, totalSteps: 1, phaseName: 'Basic data' };
}
