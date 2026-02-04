/**
 * Navigation Types
 * Type definitions for React Navigation
 */

import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Quiz } from '@nora/core';

export type RootTabParamList = {
  Home: undefined;
  Record: undefined;
  Learn: undefined;
  Progress: { scrollToDevelopmental?: boolean } | undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  Start: undefined;
  Login: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
  SignupOptions: undefined;
  CreateAccount: undefined;
  NameInput: undefined;
  Relationship: undefined;
  ChildName: undefined;
  ChildGender: undefined;
  ChildBirthday: undefined;
  ChildIssue: undefined;
  InitialReassurance: undefined;
  WacbQuestion1: undefined;
  WacbQuestion2: undefined;
  WacbQuestion3: undefined;
  WacbQuestion4: undefined;
  WacbQuestion5: undefined;
  WacbQuestion6: undefined;
  WacbQuestion7: undefined;
  WacbQuestion8: undefined;
  WacbQuestion9: undefined;
  Reassurance: undefined;
  DepressionQuestion1: undefined;
  DepressionQuestion2: undefined;
  SelfCare: undefined;
  PreIntroReassurance: undefined;
  Intro1: undefined;
  Intro2: undefined;
  Intro3: undefined;
  Subscription: undefined;
  NotificationPermission: undefined;
};

export type RootStackParamList = {
  Onboarding: { initialStep?: string } | undefined;
  MainTabs: { screen?: string } | undefined;
  Profile: undefined;
  NotificationSettings: undefined;
  Support: undefined;
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
  LessonViewer: {
    lessonId: string;
  };
  Quiz: {
    quizId: string;
    lessonId: string;
    quiz: Quiz;
    totalSegments: number;
    currentSegment: number;
  };
  LessonComplete: {
    lessonId: string;
  };
  Report: {
    recordingId: string;
  };
  Transcript: {
    recordingId: string;
  };
  SkillExplanation: {
    skillKey: string;
    score?: number; // Optional score for Overall Nora Score
    tip?: string; // Optional tip for Next Step section
  };
};

export type RootTabNavigationProp = BottomTabNavigationProp<RootTabParamList>;
export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;
export type OnboardingStackNavigationProp = NativeStackNavigationProp<OnboardingStackParamList>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
