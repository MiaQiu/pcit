/**
 * Navigation Types
 * Type definitions for React Navigation
 */

import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavigatorScreenParams } from '@react-navigation/native';
import { Quiz, User, DemoVideo, ParentSkillLevel } from '@nora/core';

export type RootTabParamList = {
  Home: { showModulePicker?: boolean } | undefined;
  Record: { autoStart?: boolean } | undefined;
  Log: undefined;
  Learn: undefined;
  Progress: { scrollToDevelopmental?: boolean } | undefined;
  EmotionalMassage: undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  Start: undefined;
  Login: { referralCode?: string } | undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
  CreateAccount: undefined;
  OB1: undefined;
  OB2: undefined;
  OB3: undefined;
  // _v2 variants: background image (kept as-is for now) + real text overlay,
  // for previewing before the background art gets its text-free treatment.
  OB1V2: undefined;
  OB2V2: undefined;
  OB3V2: undefined;
  ParentingIntro: undefined;
  NameInput: undefined;
  Relationship: undefined;
  ChildName: undefined;
  ChildGender: undefined;
  ChildBirthday: undefined;
  ChildIssue: undefined;
  DiagnosisStatus: undefined;
  ProfessionalSupport: undefined;
  ParentGoal: undefined;
  ParentGoalIntro: undefined;
  OBLetter: undefined;
  OBLetterV2: undefined;
  OBLetterContent: undefined;
  OBPlay1: undefined;
  OBPlay2: undefined;
  OBPlay1V2: undefined;
  OBPlay2V2: undefined;
  OBDiscipline: undefined;
  OBDisciplineV2: undefined;
  OBIntro1: undefined;
  OBIntro1V2: undefined;
  ReminderTime: undefined;
  OBIntro2: undefined;
  OBIntro2V2: undefined;
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
  LearnV3: undefined;
  DemoVideoDetail: {
    video: DemoVideo;
  };
  LessonRead: {
    lessonId: string;
    moduleKey?: string;
    title?: string;
  };
  LessonViewer: {
    lessonId: string;
    moduleKey?: string;
    nextLessonId?: string;
  };
  LessonViewerV2: {
    lessonId: string;
    moduleKey?: string;
    moduleTitle?: string;
    nextLessonId?: string;
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
  ReportV2: {
    recordingId: string;
  };
  ParentLevelDetail: {
    level: ParentSkillLevel;
  };
  ReportDetail: {
    recordingId: string;
  };
  Transcript: {
    recordingId: string;
  };
  SkillExplanation: {
    skillKey: string;
    score?: number; // Optional score for Overall Nora Score
    tip?: string; // Optional tip for Next Step section
    target?: number; // Session goal for PEN skills
  };
  SkillUtterances: {
    skillKey: string;
    recordingId: string;
    utterances: Array<{
      preceding?: { role?: string; text: string };
      main: { role?: string; text: string; tag?: string; feedback?: string };
    }>;
    target?: number; // Session goal for PEN skills
    childUtteranceCount?: number; // For Echo dynamic target explanation
  };
  WeeklyReport: { reportId: string };
  CoachChat: undefined;
  PsychologistChat: undefined;
  Referral: undefined;
  ABCLog: {
    mode: 'challenging' | 'positive';
    source: 'quick' | 'log_tab' | 'home';
  };
  HomeCardDetail: {
    cardId: string;
  };
  GetReadyToPlay: undefined;
  GetReadySection: {
    sectionKey: string;
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
