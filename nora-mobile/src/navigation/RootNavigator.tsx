/**
 * Root Stack Navigator
 * Includes tab navigator and modal screens
 */

import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import { RootStackParamList } from './types';
import { useAuthService } from '../contexts/AppContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const authService = useAuthService();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<string | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      // Initialize auth service (loads tokens from storage)
      await authService.initialize();

      // Check if user has valid authentication tokens
      const authenticated = authService.isAuthenticated();
      setIsAuthenticated(authenticated);

      // If authenticated, check onboarding completion
      if (authenticated) {
        const incompleteStep = await checkOnboardingCompletion();
        setOnboardingStep(incompleteStep);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const checkOnboardingCompletion = async (): Promise<string | null> => {
    try {
      const user = await authService.getCurrentUser();

      // Check which step is incomplete
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

      // All steps complete, need to do subscription
      // Check if they've seen the intro screens
      // For now, return null to indicate onboarding is complete
      return null;
    } catch (error) {
      console.error('Error checking onboarding completion:', error);
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
