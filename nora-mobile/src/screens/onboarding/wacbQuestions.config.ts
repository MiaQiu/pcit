/**
 * WACB Questions Configuration
 * Defines all 9 WACB question screens
 */

import { MultipleChoiceScreenProps } from '../../components/MultipleChoiceScreen';

const SCALE_OPTIONS = [
  { value: 1, label: 'Never' },
  { value: 2, label: 'Rarely' },
  { value: 3, label: 'Sometimes' },
  { value: 4, label: 'Often' },
  { value: 5, label: 'Very often' },
];

const HEADER_TEXT = 'There are no right or wrong answers — and this is not a diagnosis.';

export const getWacbQuestions = (childName: string = 'your child'): Omit<MultipleChoiceScreenProps, 'navigation'>[] => [
  {
    headerText: HEADER_TEXT,
    title: `In the past two weeks, how often has ${childName} taken too long to do things or dragged their feet on purpose?`,
    options: SCALE_OPTIONS,
    dataField: 'wacb.q1Dawdle',
    nextScreen: 'WacbQuestion2',
    phase: 2,
    stepInPhase: 1,
    totalStepsInPhase: 11,
  },
  {
    headerText: HEADER_TEXT,
    title: `In the past two weeks, how often has ${childName} acted up or misbehaved while eating?`,
    options: SCALE_OPTIONS,
    dataField: 'wacb.q2MealBehavior',
    nextScreen: 'WacbQuestion3',
    phase: 2,
    stepInPhase: 2,
    totalStepsInPhase: 11,
  },
  {
    headerText: HEADER_TEXT,
    title: `In the past two weeks, how often has ${childName} refused to listen or said "no" to rules?`,
    options: SCALE_OPTIONS,
    dataField: 'wacb.q3Disobey',
    nextScreen: 'WacbQuestion4',
    phase: 2,
    stepInPhase: 3,
    totalStepsInPhase: 11,
  },
  {
    headerText: HEADER_TEXT,
    title: `In the past two weeks, how often has ${childName} lost their temper or acted physically rough?`,
    options: SCALE_OPTIONS,
    dataField: 'wacb.q4Angry',
    nextScreen: 'WacbQuestion5',
    phase: 2,
    stepInPhase: 4,
    totalStepsInPhase: 11,
  },
  {
    headerText: HEADER_TEXT,
    title: `In the past two weeks, how often has ${childName} had a screaming fit or tantrum that was hard to stop?`,
    options: SCALE_OPTIONS,
    dataField: 'wacb.q5Scream',
    nextScreen: 'WacbQuestion6',
    phase: 2,
    stepInPhase: 5,
    totalStepsInPhase: 11,
  },
  {
    headerText: HEADER_TEXT,
    title: `In the past two weeks, how often has ${childName} broken things or been too rough with other people's toys?`,
    options: SCALE_OPTIONS,
    dataField: 'wacb.q6Destroy',
    nextScreen: 'WacbQuestion7',
    phase: 2,
    stepInPhase: 6,
    totalStepsInPhase: 11,
  },
  {
    headerText: HEADER_TEXT,
    title: `In the past two weeks, how often has ${childName} started arguments or teased others on purpose?`,
    options: SCALE_OPTIONS,
    dataField: 'wacb.q7ProvokeFights',
    nextScreen: 'WacbQuestion8',
    phase: 2,
    stepInPhase: 7,
    totalStepsInPhase: 11,
  },
  {
    headerText: HEADER_TEXT,
    title: `In the past two weeks, how often has ${childName} interrupted conversations or demanded constant attention?`,
    options: SCALE_OPTIONS,
    dataField: 'wacb.q8Interrupt',
    nextScreen: 'WacbQuestion9',
    phase: 2,
    stepInPhase: 8,
    totalStepsInPhase: 11,
  },
  {
    headerText: HEADER_TEXT,
    title: `In the past two weeks, how often has ${childName} struggled to focus or been unable to sit still?`,
    options: SCALE_OPTIONS,
    dataField: 'wacb.q9Attention',
    nextScreen: 'WellbeingIntro', // Last question navigates to Wellbeing intro
    continueText: 'Submit Survey',
    phase: 2,
    stepInPhase: 9,
    totalStepsInPhase: 11,
  },
];
