/**
 * Onboarding Context
 * Manages state throughout the onboarding flow
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OnboardingData {
  // User data
  name: string;
  email: string;
  authMethod: 'google' | 'apple' | 'facebook' | null;
  relationshipToChild: 'MOTHER' | 'FATHER' | 'GRANDMOTHER' | 'GRANDFATHER' | 'GUARDIAN' | 'OTHER' | null;

  // Child data
  childName: string;
  childGender: 'BOY' | 'GIRL' | 'OTHER' | null;
  childBirthday: Date | null;
  issue: string | string[];

  // WACB Survey data
  wacb?: {
    parentingStressLevel?: number;
    q1Dawdle?: number;
    q2MealBehavior?: number;
    q3Disobey?: number;
    q4Angry?: number;
    q5Scream?: number;
    q6Destroy?: number;
    q7ProvokeFights?: number;
    q8Interrupt?: number;
    q9Attention?: number;
  };

  // PHQ-2 Survey data
  phq2?: {
    q1Interest?: number;
    q2Depressed?: number;
  };

  // Reminder time selected in Intro2 (HH:mm format)
  reminderTime: string;

  // Subscription
  hasCompletedOnboarding: boolean;
}

interface OnboardingContextType {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

const defaultOnboardingData: OnboardingData = {
  name: '',
  email: '',
  authMethod: null,
  relationshipToChild: null,
  childName: '',
  childGender: null,
  childBirthday: null,
  issue: '',
  reminderTime: '19:30',
  hasCompletedOnboarding: false,
};

const OnboardingContext = createContext<OnboardingContextType | null>(null);

const ONBOARDING_STORAGE_KEY = '@nora_onboarding_completed';

interface OnboardingProviderProps {
  children: ReactNode;
}

export const OnboardingProvider: React.FC<OnboardingProviderProps> = ({ children }) => {
  const [data, setData] = useState<OnboardingData>(defaultOnboardingData);

  const updateData = (updates: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      updateData({ hasCompletedOnboarding: true });
    } catch (error) {
      console.error('Error saving onboarding completion:', error);
    }
  };

  const resetOnboarding = async () => {
    try {
      await AsyncStorage.removeItem(ONBOARDING_STORAGE_KEY);
      setData(defaultOnboardingData);
    } catch (error) {
      console.error('Error resetting onboarding:', error);
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        data,
        updateData,
        completeOnboarding,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

/**
 * Hook to access onboarding context
 */
export const useOnboarding = (): OnboardingContextType => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

/**
 * Check if user has completed onboarding
 */
export const checkOnboardingStatus = async (): Promise<boolean> => {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY);
    return value === 'true';
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    return false;
  }
};
