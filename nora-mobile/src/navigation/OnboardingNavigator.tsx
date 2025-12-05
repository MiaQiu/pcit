/**
 * Onboarding Stack Navigator
 * Handles the onboarding flow screens
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingStackParamList } from './types';

// Import onboarding screens (will be created next)
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { StartScreen } from '../screens/onboarding/StartScreen';
import { CreateAccountScreen } from '../screens/onboarding/CreateAccountScreen';
import { NameInputScreen } from '../screens/onboarding/NameInputScreen';
import { ChildNameScreen } from '../screens/onboarding/ChildNameScreen';
import { ChildBirthdayScreen } from '../screens/onboarding/ChildBirthdayScreen';
import { ChildIssueScreen } from '../screens/onboarding/ChildIssueScreen';
import { Intro1Screen } from '../screens/onboarding/Intro1Screen';
import { Intro2Screen } from '../screens/onboarding/Intro2Screen';
import { Intro3Screen } from '../screens/onboarding/Intro3Screen';
import { SubscriptionScreen } from '../screens/onboarding/SubscriptionScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export const OnboardingNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Welcome"
        component={WelcomeScreen}
        options={{ animation: 'none' }}
      />
      <Stack.Screen name="Start" component={StartScreen} />
      <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
      <Stack.Screen name="NameInput" component={NameInputScreen} />
      <Stack.Screen name="ChildName" component={ChildNameScreen} />
      <Stack.Screen name="ChildBirthday" component={ChildBirthdayScreen} />
      <Stack.Screen name="ChildIssue" component={ChildIssueScreen} />
      <Stack.Screen name="Intro1" component={Intro1Screen} />
      <Stack.Screen name="Intro2" component={Intro2Screen} />
      <Stack.Screen name="Intro3" component={Intro3Screen} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen} />
    </Stack.Navigator>
  );
};
