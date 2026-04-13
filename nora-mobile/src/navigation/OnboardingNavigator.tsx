/**
 * Onboarding Stack Navigator
 * Handles the onboarding flow screens
 */

import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingStackParamList, RootStackParamList } from './types';
import { RouteProp } from '@react-navigation/native';
import { useOnboarding } from '../contexts/OnboardingContext';

// Import onboarding screens (will be created next)
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { StartScreen } from '../screens/onboarding/StartScreen';
import { LoginScreen } from '../screens/onboarding/LoginScreen';
import { ForgotPasswordScreen } from '../screens/onboarding/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/onboarding/ResetPasswordScreen';
import { SignupOptionsScreen } from '../screens/onboarding/SignupOptionsScreen';
import { CreateAccountScreen } from '../screens/onboarding/CreateAccountScreen';
import { ParentingIntroScreen } from '../screens/onboarding/ParentingIntroScreen';
import { NameInputScreen } from '../screens/onboarding/NameInputScreen';
import { RelationshipScreen } from '../screens/onboarding/RelationshipScreen';
import { ChildNameScreen } from '../screens/onboarding/ChildNameScreen';
import { ChildGenderScreen } from '../screens/onboarding/ChildGenderScreen';
import { ChildBirthdayScreen } from '../screens/onboarding/ChildBirthdayScreen';
import { ChildIssueScreen } from '../screens/onboarding/ChildIssueScreen';
import { ChildSnapshotIntroScreen } from '../screens/onboarding/ChildSnapshotIntroScreen';
import { WacbQuestion1Screen } from '../screens/onboarding/WacbQuestion1Screen';
import { WacbQuestion2Screen } from '../screens/onboarding/WacbQuestion2Screen';
import { WacbQuestion3Screen } from '../screens/onboarding/WacbQuestion3Screen';
import { WacbQuestion4Screen } from '../screens/onboarding/WacbQuestion4Screen';
import { WacbQuestion5Screen } from '../screens/onboarding/WacbQuestion5Screen';
import { WacbQuestion6Screen } from '../screens/onboarding/WacbQuestion6Screen';
import { WacbQuestion7Screen } from '../screens/onboarding/WacbQuestion7Screen';
import { WacbQuestion8Screen } from '../screens/onboarding/WacbQuestion8Screen';
import { WacbQuestion9Screen } from '../screens/onboarding/WacbQuestion9Screen';
import { Demo1Screen } from '../screens/onboarding/Demo1Screen';
import { Demo1BScreen } from '../screens/onboarding/Demo1BScreen';
import { Demo2Screen } from '../screens/onboarding/Demo2Screen';
import { Demo2BScreen } from '../screens/onboarding/Demo2BScreen';
import { Demo3Screen } from '../screens/onboarding/Demo3Screen';
import { Demo4Screen } from '../screens/onboarding/Demo4Screen';
import { Demo5Screen } from '../screens/onboarding/Demo5Screen';
import { PlanReadyScreen } from '../screens/onboarding/PlanReadyScreen';
import { ChildBehaviorProfileScreen } from '../screens/onboarding/ChildBehaviorProfileScreen';
import { FocusAreasScreen } from '../screens/onboarding/FocusAreasScreen';
import { Intro3Screen } from '../screens/onboarding/Intro3Screen';
import { PlaySession1Screen } from '../screens/onboarding/PlaySession1Screen';
import { PlaySession2Screen } from '../screens/onboarding/PlaySession2Screen';
import { PlaySession3Screen } from '../screens/onboarding/PlaySession3Screen';
import { PlaySession4Screen } from '../screens/onboarding/PlaySession4Screen';
import { PlaySession5Screen } from '../screens/onboarding/PlaySession5Screen';
import { SubscriptionScreen } from '../screens/onboarding/SubscriptionScreen';
import { NotificationPermissionScreen } from '../screens/onboarding/NotificationPermissionScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

interface OnboardingNavigatorProps {
  route?: RouteProp<RootStackParamList, 'Onboarding'>;
}

