import Purchases from 'react-native-purchases';
import * as userStorage from '../lib/userStorage';
import { REVENUECAT_CONFIG } from '../config/revenuecat';

export async function checkOnboardingStep(
  authService: any
): Promise<{ step: string | null; user: any }> {
  const user = await authService.getCurrentUser(true);
  await userStorage.setCurrentUserId(user.id);
  await userStorage.migrateLegacyDeviceKeys();

  // Skip profile field checks if the user already completed onboarding on this device.
  // This prevents being sent back to NameInput when the server has stale placeholder data
  // (e.g. completeOnboarding API call failed mid-onboarding, but the user finished the flow).
  const onboardingCompleted = await userStorage.getItem('@nora_onboarding_completed');
  if (!onboardingCompleted) {
    if (!user.name) return { step: 'NameInput', user };
    if (!user.childName) return { step: 'ChildName', user };
    if (!user.childBirthday) return { step: 'ChildBirthday', user };
    if (!user.issue) return { step: 'ChildIssue', user };
  }

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const hasActive =
      customerInfo.entitlements.active[REVENUECAT_CONFIG.entitlements.premium] !== undefined;
    if (!hasActive) return { step: 'Subscription', user };
  } catch {
    if (user.subscriptionStatus !== 'ACTIVE') {
      if (user.subscriptionStatus === 'INACTIVE') return { step: 'Subscription', user };
      const now = new Date();
      const endDate = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
      if (!endDate || now > endDate) return { step: 'Subscription', user };
    }
  }

  return { step: null, user };
}
