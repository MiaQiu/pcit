/**
 * Parent-input surveys for Learn modules ("Tell Nora what happens instead"),
 * rendered one question per page by LearnModuleSurveyScreen in the same
 * format as the Child Snapshot (WACB) questionnaire.
 *
 * Each module has an `initial` survey (Day 1: how screen-time endings
 * usually go) and an optional `followup` check-in (Day 2+: how practicing
 * the current strategy went).
 *
 * Copy lives in i18n under `learnV2.modules.<moduleKey>.survey` (initial) or
 * `.followupSurvey` (followup):
 *   sections.<section>                     — label shown in the header
 *   questions.<questionKey>.title          — may use {{strategy}} / {{name}}
 *   questions.<questionKey>.options.<optionKey>
 */

import type { LearnModuleKey } from './learnModules';

export type SurveyAnswerValue = string | string[];
export type SurveyAnswers = Record<string, SurveyAnswerValue>;

export interface SurveyQuestion {
  key: string;
  section?: string;
  // 'choice' (default) renders option pills; 'text' renders a free-text box.
  type?: 'choice' | 'text';
  multiSelect?: boolean;
  options?: string[];
  // Option key that reveals a free-text input when selected (multi-select only).
  otherOption?: string;
  // Text questions only — lets the parent finish without typing anything.
  optional?: boolean;
  // Follow-up questions: only asked when this returns true for prior answers.
  showIf?: (answers: SurveyAnswers) => boolean;
  // Day 2+ check-in: only asked when the parent's active strategy (its
  // Knowledge Base number, myPlan.activeStrategyId) is one of these.
  strategyIds?: number[];
  // Optional free-text note shown under the options on the same page, stored
  // under this answer key (copy: questions.<noteKey>.title).
  noteKey?: string;
}

const includesAny = (value: SurveyAnswerValue | undefined, keys: string[]) =>
  Array.isArray(value) ? value.some(v => keys.includes(v)) : !!value && keys.includes(value);

export type SurveyVariant = 'initial' | 'followup';

export const surveyI18nBase = (moduleKey: LearnModuleKey, variant: SurveyVariant) =>
  `learnV2.modules.${moduleKey}.${variant === 'followup' ? 'followupSurvey' : 'survey'}`;

const tried = (a: SurveyAnswers) => !!a.tried && a.tried !== 'notYet';