export const OnboardingNavigator: React.FC<OnboardingNavigatorProps> = ({ route }) => {
  const initialStep = route?.params?.initialStep;
  const resumeUserData = route?.params?.resumeUserData;
  const { updateData } = useOnboarding();

  // Pre-populate context with existing server data when resuming mid-onboarding.
  // Without this, OnboardingContext starts empty and SubscriptionScreen's
  // isInitialOnboarding check (data.name !== '') returns false, skipping completeOnboarding.
  useEffect(() => {
    if (resumeUserData) {
      updateData({
        name: resumeUserData.name !== 'User' ? resumeUserData.name : '',
        email: resumeUserData.email || '',
        childName: resumeUserData.childName !== 'Child' ? resumeUserData.childName : '',
        childBirthday: resumeUserData.childBirthday ? new Date(resumeUserData.childBirthday) : null,
        issue: resumeUserData.issue || '',
        relationshipToChild: resumeUserData.relationshipToChild || null,
      });
    }
  }, []);

  // Determine initial route name based on the incomplete step
  const getInitialRouteName = (): keyof OnboardingStackParamList => {
    if (initialStep) {
      // User has incomplete onboarding, start from that step
      return initialStep as keyof OnboardingStackParamList;
    }
    // Default to Welcome screen for new users
    return 'Welcome';
  };

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
      initialRouteName={getInitialRouteName()}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen name="Start" component={StartScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="SignupOptions" component={SignupOptionsScreen} />
      <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
      <Stack.Screen name="Demo1" component={Demo1Screen} />
      <Stack.Screen name="Demo1B" component={Demo1BScreen} />
      <Stack.Screen name="Demo2" component={Demo2Screen} />
      <Stack.Screen name="Demo2B" component={Demo2BScreen} />
      <Stack.Screen name="Demo3" component={Demo3Screen} />
      <Stack.Screen name="Demo4" component={Demo4Screen} />
      <Stack.Screen name="Demo5" component={Demo5Screen} />
      <Stack.Screen name="ParentingIntro" component={ParentingIntroScreen} />
      <Stack.Screen name="NameInput" component={NameInputScreen} />
      <Stack.Screen name="Relationship" component={RelationshipScreen} />
      <Stack.Screen name="ChildName" component={ChildNameScreen} />
      <Stack.Screen name="ChildGender" component={ChildGenderScreen} />
      <Stack.Screen name="ChildBirthday" component={ChildBirthdayScreen} />
      <Stack.Screen name="ChildIssue" component={ChildIssueScreen} />
      <Stack.Screen name="ChildSnapshotIntro" component={ChildSnapshotIntroScreen} />
      <Stack.Screen name="WacbQuestion1" component={WacbQuestion1Screen} />
      <Stack.Screen name="WacbQuestion2" component={WacbQuestion2Screen} />
      <Stack.Screen name="WacbQuestion3" component={WacbQuestion3Screen} />
      <Stack.Screen name="WacbQuestion4" component={WacbQuestion4Screen} />
      <Stack.Screen name="WacbQuestion5" component={WacbQuestion5Screen} />
      <Stack.Screen name="WacbQuestion6" component={WacbQuestion6Screen} />
      <Stack.Screen name="WacbQuestion7" component={WacbQuestion7Screen} />
      <Stack.Screen name="WacbQuestion8" component={WacbQuestion8Screen} />
      <Stack.Screen name="WacbQuestion9" component={WacbQuestion9Screen} />
      <Stack.Screen name="PlanReady" component={PlanReadyScreen} />
      <Stack.Screen name="ChildBehaviorProfile" component={ChildBehaviorProfileScreen} />
      <Stack.Screen name="FocusAreas" component={FocusAreasScreen} />
      <Stack.Screen name="Intro3" component={Intro3Screen} />
      <Stack.Screen name="PlaySession1" component={PlaySession1Screen} />
      <Stack.Screen name="PlaySession2" component={PlaySession2Screen} />
      <Stack.Screen name="PlaySession3" component={PlaySession3Screen} />
      <Stack.Screen name="PlaySession4" component={PlaySession4Screen} />
      <Stack.Screen name="PlaySession5" component={PlaySession5Screen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="NotificationPermission" component={NotificationPermissionScreen} />
    </Stack.Navigator>
  );
};
