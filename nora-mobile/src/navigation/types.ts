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
  Progress: undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  Start: undefined;
  Login: undefined;
  SignupOptions: undefined;
  CreateAccount: undefined;
  NameInput: undefined;
  ChildName: undefined;
  ChildBirthday: undefined;
  ChildIssue: undefined;
  Intro1: undefined;
  Intro2: undefined;
  Intro3: undefined;
  Subscription: undefined;
};

export type RootStackParamList = {
  Onboarding: { initialStep?: string } | undefined;
  MainTabs: { screen?: string } | undefined;
  Profile: undefined;
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
};

export type RootTabNavigationProp = BottomTabNavigationProp<RootTabParamList>;
export type RootStackNavigationProp = NativeStackNavigationProp<RootStackParamList>;
export type OnboardingStackNavigationProp = NativeStackNavigationProp<OnboardingStackParamList>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