export const LEARN_MODULE_SURVEYS: Partial<Record<LearnModuleKey, Partial<Record<SurveyVariant, SurveyQuestion[]>>>> = {
  screenTime: { initial: [
    {
      key: 'knowsRoutine',
      section: 'predictability',
      options: ['yes', 'somewhat', 'notReally'],
    },
    {
      key: 'stopPoint',
      section: 'predictability',
      multiSelect: true,
      options: ['episode', 'level', 'song', 'timer', 'turnOff', 'depends'],
    },
    {
      key: 'warning',
      section: 'predictability',
      multiSelect: true,
      options: ['fiveMin', 'twoMin', 'lastOne', 'timer', 'tellThem', 'noWarning', 'depends'],
    },
    {
      key: 'nextActivityPlanned',
      section: 'transition',
      options: ['yes', 'sometimes', 'notUsually'],
    },
    {
      key: 'nextActivity',
      section: 'transition',
      multiSelect: true,
      options: ['play', 'crafts', 'puzzle', 'snack', 'outside', 'bath', 'homework', 'other'],
      otherOption: 'other',
      showIf: a => a.nextActivityPlanned === 'yes',
    },
    {
      key: 'childResponse',
      section: 'childResponse',
      multiSelect: true,
      options: ['movesOn', 'asksMore', 'complains', 'tantrum', 'refuses', 'runsAway', 'depends'],
    },
    {
      key: 'recoveryTime',
      section: 'childResponse',
      options: ['under2', 'twoToFive', 'fiveToTen', 'over10', 'needsIntervention'],
      showIf: a => includesAny(a.childResponse, ['complains', 'tantrum', 'refuses', 'runsAway']),
    },
    {
      key: 'parentResponse',
      section: 'parentResponse',
      multiSelect: true,
      options: [
        'stayClose', 'nameFeeling', 'remind', 'explain', 'repeat', 'offerActivity',
        'offerMore', 'negotiate', 'giveSpace', 'takeDevice', 'notSure',
      ],
    },
    {
      key: 'outcome',
      section: 'consistency',
      options: ['staysFinished', 'littleMore', 'usuallyMore', 'depends'],
    },
    {
      key: 'hardest',
      multiSelect: true,
      options: ['stop', 'tantrum', 'calm', 'whatToSay', 'moveOn', 'consistent', 'prepare', 'notSure'],
    },
    {
      key: 'anythingElse',
      type: 'text',
      optional: true,
    },
  ],
  // Day 2+ check-in, max 4 questions per parent: tried it? → two questions
  // for the active strategy → how long until the child moved on (+ optional note).
  followup: [
    {
      key: 'tried',
      section: 'practice',
      options: ['fully', 'partly', 'notYet'],
    },
    {
      key: 'blocker',
      section: 'practice',
      multiSelect: true,
      options: ['forgot', 'noScreenTime', 'tooTired', 'childUpset', 'unsure'],
      showIf: a => a.tried === 'notYet',
      noteKey: 'anythingElse',
    },
    // 1. Set a clear routine
    { key: 'routineKnewEnding', section: 'strategy', strategyIds: [1], showIf: tried, options: ['knew', 'remembered', 'surprised'] },
    { key: 'routineUsualTime', section: 'strategy', strategyIds: [1], showIf: tried, options: ['yes', 'differentTime', 'differentLength', 'both'] },
    // 2. Plan the transition
    { key: 'transitionToldWhen', section: 'strategy', strategyIds: [2], showIf: tried, options: ['beforeStart', 'during', 'atEnd', 'didnt'] },
    { key: 'transitionWent', section: 'strategy', strategyIds: [2], showIf: tried, options: ['rightAway', 'afterProtest', 'whenTaken', 'didnt'] },
    // 3. Natural stopping point
    { key: 'stoppingWhere', section: 'strategy', strategyIds: [3], showIf: tried, options: ['naturalEnd', 'partway'] },
    { key: 'stoppingKnew', section: 'strategy', strategyIds: [3], showIf: tried, options: ['beforeStart', 'during', 'no'] },
    // 4. Countdown warnings
    { key: 'warningsGiven', section: 'strategy', strategyIds: [4], showIf: tried, multiSelect: true, options: ['fiveMin', 'twoMin', 'lastOne', 'none'] },
    { key: 'warningsReaction', section: 'strategy', strategyIds: [4], showIf: tried, options: ['acknowledged', 'ignored', 'protested'] },
    // 5. Timer
    { key: 'timerUsed', section: 'strategy', strategyIds: [5], showIf: tried, options: ['visual', 'phoneOven', 'tvAutoOff', 'none'] },
    { key: 'timerWhoCalled', section: 'strategy', strategyIds: [5], showIf: tried, options: ['timer', 'me', 'argued'] },
    // 6. Effective command
    { key: 'commandWording', section: 'strategy', strategyIds: [6], showIf: tried, options: ['direct', 'question', 'vague', 'silent'] },
    { key: 'commandTimes', section: 'strategy', strategyIds: [6], showIf: tried, options: ['once', 'twoThree', 'moreThree'] },
    // 7. Follow-through: praise if they stopped quickly, otherwise what came next
    { key: 'followStopped', section: 'strategy', strategyIds: [7], showIf: tried, options: ['yes', 'no'] },
    { key: 'followPraise', section: 'strategy', strategyIds: [7], showIf: a => tried(a) && a.followStopped === 'yes', options: ['specific', 'general', 'no'] },
    { key: 'followNext', section: 'strategy', strategyIds: [7], showIf: a => tried(a) && a.followStopped === 'no', options: ['choice', 'turnedOff', 'repeated', 'moreTime'] },
    // 8. Co-regulate first
    { key: 'coregFirst', section: 'strategy', strategyIds: [8], showIf: tried, options: ['stayedClose', 'explained', 'tookDevice', 'notUpset'] },
    { key: 'coregKeptLimit', section: 'strategy', strategyIds: [8], showIf: tried, options: ['yes', 'bitMore', 'more'] },
    // 9. Bridging activity & modeling
    { key: 'bridgeStarted', section: 'strategy', strategyIds: [9], showIf: tried, options: ['describing', 'quietly', 'toldThem'] },
    { key: 'bridgeJoined', section: 'strategy', strategyIds: [9], showIf: tried, options: ['withinMinute', 'fewMinutes', 'didnt'] },
    // 10. Stay consistent
    { key: 'consistentProtested', section: 'strategy', strategyIds: [10], showIf: tried, options: ['yes', 'no'] },
    { key: 'consistentStayed', section: 'strategy', strategyIds: [10], showIf: tried, options: ['yes', 'bitMore', 'more'] },
    {
      key: 'moveOnTime',
      section: 'result',
      options: ['under1', 'oneToFive', 'fiveToTen', 'over10', 'needsHelp'],
      showIf: tried,
      noteKey: 'anythingElse',
    },
  ] },
};
