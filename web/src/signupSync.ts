import { completeOnboarding, convertSignupDraft, SignupDraftUpdate, submitWacbSurvey } from './api';
import { computeWacbScore, isWacbComplete, OnboardingData, resolvedIssues } from './contexts/OnboardingContext';

/** The anonymous fields a signup draft records (account-last links). Never names or free text. */
export function draftProgress(data: OnboardingData, lastStep: string): SignupDraftUpdate {
  return {
    lastStep,
    childBirthYear: data.childBirthday ? data.childBirthday.getFullYear() : null,
    concerns: data.issue,
    wacbScore: isWacbComplete(data.wacb) ? computeWacbScore(data.wacb) : null,
  };
}

async function withRetry(call: () => Promise<unknown>) {
  try {
    await call();
  } catch {
    try {
      await call();
    } catch (err) {
      // Non-blocking, like the mid-flow saves of the account-first flow: the mobile app
      // asks again for any profile field still missing (utils/onboardingCheck.ts), and a
      // missing survey shows its "Unlock My Child's Plan" card.
      console.warn('[signup] post-auth save failed:', err);
    }
  }
}

/**
 * Account-last flow: after signup or login at the end of onboarding, save the answers
 * collected so far with the same endpoints the account-first flow calls mid-flow, then
 * mark the anonymous signup draft as converted.
 */
export async function saveAnswersAfterAuth(data: OnboardingData, token: string) {
  const calls: (() => Promise<unknown>)[] = [];

  if (data.name && data.relationshipToChild && data.childName && data.childGender && data.childBirthday) {
    const profile = {
      name: data.name,
      relationshipToChild: data.relationshipToChild,
      childName: data.childName,
      childGender: data.childGender,
      childBirthday: data.childBirthday.toISOString(),
      issue: resolvedIssues(data),
    };
    calls.push(() => completeOnboarding(profile, token));
  }

  if (isWacbComplete(data.wacb)) {
    // Not asked in the 10-item survey; same default the mobile flow sends.
    const survey = { parentingStressLevel: data.wacb.parentingStressLevel || 1, ...data.wacb };
    calls.push(() => submitWacbSurvey(survey, token));
  }

  if (data.signupDraftId) {
    const draftId = data.signupDraftId;
    const progress = draftProgress(data, window.location.pathname);
    calls.push(() => convertSignupDraft(draftId, token, progress));
  }

  // In order — profile, then survey — as the account-first flow sends them.
  for (const call of calls) await withRetry(call);
}
