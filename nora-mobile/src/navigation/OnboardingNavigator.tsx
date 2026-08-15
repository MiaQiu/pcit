/**
 * Onboarding Stack Navigator
 * Handles the onboarding flow screens
 */

import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OnboardingStackParamList, RootStackParamList } from './types';
import { RouteProp } from '@react-navigation/native';
import { useOnboarding } from '../contexts/OnboardingContext';

// Flow: Welcome → Start → (Login | CreateAccount) → OB1–3 →
//   NameInput → Relationship → ChildName → ChildGender → ChildBirthday →
//   ChildIssue → [branch] → ParentGoalIntro → OBLetter → OBLetterContent →
//   OBPlay1 → OBPlay2 → OBDiscipline → OBIntro1 → ReminderTime → OBIntro2 →
//   MainTabs (OBIntro2 completes onboarding directly)
// Branch at ChildIssue: selecting ADHD Support or Developmental Concerns routes
// through DiagnosisStatus → ProfessionalSupport instead of ParentGoal (see
// ChildIssueScreen's nextScreen resolver / hasAdhdOrDevelopmentalConcern()).
// Both paths rejoin at ParentGoalIntro.
// Subscription is a standalone screen entered from RecordScreen / ProfileScreen.
// Demo1–5/Demo1B/Demo2B/ParentingIntro/ChildSnapshotIntro/WacbQuestion1–9/
// ChildBehaviorProfile/Intro3/PlaySession1–5/NotificationPermission remain
// registered (unreachable from the linear flow) so deep links / old resume
// state referencing them don't crash.
// OB1V2/OB2V2/OB3V2/OBLetterV2/OBPlay1V2/OBPlay2V2/OBDisciplineV2 are preview
// variants of the OBTemplate image screens: same (still text-baked-in)
// background art with real text overlaid on top, ready to line up once a
// text-free version of the art lands. Not wired into the linear flow yet —
// preview one via RootNavigator's DEV_FORCE_ONBOARDING_SCREEN.
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { StartScreen } from '../screens/onboarding/StartScreen';
import { LoginScreen } from '../screens/onboarding/LoginScreen';
import { ForgotPasswordScreen } from '../screens/onboarding/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/onboarding/ResetPasswordScreen';
import { CreateAccountScreen } from '../screens/onboarding/CreateAccountScreen';
import { OB1Screen } from '../screens/onboarding/OB1Screen';
import { OB2Screen } from '../screens/onboarding/OB2Screen';
import { OB3Screen } from '../screens/onboarding/OB3Screen';
import { OB1Screen_v2 } from '../screens/onboarding/OB1Screen_v2';
import { OB2Screen_v2 } from '../screens/onboarding/OB2Screen_v2';
import { OB3Screen_v2 } from '../screens/onboarding/OB3Screen_v2';
import { Demo1Screen } from '../screens/onboarding/Demo1Screen';
import { Demo1BScreen } from '../screens/onboarding/Demo1BScreen';
import { Demo2Screen } from '../screens/onboarding/Demo2Screen';
import { Demo2BScreen } from '../screens/onboarding/Demo2BScreen';
import { Demo3Screen } from '../screens/onboarding/Demo3Screen';
import { Demo4Screen } from '../screens/onboarding/Demo4Screen';
import { Demo5Screen } from '../screens/onboarding/Demo5Screen';
import { ParentingIntroScreen } from '../screens/onboarding/ParentingIntroScreen';
import { NameInputScreen } from '../screens/onboarding/NameInputScreen';
import { RelationshipScreen } from '../screens/onboarding/RelationshipScreen';
import { ChildNameScreen } from '../screens/onboarding/ChildNameScreen';
import { ChildGenderScreen } from '../screens/onboarding/ChildGenderScreen';
import { ChildBirthdayScreen } from '../screens/onboarding/ChildBirthdayScreen';
import { ChildIssueScreen } from '../screens/onboarding/ChildIssueScreen';
import { DiagnosisStatusScreen } from '../screens/onboarding/DiagnosisStatusScreen';
import { ProfessionalSupportScreen } from '../screens/onboarding/ProfessionalSupportScreen';
import { ParentGoalScreen } from '../screens/onboarding/ParentGoalScreen';
import { ParentGoalIntroScreen } from '../screens/onboarding/ParentGoalIntroScreen';
import { OBLetterScreen } from '../screens/onboarding/OBLetterScreen';
import { OBLetterScreen_v2 } from '../screens/onboarding/OBLetterScreen_v2';
import { OBLetterContentScreen } from '../screens/onboarding/OBLetterContentScreen';
import { OBPlay1Screen } from '../screens/onboarding/OBPlay1Screen';
import { OBPlay2Screen } from '../screens/onboarding/OBPlay2Screen';
import { OBPlay1Screen_v2 } from '../screens/onboarding/OBPlay1Screen_v2';
import { OBPlay2Screen_v2 } from '../screens/onboarding/OBPlay2Screen_v2';
import { OBDisciplineScreen } from '../screens/onboarding/OBDisciplineScreen';
import { OBDisciplineScreen_v2 } from '../screens/onboarding/OBDisciplineScreen_v2';
import { OBIntro1Screen } from '../screens/onboarding/OBIntro1Screen';
import { OBIntro1Screen_v2 } from '../screens/onboarding/OBIntro1Screen_v2';
import { ReminderTimeScreen } from '../screens/onboarding/ReminderTimeScreen';
import { OBIntro2Screen } from '../screens/onboarding/OBIntro2Screen';
import { OBIntro2Screen_v2 } from '../screens/onboarding/OBIntro2Screen_v2';
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
import { ChildBehaviorProfileScreen } from '../screens/onboarding/ChildBehaviorProfileScreen';
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
        name: (resumeUserData.name && resumeUserData.name !== 'User') ? resumeUserData.name : '',
        email: resumeUserData.email || '',
        childName: (resumeUserData.childName && resumeUserData.childName !== 'Child') ? resumeUserData.childName : '',
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
      <Stack.Screen name="CreateAccount" component={CreateAccountScreen} />
      <Stack.Screen name="OB1" component={OB1Screen} />
      <Stack.Screen name="OB2" component={OB2Screen} />
      <Stack.Screen name="OB3" component={OB3Screen} />
      <Stack.Screen name="OB1V2" component={OB1Screen_v2} />
      <Stack.Screen name="OB2V2" component={OB2Screen_v2} />
      <Stack.Screen name="OB3V2" component={OB3Screen_v2} />
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
      <Stack.Screen name="DiagnosisStatus" component={DiagnosisStatusScreen} />
      <Stack.Screen name="ProfessionalSupport" component={ProfessionalSupportScreen} />
      <Stack.Screen name="ParentGoal" component={ParentGoalScreen} />
      <Stack.Screen name="ParentGoalIntro" component={ParentGoalIntroScreen} />
      <Stack.Screen name="OBLetter" component={OBLetterScreen} />
      <Stack.Screen name="OBLetterV2" component={OBLetterScreen_v2} />
      <Stack.Screen name="OBLetterContent" component={OBLetterContentScreen} />
      <Stack.Screen name="OBPlay1" component={OBPlay1Screen} />
      <Stack.Screen name="OBPlay2" component={OBPlay2Screen} />
      <Stack.Screen name="OBPlay1V2" component={OBPlay1Screen_v2} />
      <Stack.Screen name="OBPlay2V2" component={OBPlay2Screen_v2} />
      <Stack.Screen name="OBDiscipline" component={OBDisciplineScreen} />
      <Stack.Screen name="OBDisciplineV2" component={OBDisciplineScreen_v2} />
      <Stack.Screen name="OBIntro1" component={OBIntro1Screen} />
      <Stack.Screen name="OBIntro1V2" component={OBIntro1Screen_v2} />
      <Stack.Screen name="ReminderTime" component={ReminderTimeScreen} />
      <Stack.Screen name="OBIntro2" component={OBIntro2Screen} />
      <Stack.Screen name="OBIntro2V2" component={OBIntro2Screen_v2} />
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
      <Stack.Screen name="ChildBehaviorProfile" component={ChildBehaviorProfileScreen} />
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
