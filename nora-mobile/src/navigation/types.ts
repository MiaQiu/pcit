/**
 * Navigation Types
 * Type definitions for React Navigation
 */

import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { NavigatorScreenParams } from '@react-navigation/native';
import { Quiz, User, DemoVideo, ParentSkillLevel, SkillImproveResult } from '@nora/core';
import type { LearnModuleKey, LearnModuleTabKey } from '../constants/learnModules';
import type { SurveyVariant } from '../constants/learnModuleSurveys';

export type RootTabParamList = {
  Home: { showModulePicker?: boolean; refreshAt?: number } | undefined;
  Record: { autoStart?: boolean } | undefined;
  Log: undefined;
  Learn: undefined;
  Progress: { scrollToDevelopmental?: boolean } | undefined;
  EmotionalMassage: undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  Start: undefined;
  Login:
    | {
        referralCode?: string;
        // Account-last signup: the parent's email is already registered and they chose to
        // log in and overwrite that account's child profile with their onboarding answers,
        // then continue to `next`
        overrideWithOnboarding?: boolean;
        email?: string;
        next?: keyof OnboardingStackParamList;
        nextParams?: Record<string, unknown>;
      }
    | undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
  // Account-last signup: shown at the end of onboarding, then continues to `next`
  CreateAccount: { next?: keyof OnboardingStackParamList; nextParams?: Record<string, unknown> } | undefined;
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
  // Screen-time branch: one route, `step` indexes SCREEN_TIME_STEPS; `stepId`
  // (dev force-landing) names a step instead and only applies when `step` is absent
  ScreenTimeStep: { step?: number; stepId?: string; devSample?: boolean } | undefined;
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
  WacbQuestion10: undefined;
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
  // draftData: answers from a saved onboarding draft (logged-out parent resuming)
  Onboarding: { initialStep?: string; initialStepParams?: Record<string, unknown>; resumeUserData?: User; draftData?: Record<string, unknown>; wacbReturnRecordingId?: string } | undefined;
  MainTabs: NavigatorScreenParams<RootTabParamList> | undefined;
  Profile: undefined;
  // recordingId is optional — the Child Snapshot + learning-journey view is
  // user-scoped, so it opens without a session (e.g. from Profile). When
  // present, the screen also loads that session's analysis for fallback copy.
  ProfileReport: { recordingId?: string; justCompletedWacb?: boolean } | undefined;
  NotificationSettings: undefined;
  Support: undefined;
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
  ModuleDetail: {
    moduleKey: string;
  };
  LearnV3: undefined;
  // Per-module rows of horizontally-scrolling lesson cards; opened from a
  // Learn module's "Learn" tab.
  ModuleLearn: undefined;
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
    // Defaults to true. Only applies to the lesson opened initially.
    autoPlay?: boolean;
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
  ReportV3: {
    recordingId: string;
  };
  ParentLevelDetail: {
    level: ParentSkillLevel;
  };
  ReportDetail: {
    recordingId: string;
    // Passed by ReportScreen_v2/ReportScreen_v3 when this session pushed the
    // parent up a level — drives the "See you tomorrow" next-skill overview.
    leveledUp?: boolean;
    fromLevel?: ParentSkillLevel;
    toLevel?: ParentSkillLevel;
  };
  SkillImprove: {
    recordingId: string;
    skillTag: string;
    direction: 'BUILD' | 'AVOID';
    skillImprove: SkillImproveResult | null;
  };
  Transcript: {
    recordingId: string;
    initialCategory?: string; // Pre-selects a skill/avoid-item filter chip on load (e.g. from SkillUtterancesScreen)
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
  QuickGuide: {
    guide: 'why5mins' | 'whyRecord';
  };
  LearnModule: {
    moduleKey: LearnModuleKey;
    // Defaults to 1.
    day?: number;
    // Bottom-bar tab to open on (defaults to 'today').
    initialTab?: LearnModuleTabKey;
  };
  LearnModuleSurvey: {
    moduleKey: LearnModuleKey;
    // 'followup' = Day 2+ check-in on `strategy` (defaults to the Day 1 survey);
    // strategyId (Knowledge Base 1-10) picks its strategy-specific questions.
    variant?: SurveyVariant;
    strategy?: string;
    strategyId?: number;
  };
  // A Learn module's coach chat ("Daily check in"), copy of CoachChat.
  ModuleChat: {
    moduleKey: LearnModuleKey;
  };
  // "Quick Cheat Sheet" (focus areas from the last session + fixed routine).
  ModuleCheatSheet: {
    moduleKey: LearnModuleKey;
  };
  // A Learn module's detailed current plan, opened from the "My plan" roadmap.
  ModulePlanDetail: {
    moduleKey: LearnModuleKey;
  };
  // A Learn module help guide (copy: learnV2.modules.<moduleKey>.guides.<guide>).
  ModuleGuide: {
    moduleKey: LearnModuleKey;
    guide: 'howToRecord' | 'whyRecord';
  };
  ModuleReport: {
    recordingId: string;
    moduleKey: LearnModuleKey;
    leveledUp?: boolean;
    fromLevel?: ParentSkillLevel;
    toLevel?: ParentSkillLevel;
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
