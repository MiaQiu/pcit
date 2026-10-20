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
  { key: 'learn', icon: 'book-outline', activeIcon: 'book' },
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

// A goal on the "My plan" roadmap: a group of Knowledge Base strategies
// (strategyIds = myPlan.activeStrategyId values). Progress = how many of them
// are mastered; the current goal is the first one not yet complete. Copy:
// learnV2.modules.<moduleKey>.goals.<key>.{title,description}.
export interface LearnModuleGoal {
  key: string;
  strategyIds: number[];
  image: ReturnType<typeof require>;
  // Openable before it's the current goal (no lock on the roadmap).
  unlocked?: boolean;
  // Tapping opens this page instead of the plan detail: 'routine' = why a
  // routine works + the fixed routine, 'specialPlay' = the Special Playtime intro.
  opens?: 'routine' | 'specialPlay';
  // No progress bar on its roadmap card while it's the current goal.
  hideProgress?: boolean;
}

export interface LearnModuleConfig {
  cardImage: ReturnType<typeof require>;
  totalDays: number;
  days: Record<number, LearnModuleDay>;
  plan?: LearnModulePlan;
  goals?: LearnModuleGoal[];
}

export const LEARN_MODULES = {
  screenTime: {
    cardImage: require('../../assets/images/modules/screentime.jpg'),
    totalDays: 5,
    days: {
      1: {
        heroImage: require('../../assets/images/modules/module_screentime.jpeg'),
        heroAspectRatio: 1456 / 720,
        tags: [
          { key: 'duration', icon: 'time-outline' },
          { key: 'voice', icon: 'mic-outline' },
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
    goals: [
      // 1 routine, 2 plan the transition, 3 natural stopping point, 4 countdown warnings, 5 timer
      { key: 'predictable', strategyIds: [1, 2, 3, 4, 5], image: require('../../assets/images/modules/plan1.png'), opens: 'routine', hideProgress: true },
      // 8 co-regulate first
      { key: 'tantrumSkills', strategyIds: [8], image: require('../../assets/images/modules/plan3.png'), unlocked: true, opens: 'specialPlay' },
    ],
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
  // 3 focus areas for the next ending (Cheat Sheet); absent on older plans.
  focusAreas?: { title: string; detail: string }[];
  crisisTool: { isNeeded: boolean; title: string; action: string; script: string };
}

// Section of a free-form Day 1 report, split out by the server's format call.
export type ModuleReportSectionKind = 'win' | 'learned' | 'emotion' | 'strategies' | 'grow' | 'reflect' | 'expectations' | 'other';

// Key screen-time strategies a Day 1 report can recommend; standard copy in
// moduleReport.keyStrategies.<id>.
export type KeyStrategyId = 'countdown' | 'timer' | 'bridging';

// One point of the child's outburst level (0 calm – 5 aggression) over a session.
export interface EmotionTimelinePoint {
  seconds: number;
  level: number;
  label: string;
}
export interface ModuleReportSection {
  kind: ModuleReportSectionKind;
  title: string;
  body: string;
  quote?: string;  // the parent's own words from the session
  script?: string; // what to say next time
}

export interface ModuleCoachingData {
  // 'narrative': free-form Day 1 write-up (`narrative`) shown as `report`'s
  // sections. Absent: the fixed `coachingReport` cards (Day 2+, older Day 1).
  format?: 'narrative';
  narrative?: string;
  report?: { headline: string; sections: ModuleReportSection[] };
  emotionTimeline?: EmotionTimelinePoint[]; // drawn in the 'emotion' section
  recommendedStrategies?: KeyStrategyId[]; // listed in the 'strategies' section
  suggestedStrategies?: { name: string; description: string }[];
  coachingReport?: {
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

export type GoalStatus = 'completed' | 'current' | 'next' | 'later';

export interface GoalProgress extends LearnModuleGoal {
  number: number;
  mastered: number;
  total: number;
  status: GoalStatus;
}

// Goals with progress from the mastered strategies: complete when all of a
// goal's strategies are mastered; the first incomplete goal is current, the
// one after it next, the rest later.
export const getGoalProgress = (
  moduleKey: LearnModuleKey,
  masteredStrategyIds: (number | null)[],
): GoalProgress[] => {
  const goals = (LEARN_MODULES[moduleKey] as LearnModuleConfig).goals ?? [];
  const mastered = new Set(masteredStrategyIds.filter((id): id is number => id != null));
  let currentIndex = -1;
  return goals.map((goal, i) => {
    const done = goal.strategyIds.filter(id => mastered.has(id)).length;
    const complete = done === goal.strategyIds.length;
    let status: GoalStatus;
    if (complete && currentIndex === -1) status = 'completed';
    else if (currentIndex === -1) { currentIndex = i; status = 'current'; }
    else status = i === currentIndex + 1 ? 'next' : 'later';
    return { ...goal, number: i + 1, mastered: done, total: goal.strategyIds.length, status };
  });
};

// A strategy from the latest report's "Next Growth Focus" (GET
// /api/learn-modules/:moduleKey/plan suggestedStrategies) — module chat ideas.
export interface SuggestedStrategy {
  name: string;
  description: string;
}
