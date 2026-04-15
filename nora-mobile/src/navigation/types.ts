/**
 * Navigation Types
 * Type definitions for React Navigation
 */

import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavigatorScreenParams } from '@react-navigation/native';
import { Quiz, User } from '@nora/core';

export type RootTabParamList = {
  Home: { showModulePicker?: boolean } | undefined;
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
  CreateAccount: undefined;
  ParentingIntro: undefined;
  NameInput: undefined;
  Relationship: undefined;
  ChildName: undefined;
  ChildGender: undefined;
  ChildBirthday: undefined;
  ChildIssue: undefined;
  ChildSnapshotIntro: undefined;
  WacbQuestion1: undefined;
  WacbQuestion2: undefined;
  WacbQuestion3: undefined;
  WacbQuestion4: undefined;
  WacbQuestion5: undefined;
  WacbQuestion6: undefined;
  WacbQuestion7: undefined;
  WacbQuestion8: undefined;
  WacbQuestion9: undefined;
  Demo1: undefined;
  Demo1B: undefined;
  Demo2: undefined;
  Demo2B: undefined;
  Demo3: undefined;
  Demo4: undefined;
  Demo5: undefined;
  ChildBehaviorProfile: { locked?: boolean } | undefined;
  Intro3: undefined;
  PlaySession1: undefined;
  PlaySession2: undefined;
  PlaySession3: undefined;
  PlaySession4: undefined;
  PlaySession5: undefined;
  Subscription: undefined;
  NotificationPermission: undefined;
};

export type RootStackParamList = {
  Onboarding: { initialStep?: string; resumeUserData?: User } | undefined;
  MainTabs: NavigatorScreenParams<RootTabParamList> | undefined;
  Profile: undefined;
  NotificationSettings: undefined;
  Support: undefined;
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
  ModuleDetail: {
    moduleKey: string;
  };
  LessonViewer: {
    lessonId: string;
    moduleKey?: string;
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
  WeeklyReport: { reportId: string };
};

export type RootTabNavigationProp = BottomTabNavigationProp<RootTabParamList>;
export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;
export type OnboardingStackNavigationProp = NativeStackNavigationProp<OnboardingStackParamList>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
