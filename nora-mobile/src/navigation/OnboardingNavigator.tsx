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
import { SignupOptionsScreen } from '../screens/onboarding/SignupOptionsScreen';
import { CreateAccountScreen } from '../screens/onboarding/CreateAccountScreen';
import { NameInputScreen } from '../screens/onboarding/NameInputScreen';
import { RelationshipScreen } from '../screens/onboarding/RelationshipScreen';
import { ChildNameScreen } from '../screens/onboarding/ChildNameScreen';
import { ChildGenderScreen } from '../screens/onboarding/ChildGenderScreen';
import { ChildBirthdayScreen } from '../screens/onboarding/ChildBirthdayScreen';
import { ChildIssueScreen } from '../screens/onboarding/ChildIssueScreen';
import { Intro1Screen } from '../screens/onboarding/Intro1Screen';
import { Intro2Screen } from '../screens/onboarding/Intro2Screen';
import { Intro3Screen } from '../screens/onboarding/Intro3Screen';
import { SubscriptionScreen } from '../screens/onboarding/SubscriptionScreen';

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
      <Stack.Screen name="SignupOptions" component={SignupOptionsScreen} />
      <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
      <Stack.Screen name="NameInput" component={NameInputScreen} />
      <Stack.Screen name="Relationship" component={RelationshipScreen} />
      <Stack.Screen name="ChildName" component={ChildNameScreen} />
      <Stack.Screen name="ChildGender" component={ChildGenderScreen} />
      <Stack.Screen name="ChildBirthday" component={ChildBirthdayScreen} />
      <Stack.Screen name="ChildIssue" component={ChildIssueScreen} />
      <Stack.Screen name="Intro1" component={Intro1Screen} />
      <Stack.Screen name="Intro2" component={Intro2Screen} />
      <Stack.Screen name="Intro3" component={Intro3Screen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
    </Stack.Navigator>
  );
};
