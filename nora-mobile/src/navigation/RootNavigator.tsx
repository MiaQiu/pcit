/**
 * Root Stack Navigator
 * Includes tab navigator and modal screens
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import Purchases from 'react-native-purchases';
import { TabNavigator } from './TabNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { REVENUECAT_CONFIG } from '../config/revenuecat';
import { ProfileScreen } from '../screens/ProfileScreen';
import { NotificationSettingsScreen } from '../screens/NotificationSettingsScreen';
import { SupportScreen } from '../screens/SupportScreen';
import { TermsAndConditionsScreen } from '../screens/TermsAndConditionsScreen';
import { PrivacyPolicyScreen } from '../screens/PrivacyPolicyScreen';
import { LessonViewerScreen } from '../screens/LessonViewerScreen';
import { QuizScreen } from '../screens/QuizScreen';
import { LessonCompleteScreen } from '../screens/LessonCompleteScreen';
import { ReportScreen } from '../screens/ReportScreen';
import { TranscriptScreen } from '../screens/TranscriptScreen';
import { RootStackParamList } from './types';
import { useAuthService } from '../contexts/AppContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const authService = useAuthService();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<string | null>(null);
  const navigationRef = useRef<any>(null);

  // Handle session expiration
  const handleSessionExpired = useCallback(() => {
    console.log('Session expired - logging out user');

    // Update auth state
    setIsAuthenticated(false);
    setOnboardingStep(null);

    // Show alert to user
    Alert.alert(
      'Session Expired',
      'Your session has expired. Please log in again to continue.',
      [
        {
          text: 'OK',
          onPress: () => {
            // Navigation will automatically show login due to isAuthenticated = false
          },
        },
      ]
    );
  }, []);

  // Handle logout
  const handleLogout = useCallback(() => {
    console.log('User logged out - resetting auth state');
    setIsAuthenticated(false);
    setOnboardingStep(null);
  }, []);

  // Set up auth callbacks
  useEffect(() => {
    authService.setSessionExpiredCallback(handleSessionExpired);
    authService.setLogoutCallback(handleLogout);
  }, [authService, handleSessionExpired, handleLogout]);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log('[Auth] Starting auth check...');

      // Initialize auth service (loads tokens from storage - FAST, local only)
      await authService.initialize();
      console.log('[Auth] Auth service initialized');

      // Check if user has valid authentication tokens (local check only)
      const authenticated = authService.isAuthenticated();
      console.log('[Auth] Authentication status:', authenticated);
      setIsAuthenticated(authenticated);

      // If authenticated, check onboarding/subscription status BEFORE showing app
      if (authenticated) {
        console.log('[Auth] Checking onboarding and subscription status...');
        try {
          const incompleteStep = await checkOnboardingCompletion();
          console.log('[Auth] Onboarding step:', incompleteStep);
          setOnboardingStep(incompleteStep);
        } catch (error) {
          console.error('[Auth] Onboarding check failed:', error);
          // On error, allow access to app (better than blocking user)
        }
      }

      // Show app after subscription check completes
      setIsLoading(false);
      console.log('[Auth] Auth check complete');
    } catch (error) {
      console.error('[Auth] Error checking auth status:', error);
      // Log full error details for debugging
      if (error instanceof Error) {
        console.error('[Auth] Error message:', error.message);
        console.error('[Auth] Error stack:', error.stack);
      }
      setIsAuthenticated(false);
      setIsLoading(false);
    }
  };

  const checkOnboardingCompletion = async (): Promise<string | null> => {
    try {
      // Get user profile for onboarding steps
      const user = await authService.getCurrentUser(true);

      // Check which onboarding step is incomplete
      // Default values from signup are 'User' and 'Child'
      if (!user.name || user.name === 'User') {
        return 'NameInput';
      }
      if (!user.childName || user.childName === 'Child') {
        return 'ChildName';
      }
      if (!user.childBirthday) {
        return 'ChildBirthday';
      }
      if (!user.issue) {
        return 'ChildIssue';
      }

      // Check subscription status using RevenueCat SDK (source of truth)
      // This is instant and doesn't depend on webhooks
      try {
        const customerInfo = await Purchases.getCustomerInfo();
        const hasActiveSubscription = customerInfo.entitlements.active[REVENUECAT_CONFIG.entitlements.premium] !== undefined;

        if (!hasActiveSubscription) {
          console.log('[Auth] No active subscription (RevenueCat), redirecting to subscription screen');
          return 'Subscription';
        }

        console.log('[Auth] Active subscription confirmed via RevenueCat');
      } catch (rcError) {
        console.error('[Auth] RevenueCat check failed, falling back to backend:', rcError);

        // Fallback to backend data if RevenueCat fails
        if (user.subscriptionStatus !== 'ACTIVE') {
          if (user.subscriptionStatus === 'INACTIVE') {
            return 'Subscription';
          }

          const now = new Date();
          const endDate = user.subscriptionEndDate
            ? new Date(user.subscriptionEndDate)
            : null;

          if (!endDate || now > endDate) {
            return 'Subscription';
          }
        }
      }

      // All steps complete and subscription active
      return null;
    } catch (error) {
      console.error('[Auth] Error checking onboarding completion:', error);
      // Return null on error - assume onboarding is complete
      // Better to show main app than block user on network error
      return null;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8C49D5" />
      </View>
    );
  }

  const shouldShowOnboarding = !isAuthenticated || onboardingStep !== null;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      {shouldShowOnboarding ? (
        <>
          <Stack.Screen
            name="Onboarding"
            component={OnboardingNavigator}
            initialParams={onboardingStep ? { initialStep: onboardingStep } : undefined}
          />
          <Stack.Screen name="MainTabs" component={TabNavigator} />
        </>
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        </>
      )}
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="Support"
        component={SupportScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="TermsAndConditions"
        component={TermsAndConditionsScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="LessonViewer"
        component={LessonViewerScreen}
        options={{
          animation: 'none',
        }}
      />
      <Stack.Screen
        name="Quiz"
        component={QuizScreen}
        options={{
          //presentation: 'modal',
          //animation: 'slide_from_bottom',
          animation: 'none',
        }}
      />
      <Stack.Screen
        name="LessonComplete"
        component={LessonCompleteScreen}
        options={{
          animation: 'none',
        }}
      />
      <Stack.Screen
        name="Report"
        component={ReportScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="Transcript"
        component={TranscriptScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
