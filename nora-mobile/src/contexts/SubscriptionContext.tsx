import React, { createContext, useContext, useState, useEffect } from 'react';
import Purchases, {
  PurchasesOfferings,
  PurchasesPackage,
  CustomerInfo
} from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { REVENUECAT_CONFIG } from '../config/revenuecat';
import { useAuthService } from './AppContext';

interface SubscriptionContextType {
  isSubscribed: boolean;
  offerings: PurchasesOfferings | null;
  currentPackage: PurchasesPackage | null;
  availablePackages: PurchasesPackage[];
  isLoading: boolean;
  error: string | null;
  purchasePackage: (pkg?: PurchasesPackage) => Promise<{ success: boolean }>;
  restorePurchases: () => Promise<{ restored: boolean }>;
  checkSubscriptionStatus: () => Promise<void>;
  refreshOfferings: () => Promise<PurchasesPackage[]>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode; rcReady?: boolean }> = ({ children, rcReady = false }) => {
  const authService = useAuthService();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [currentPackage, setCurrentPackage] = useState<PurchasesPackage | null>(null);
  const [availablePackages, setAvailablePackages] = useState<PurchasesPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User identification to RevenueCat is handled in:
  // - CreateAccountScreen: After successful signup
  // - LoginScreen: After successful login
  // This ensures webhooks always have the correct user ID

  // Wait for RC to be configured before calling getCustomerInfo() — prevents
  // the race condition where getCustomerInfo() fires before configure() completes
  useEffect(() => {
    if (!rcReady) return;

    // Force-refresh user so isFreeAccount is always current (not stale cache).
    authService.getCurrentUser(true).then(user => {
      if (user?.isFreeAccount) {
        setIsSubscribed(true);
        setIsLoading(false);
        loadOfferings().catch(() => {});
        return; // RevenueCat check skipped — free account takes precedence
      }
      Promise.all([
        loadOfferings(),
        checkSubscriptionStatus()
      ]).catch(err => console.error('Subscription init error:', err));
    }).catch(() => {
      Promise.all([
        loadOfferings(),
        checkSubscriptionStatus()
      ]).catch(err => console.error('Subscription init error:', err));
    });
  }, [rcReady]);

  const loadOfferings = async () => {
    try {
      const offerings = await Purchases.getOfferings();
      setOfferings(offerings);

      if (offerings.current?.availablePackages.length > 0) {
        setAvailablePackages(offerings.current.availablePackages);
        setCurrentPackage(offerings.current.availablePackages[0]);
      }
    } catch (e) {
      console.error('Error loading offerings:', e);
      setError('Failed to load subscription options');
    }
  };

  const refreshOfferings = async (): Promise<PurchasesPackage[]> => {
    try {
      const offerings = await Purchases.getOfferings();
      setOfferings(offerings);

      const packages = offerings.current?.availablePackages ?? [];
      if (packages.length > 0) {
        setAvailablePackages(packages);
        setCurrentPackage(packages[0]);
      }
      return packages;
    } catch (e) {
      console.error('Error refreshing offerings:', e);
      return [];
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      // isFreeAccount takes precedence over RevenueCat
      const user = await authService.getCurrentUser(true);
      if (user?.isFreeAccount) {
        setIsSubscribed(true);
        // Clear any stale free-session limit flag so Record tab never redirects
        AsyncStorage.removeItem('@nora_free_limit_reached').catch(() => {});
        return;
      }

      const customerInfo = await Purchases.getCustomerInfo();
      const hasEntitlement = customerInfo.entitlements.active[REVENUECAT_CONFIG.entitlements.premium] !== undefined;
      const hasActiveSubscription = hasEntitlement || customerInfo.activeSubscriptions.length > 0;
      setIsSubscribed(hasActiveSubscription);

      console.log('Subscription status:', hasActiveSubscription);
    } catch (e) {
      console.error('Error checking subscription:', e);
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  };

  const purchasePackage = async (pkg?: PurchasesPackage) => {
    const packageToPurchase = pkg || currentPackage;
    if (!packageToPurchase) {
      throw new Error('No package available');
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('Starting purchase for package:', packageToPurchase.identifier);

      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);

      const isNowSubscribed = customerInfo.entitlements.active[REVENUECAT_CONFIG.entitlements.premium] !== undefined
        || customerInfo.activeSubscriptions.length > 0;
      setIsSubscribed(isNowSubscribed);

      console.log('Purchase successful:', isNowSubscribed);

      return { success: isNowSubscribed };
    } catch (e: any) {
      if (e.userCancelled) {
        // User cancelled purchase - this is not an error
        console.log('User cancelled purchase');
        return { success: false };
      }

      console.error('Purchase error:', e);
      setError('Purchase failed. Please try again.');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const restorePurchases = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log('Restoring purchases...');

      const customerInfo = await Purchases.restorePurchases();
      const hasEntitlement = customerInfo.entitlements.active[REVENUECAT_CONFIG.entitlements.premium] !== undefined;
      const hasActiveSubscription = customerInfo.activeSubscriptions.length > 0;
      const isNowSubscribed = hasEntitlement || hasActiveSubscription;

      setIsSubscribed(isNowSubscribed);

      console.log('Restore result:', isNowSubscribed);

      return { restored: isNowSubscribed };
    } catch (e) {
      console.error('Restore error:', e);
      setError('Failed to restore purchases');
      return { restored: false };
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        isSubscribed,
        offerings,
        currentPackage,
        availablePackages,
        isLoading,
        error,
        purchasePackage,
        restorePurchases,
        checkSubscriptionStatus,
        refreshOfferings,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};
