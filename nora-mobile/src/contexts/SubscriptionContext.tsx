import React, { createContext, useContext, useState, useEffect } from 'react';
import Purchases, {
  PurchasesOfferings,
  PurchasesPackage,
  CustomerInfo
} from 'react-native-purchases';
import { REVENUECAT_CONFIG } from '../config/revenuecat';
import { useAuthService } from './AppContext';

interface SubscriptionContextType {
  isSubscribed: boolean;
  offerings: PurchasesOfferings | null;
  currentPackage: PurchasesPackage | null;
  isLoading: boolean;
  error: string | null;
  purchasePackage: () => Promise<{ success: boolean }>;
  restorePurchases: () => Promise<{ restored: boolean }>;
  checkSubscriptionStatus: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authService = useAuthService();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);
  const [currentPackage, setCurrentPackage] = useState<PurchasesPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Identify user to RevenueCat when authenticated
  useEffect(() => {
    const identifyUser = async () => {
      try {
        const user = await authService.getCurrentUser();

        if (user?.id) {
          // CRITICAL: Ensure user ID is a string (RevenueCat requirement)
          // If your database uses integers, cast to string
          const userId = String(user.id);

          // Link RevenueCat to user ID
          await Purchases.logIn(userId);
          console.log('User identified to RevenueCat:', userId);
        }
      } catch (error) {
        console.error('Error identifying user to RevenueCat:', error);
        // Don't throw - this is non-critical for app functionality
      }
    };

    identifyUser();
  }, [authService]);

  // Load offerings and subscription status in parallel (OPTIMIZED)
  useEffect(() => {
    Promise.all([
      loadOfferings(),
      checkSubscriptionStatus()
    ]).catch(err => console.error('Subscription init error:', err));
  }, []);

  const loadOfferings = async () => {
    try {
      const offerings = await Purchases.getOfferings();
      setOfferings(offerings);

      // Get the current offering's package (should be your 3-month package)
      if (offerings.current?.availablePackages.length > 0) {
        setCurrentPackage(offerings.current.availablePackages[0]);
      }
    } catch (e) {
      console.error('Error loading offerings:', e);
      setError('Failed to load subscription options');
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      const customerInfo = await Purchases.getCustomerInfo();

      // Check if user has active "premium" entitlement
      const hasActiveSubscription = customerInfo.entitlements.active[REVENUECAT_CONFIG.entitlements.premium] !== undefined;
      setIsSubscribed(hasActiveSubscription);

      console.log('Subscription status:', hasActiveSubscription);
    } catch (e) {
      console.error('Error checking subscription:', e);
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  };

  const purchasePackage = async () => {
    if (!currentPackage) {
      throw new Error('No package available');
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('Starting purchase for package:', currentPackage.identifier);

      const { customerInfo } = await Purchases.purchasePackage(currentPackage);

      // Check if purchase was successful
      const isNowSubscribed = customerInfo.entitlements.active[REVENUECAT_CONFIG.entitlements.premium] !== undefined;
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
      const isNowSubscribed = customerInfo.entitlements.active[REVENUECAT_CONFIG.entitlements.premium] !== undefined;

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
        isLoading,
        error,
        purchasePackage,
        restorePurchases,
        checkSubscriptionStatus,
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
