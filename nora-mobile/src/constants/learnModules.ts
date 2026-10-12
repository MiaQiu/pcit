/**
 * Learn modules (topic programs such as Screen Time Management) shown in
 * LearnScreen_v2's Modules section and rendered by LearnModuleScreen.
 *
 * Each module is a sequence of days; LearnModuleScreen is a template that
 * renders one day from this config. Copy lives in i18n under
 * `learnV2.modules.<moduleKey>` — day copy under `.days.<dayNumber>`, with
 * keys named after the `key` fields below.
 */

import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IconName = ComponentProps<typeof Ionicons>['name'];

// What a button on the module screen does. LearnModuleScreen maps each to
// a navigation target (or a "coming soon" toast until the target exists).
export type LearnModuleAction = 'record' | 'howToRecord' | 'whatToRecord' | 'tellNora';

// Bottom tab bar shared by every module screen.
export const LEARN_MODULE_TABS = [
  { key: 'today', icon: 'sunny-outline', activeIcon: 'sunny' },
  { key: 'plan', icon: 'map-outline', activeIcon: 'map' },
  { key: 'collection', icon: 'documents-outline', activeIcon: 'documents' },
  { key: 'profile', icon: 'person-outline', activeIcon: 'person' },
] as const satisfies readonly { key: string; icon: IconName; activeIcon: IconName }[];

export type LearnModuleTabKey = (typeof LEARN_MODULE_TABS)[number]['key'];

export interface LearnModuleTag {
  key: string;
  icon: IconName;
}

export interface LearnModuleHelpLink {
  key: string;
  icon: IconName;
  action: LearnModuleAction;
}

export interface LearnModuleDay {
  heroImage: ReturnType<typeof require>;
  heroAspectRatio: number;
  practiceIcon: IconName;
  tags: LearnModuleTag[];
  primaryAction: { icon: IconName; action: LearnModuleAction };
  helpLinks: LearnModuleHelpLink[];
  // Optional fallback card under the practice card ("Not ready to record?").
  alternative?: { icon: IconName; action: LearnModuleAction };
}

// "My plan" tab. Copy (strategy, why, steps.<n>, crisis.title,
// crisis.items.<n>) lives in i18n under `learnV2.modules.<moduleKey>.plan`.
export interface LearnModulePlan {
  strategyIcon: IconName;
  steps: { icon: IconName; color: string }[];
  crisisItemCount: number;
}

export interface LearnModuleConfig {
  cardImage: ReturnType<typeof require>;
  totalDays: number;
  days: Record<number, LearnModuleDay>;
  plan?: LearnModulePlan;
}

export const LEARN_MODULES = {
  screenTime: {
    cardImage: require('../../assets/images/modules/screentime.jpg'),
    totalDays: 5,
    days: {
      1: {
        heroImage: require('../../assets/images/modules/module_screentime.jpeg'),
        heroAspectRatio: 1456 / 720,
        practiceIcon: 'mic-outline',
        tags: [
          { key: 'duration', icon: 'time-outline' },
          { key: 'place', icon: 'home-outline' },
          { key: 'device', icon: 'phone-portrait-outline' },
        ],
        primaryAction: { icon: 'mic-outline', action: 'record' },
        helpLinks: [
          { key: 'howTo', icon: 'play', action: 'howToRecord' },
          { key: 'whatTo', icon: 'help', action: 'whatToRecord' },
        ],
        alternative: { icon: 'document-text-outline', action: 'tellNora' },
      },
    },
    plan: {
      strategyIcon: 'timer-outline',
      steps: [
        { icon: 'stopwatch-outline', color: '#5B2EA6' },
        { icon: 'extension-puzzle', color: '#B98CE6' },
        { icon: 'heart', color: '#EF7B6B' },
      ],
      crisisItemCount: 2,
    },
  },
} satisfies Record<string, LearnModuleConfig>;

export type LearnModuleKey = keyof typeof LEARN_MODULES;

export const LEARN_MODULE_KEYS = Object.keys(LEARN_MODULES) as LearnModuleKey[];

// How the parent says practicing the active strategy went (Day 2+ recordings).
export type ModuleSelfReport = 'success' | 'struggle' | 'not_attempted';

// LLM output for a module recording (server: generateModuleCoaching →
// session.moduleCoaching), returned by /api/recordings/:id/analysis as
// `moduleCoaching`; `myPlan` also by /api/learn-modules/:moduleKey/plan.
export interface ModulePlanData {
  // Knowledge Base number (1-10); absent/null on plans generated before it existed.
  activeStrategyId?: number | null;
  activeStrategy: string;
  whyItWorks: string;
  protocolSteps: string[];
  crisisTool: { isNeeded: boolean; title: string; action: string; script: string };
}

export interface ModuleCoachingData {
  coachingReport: {
    introduction: string;
    topMoment: { title: string; quote: string; explanation: string };
    nextGrowthFocus: {
      title: string;
      explanation: string;
      strategies: { name: string; description: string }[];
      exampleQuote: string;
      rationale: string;
    };
    whatWeLearned: { title: string; description: string };
  };
  myPlan: ModulePlanData;
  // dayNumber always; the rest on Day 2+ (judged against the strategy assigned the day before).
  progress?: {
    dayNumber: number;
    practicedStrategy?: string;
    daysOnStrategy?: number;
    parentSelfReport?: ModuleSelfReport | null;
    todaysOutcome?: 'Success' | 'Struggle' | 'Did Not Attempt';
    outcomeReason?: string;
    strategyMastered?: boolean;
  };
  generatedAt?: string;
}

// One analyzed report in a module (GET /api/learn-modules/:moduleKey/days):
// report N is day N; `plan` is the plan it produced (practiced on day N+1).
export interface ModuleDay {
  dayNumber: number;
  reportId: string;
  createdAt: string;
  fromSurvey: boolean;
  plan: { activeStrategy: string; activeStrategyId: number | null; protocolSteps: string[] } | null;
}

// A strategy the parent has mastered (GET /api/learn-modules/:moduleKey/plan
// masteredStrategies): first mastery only, with the day/report it happened on.
export interface MasteredStrategy {
  strategy: string;
  strategyId: number | null;
  dayNumber: number;
  reportId: string;
}
