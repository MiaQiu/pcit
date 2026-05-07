/**
 * Root Stack Navigator
 * Includes tab navigator and modal screens
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as userStorage from '../lib/userStorage';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ForceUpdateScreen } from '../screens/ForceUpdateScreen';
import { WhatsNewModal } from '../components/WhatsNewModal';
import { useNavigation } from '@react-navigation/native';
import { TabNavigator } from './TabNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
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
import { SkillExplanationScreen } from '../screens/SkillExplanationScreen';
import { SkillUtterancesScreen } from '../screens/SkillUtterancesScreen';
import { WeeklyReportScreen } from '../screens/WeeklyReportScreen';
import { ModuleDetailScreen } from '../screens/ModuleDetailScreen';
import { CoachChatScreen } from '../screens/CoachChatScreen';
import { PsychologistChatScreen } from '../screens/PsychologistChatScreen';
import { ReferralScreen } from '../screens/ReferralScreen';
import { RootStackParamList } from './types';
import { useAuthService } from '../contexts/AppContext';
import { useCoachUnread } from '../contexts/CoachUnreadContext';
import { useUploadProcessing } from '../contexts/UploadProcessingContext';
import { User } from '@nora/core';
import amplitudeService from '../services/amplitudeService';
import { checkOnboardingStep } from '../utils/onboardingCheck';

const APP_VERSION: string = require('../../app.json').expo.version;
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

function isVersionBelow(current: string, minimum: string): boolean {
  const parse = (v: string) => v.split('.').map(Number);
  const [cMaj, cMin, cPat] = parse(current);
  const [mMaj, mMin, mPat] = parse(minimum);
  if (cMaj !== mMaj) return cMaj < mMaj;
  if (cMin !== mMin) return cMin < mMin;
  return cPat < mPat;
}

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const authService = useAuthService();
  const { reinitialize: reinitializeUnread } = useCoachUnread();
  const { reinitialize: reinitializeUpload } = useUploadProcessing();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<string | null>(null);
  const [resumeUserData, setResumeUserData] = useState<User | null>(null);
  const [updateRequired, setUpdateRequired] = useState(false);
  const [softUpdate, setSoftUpdate] = useState<{ version: string; whatsNew: string[] } | null>(null);
  const navigationRef = useRef<any>(null);

  // Handle session expiration
  const handleSessionExpired = useCallback(async () => {
    console.log('Session expired - logging out user');

    await userStorage.clearCurrentUser();
    amplitudeService.reset();

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
  const handleLogout = useCallback(async () => {
    console.log('User logged out - resetting auth state');
    await userStorage.clearCurrentUser();
    amplitudeService.reset();
    setIsAuthenticated(false);
    setOnboardingStep(null);
  }, []);

  // Set up auth callbacks
  useEffect(() => {
    authService.setSessionExpiredCallback(handleSessionExpired);
    authService.setLogoutCallback(handleLogout);
  }, [authService, handleSessionExpired, handleLogout]);

  const dismissSoftUpdate = async () => {
    if (softUpdate) {
      await AsyncStorage.setItem(`@nora_soft_update_seen_${softUpdate.version}`, 'true');
    }
    setSoftUpdate(null);
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      console.log('[Auth] Starting auth check...');

      // Check minimum required version before anything else
      try {
        const res = await fetch(`${API_URL}/api/config/app-version`);
        if (res.ok) {
          const { minRequiredVersion, latestVersion, whatsNew } = await res.json();
          if (minRequiredVersion && isVersionBelow(APP_VERSION, minRequiredVersion)) {
            console.log(`[Version] Update required: current=${APP_VERSION} min=${minRequiredVersion}`);
            setUpdateRequired(true);
            setIsLoading(false);
            return;
          }
          if (latestVersion && isVersionBelow(APP_VERSION, latestVersion) && Array.isArray(whatsNew)) {
            const seenKey = `@nora_soft_update_seen_${latestVersion}`;
            const alreadySeen = await AsyncStorage.getItem(seenKey);
            if (!alreadySeen) {
              console.log(`[Version] Soft update available: current=${APP_VERSION} latest=${latestVersion}`);
              setSoftUpdate({ version: latestVersion, whatsNew });
            }
          }
        }
      } catch (versionError) {
        // Non-blocking: if the version check fails, let the user in
        console.warn('[Version] Version check failed, skipping:', versionError);
      }

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
          const { step: incompleteStep, user } = await checkOnboardingCompletion();
          console.log('[Auth] Onboarding step:', incompleteStep);
          setOnboardingStep(incompleteStep);
          if (incompleteStep) {
            setResumeUserData(user);
          }
          // Identify user on session restore so events are never anonymous
          amplitudeService.identifyUser(user.id, {
            email: user.email,
            name: user.name,
            currentStreak: user.currentStreak || 0,
            longestStreak: user.longestStreak || 0,
            subscriptionPlan: user.subscriptionPlan,
            subscriptionStatus: user.subscriptionStatus,
            childAge: user.childBirthYear ? new Date().getFullYear() - user.childBirthYear : undefined,
            relationshipToChild: user.relationshipToChild,
          });
        } catch (error) {
          console.error('[Auth] Onboarding check failed, falling back to login:', error);
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
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

  const checkOnboardingCompletion = async (): Promise<{ step: string | null; user: User }> => {
    const result = await checkOnboardingStep(authService);
    reinitializeUnread(result.user.id);
    await reinitializeUpload();
    return result;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8C49D5" />
      </View>
    );
  }

  if (updateRequired) {
    return <ForceUpdateScreen />;
  }

  const shouldShowOnboarding = !isAuthenticated || onboardingStep !== null;

  return (
    <>
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
            initialParams={onboardingStep ? { initialStep: onboardingStep, resumeUserData: resumeUserData ?? undefined } : undefined}
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
        name="ModuleDetail"
        component={ModuleDetailScreen}
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
      <Stack.Screen
        name="SkillExplanation"
        component={SkillExplanationScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="SkillUtterances"
        component={SkillUtterancesScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="WeeklyReport"
        component={WeeklyReportScreen}
        options={{
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="CoachChat"
        component={CoachChatScreen}
        options={{
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="PsychologistChat"
        component={PsychologistChatScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="Referral"
        component={ReferralScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
    </Stack.Navigator>
    {softUpdate && (
      <WhatsNewModal
        visible
        version={softUpdate.version}
        whatsNew={softUpdate.whatsNew}
        onDismiss={dismissSoftUpdate}
      />
    )}
    </>
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
