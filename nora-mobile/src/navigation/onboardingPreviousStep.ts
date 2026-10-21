/**
 * The screen before a given onboarding screen, for rebuilding history behind a
 * screen the app restored directly (a saved draft, or the server resume point).
 * Without it, a restored screen is alone in the stack: swipe-back does nothing
 * and screens without a back button leave the parent stuck.
 *
 * Mirrors the forward navigation in each screen; see docs/onboarding.md.
 */

import type { OnboardingData } from '../contexts/OnboardingContext';
import { hasAdhdOrDevelopmentalConcern } from '../utils/onboardingBranch';
import { SCREEN_TIME_STEPS, adjacentStepIndex } from '../screens/onboarding/screenTime/screenTimeFlow';

export type OnboardingStep = { name: string; params?: object };

const LINEAR_PREVIOUS: Record<string, string> = {
  Login: 'Start',
  ForgotPassword: 'Login',
  Relationship: 'NameInput',
  ChildName: 'Relationship',
  ChildGender: 'ChildName',
  ChildBirthday: 'ChildGender',
  ChildIssue: 'ChildBirthday',
  DiagnosisStatus: 'ChildIssue',
  ProfessionalSupport: 'DiagnosisStatus',
  ParentGoal: 'ChildIssue',
  OBLetterV2: 'ParentGoalIntro',
  OBLetterContent: 'OBLetterV2',
  OBPlay1V2: 'OBLetterContent',
  OBPlay2V2: 'OBPlay1V2',
  OBDisciplineV2: 'OBPlay2V2',
  OBIntro1V2: 'OBDisciplineV2',
  // CreateAccount is done by the time these show
  ReminderTime: 'OBIntro1V2',
  OBIntro2V2: 'ReminderTime',
};

const screenTimeStepBefore = (index: number, data: Partial<OnboardingData>): OnboardingStep => {
  const prev = adjacentStepIndex(index, -1, data.screenTime ?? {});
  return prev >= 0 ? { name: 'ScreenTimeStep', params: { step: prev } } : { name: 'ChildIssue' };
};

export function previousOnboardingStep(
  step: OnboardingStep,
  data: Partial<OnboardingData>,
  isAuthenticated: boolean,
): OnboardingStep | null {
  const params = (step.params ?? {}) as Record<string, unknown>;
  switch (step.name) {
    // Account-first: the account is made by OB1V2, so history stops there
    case 'NameInput':
      return { name: 'OB2V2' };
    case 'OB2V2':
      return { name: 'OB1V2' };
    case 'OB1V2':
      return isAuthenticated ? null : { name: 'CreateAccount' };
    case 'ParentGoalIntro':
      return { name: hasAdhdOrDevelopmentalConcern(data.issue) ? 'ProfessionalSupport' : 'ParentGoal' };
    case 'ScreenTimeStep': {
      const index =
        typeof params.step === 'number' ? params.step : SCREEN_TIME_STEPS.findIndex((s) => s.id === params.stepId);
      return index > 0 ? screenTimeStepBefore(index, data) : { name: 'ChildIssue' };
    }
    case 'CreateAccount': {
      if (!params.next) return { name: 'Start' };
      if (params.next !== 'ScreenTimeStep') return { name: 'OBIntro1V2' };
      const nextParams = (params.nextParams ?? {}) as Record<string, unknown>;
      const planIndex = typeof nextParams.step === 'number' ? nextParams.step : SCREEN_TIME_STEPS.length - 1;
      return screenTimeStepBefore(planIndex, data);
    }
    default: {
      const name = LINEAR_PREVIOUS[step.name];
      return name ? { name } : null;
    }
  }
}
