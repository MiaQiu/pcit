/**
 * Onboarding draft (account-last signup)
 *
 * The account is created at the end of onboarding, so until then the parent's
 * answers exist only on the device. They're kept in OnboardingContext and
 * mirrored here (device-level AsyncStorage, not the user-scoped userStorage —
 * there is no user yet) together with the last screen reached, so closing the
 * app mid-onboarding resumes where the parent left off. Cleared once an account
 * holds the answers (signup, or logging in to update an existing account).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { OnboardingData } from '../contexts/OnboardingContext';
import * as userStorage from '../lib/userStorage';

const DRAFT_KEY = '@nora_onboarding_draft';
// Logged-in parents (account-first) keep the same draft per user. The server only
// knows a few required fields, so without it a parent who closes the app after
// ChildIssue would reopen on MainTabs mid-onboarding. Cleared when onboarding completes.
const USER_DRAFT_KEY = '@nora_onboarding_resume';

export type DraftStep = { name: string; params?: Record<string, unknown> };
export type OnboardingDraft = { data: Partial<OnboardingData>; lastStep: DraftStep };

// Screens that aren't part of the answer flow; never recorded as the resume point
const NON_RESUMABLE_STEPS = new Set(['Welcome', 'Start', 'Login', 'ForgotPassword', 'ResetPassword']);

export const isResumableStep = (name: string) => !NON_RESUMABLE_STEPS.has(name);

export async function saveDraft(draft: OnboardingDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn('[OnboardingDraft] save failed:', error);
  }
}

export async function loadDraft(): Promise<OnboardingDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as OnboardingDraft;
    if (!draft?.lastStep?.name) return null;
    // childBirthday stays an ISO string here (navigation params must be serializable);
    // OnboardingNavigator turns it back into a Date
    return draft;
  } catch (error) {
    console.warn('[OnboardingDraft] load failed:', error);
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch (error) {
    console.warn('[OnboardingDraft] clear failed:', error);
  }
}

export async function saveUserDraft(draft: OnboardingDraft): Promise<void> {
  try {
    await userStorage.setItem(USER_DRAFT_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn('[OnboardingDraft] user save failed:', error);
  }
}

export async function loadUserDraft(): Promise<OnboardingDraft | null> {
  try {
    const raw = await userStorage.getItem(USER_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as OnboardingDraft;
    return draft?.lastStep?.name ? draft : null;
  } catch (error) {
    console.warn('[OnboardingDraft] user load failed:', error);
    return null;
  }
}

export async function clearUserDraft(): Promise<void> {
  try {
    await userStorage.removeItem(USER_DRAFT_KEY);
  } catch (error) {
    console.warn('[OnboardingDraft] user clear failed:', error);
  }
}

type AuthServiceLike = {
  isAuthenticated: () => boolean;
  completeOnboarding: (data: any) => Promise<unknown>;
};

/**
 * Saves profile answers to the server as they're given — only for parents who
 * already have an account (accounts created account-first before this change,
 * resuming onboarding). New parents have no account yet; their answers go up
 * in one go at account creation (see buildProfilePayload).
 */
export function saveOnboardingFields(authService: AuthServiceLike, fields: Record<string, unknown>): void {
  if (!authService.isAuthenticated()) return;
  authService.completeOnboarding(fields).catch(() => {});
}

/** Every onboarding answer the server stores on User, for PATCH /api/auth/complete-onboarding. */
export function buildProfilePayload(data: OnboardingData) {
  const payload: Record<string, unknown> = {};
  if (data.name) payload.name = data.name;
  if (data.relationshipToChild) payload.relationshipToChild = data.relationshipToChild;
  if (data.childName) payload.childName = data.childName;
  if (data.childGender) payload.childGender = data.childGender;
  if (data.childBirthday) payload.childBirthday = data.childBirthday;
  if (data.issue && data.issue.length > 0) payload.issue = data.issue;
  if (data.parentGoal && data.parentGoal.length > 0) payload.parentGoal = data.parentGoal;
  if (data.diagnosisStatus) payload.diagnosisStatus = data.diagnosisStatus;
  if (data.professionalSupport && data.professionalSupport.length > 0) payload.professionalSupport = data.professionalSupport;
  return payload;
}
