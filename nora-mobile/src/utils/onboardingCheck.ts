import Purchases from 'react-native-purchases';
import * as userStorage from '../lib/userStorage';
import { REVENUECAT_CONFIG } from '../config/revenuecat';

export async function checkOnboardingStep(
  authService: any
): Promise<{ step: string | null; user: any }> {
  const user = await authService.getCurrentUser(true);
  await userStorage.setCurrentUserId(user.id);

  if (!user.name || user.name === 'User') return { step: 'NameInput', user };
  if (!user.childName || user.childName === 'Child') return { step: 'ChildName', user };
  if (!user.childBirthday) return { step: 'ChildBirthday', user };
  if (!user.issue) return { step: 'ChildIssue', user };

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
