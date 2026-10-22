import * as userStorage from '../lib/userStorage';
import { loadUserDraft, OnboardingDraft } from './onboardingDraft';

export async function checkOnboardingStep(
  authService: any
): Promise<{ step: string | null; user: any; draft?: OnboardingDraft | null }> {
  const user = await authService.getCurrentUser(true);
  await userStorage.setCurrentUserId(user.id);
  await userStorage.migrateLegacyDeviceKeys();

  // Skip profile field checks if the user already completed onboarding on this device.
  // This prevents being sent back to NameInput when the server has stale placeholder data
  // (e.g. completeOnboarding API call failed mid-onboarding, but the user finished the flow).
  const onboardingCompleted = await userStorage.getItem('@nora_onboarding_completed');
  if (!onboardingCompleted) {
    // Mid-onboarding on this device: resume at the last screen reached. The required
    // fields below are all set once ChildIssue is answered, so alone they'd send a
    // parent who closed the app on a later screen to MainTabs
    const draft = await loadUserDraft();
    if (draft) return { step: draft.lastStep.name, user, draft };
    if (!user.name || user.name === 'User') return { step: 'NameInput', user };
    if (!user.childName || user.childName === 'Child') return { step: 'ChildName', user };
    if (!user.childBirthday) return { step: 'ChildBirthday', user };
    if (!user.issue) return { step: 'ChildIssue', user };
  }

  return { step: null, user };
}
