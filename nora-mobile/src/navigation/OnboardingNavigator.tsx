/**
 * Onboarding Stack Navigator
 * Handles the onboarding flow screens
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingStackParamList, RootStackParamList } from './types';
import { RouteProp } from '@react-navigation/native';

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
import { WellbeingIntroScreen } from '../screens/onboarding/WellbeingIntroScreen';
import { ReassuranceScreen } from '../screens/onboarding/ReassuranceScreen';
import { DepressionQuestion1Screen } from '../screens/onboarding/DepressionQuestion1Screen';
import { DepressionQuestion2Screen } from '../screens/onboarding/DepressionQuestion2Screen';
import { SelfCareScreen } from '../screens/onboarding/SelfCareScreen';
import { FocusAreasScreen } from '../screens/onboarding/FocusAreasScreen';
import { GuidanceIntroScreen } from '../screens/onboarding/GuidanceIntroScreen';
import { GrowthIntroScreen } from '../screens/onboarding/GrowthIntroScreen';
import { PreIntroReassuranceScreen } from '../screens/onboarding/PreIntroReassuranceScreen';
import { Intro1Screen } from '../screens/onboarding/Intro1Screen';
import { Intro2Screen } from '../screens/onboarding/Intro2Screen';
import { Intro3Screen } from '../screens/onboarding/Intro3Screen';
import { SubscriptionScreen } from '../screens/onboarding/SubscriptionScreen';
import { NotificationPermissionScreen } from '../screens/onboarding/NotificationPermissionScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

interface OnboardingNavigatorProps {
  route?: RouteProp<RootStackParamList, 'Onboarding'>;
}

export const OnboardingNavigator: React.FC<OnboardingNavigatorProps> = ({ route }) => {
  const initialStep = route?.params?.initialStep;

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
      <Stack.Screen name="WellbeingIntro" component={WellbeingIntroScreen} />
      <Stack.Screen name="DepressionQuestion1" component={DepressionQuestion1Screen} />
      <Stack.Screen name="DepressionQuestion2" component={DepressionQuestion2Screen} />
      <Stack.Screen name="SelfCare" component={SelfCareScreen} />
      <Stack.Screen name="Reassurance" component={ReassuranceScreen} />
      <Stack.Screen name="FocusAreas" component={FocusAreasScreen} />
      <Stack.Screen name="GuidanceIntro" component={GuidanceIntroScreen} />
      <Stack.Screen name="GrowthIntro" component={GrowthIntroScreen} />
      <Stack.Screen name="PreIntroReassurance" component={PreIntroReassuranceScreen} />
      <Stack.Screen name="Intro1" component={Intro1Screen} />
      <Stack.Screen name="Intro2" component={Intro2Screen} />
      <Stack.Screen name="Intro3" component={Intro3Screen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
      <Stack.Screen name="NotificationPermission" component={NotificationPermissionScreen} />
    </Stack.Navigator>
  );
};
