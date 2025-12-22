/**
 * WACB Questions Configuration
 * Defines all 9 WACB question screens
 */

import { MultipleChoiceScreenProps } from '../../components/MultipleChoiceScreen';
import { getOnboardingProgress } from '../../config/onboardingProgress';

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
    progress: getOnboardingProgress('WacbQuestion1'),
  },
  {
    headerText: HEADER_TEXT,
    title: `In the past two weeks, how often has ${childName} acted up or misbehaved while eating?`,
    options: SCALE_OPTIONS,
    dataField: 'wacb.q2MealBehavior',
    nextScreen: 'WacbQuestion3',
    progress: getOnboardingProgress('WacbQuestion2'),
  },
  {
    headerText: HEADER_TEXT,
    title: `In the past two weeks, how often has ${childName} refused to listen or said "no" to rules?`,
    options: SCALE_OPTIONS,
    dataField: 'wacb.q3Disobey',
    nextScreen: 'WacbQuestion4',
    progress: getOnboardingProgress('WacbQuestion3'),
  },
  {
    headerText: HEADER_TEXT,
    title: `In the past two weeks, how often has ${childName} lost their temper or acted physically rough?`,
    options: SCALE_OPTIONS,
    dataField: 'wacb.q4Angry',
    nextScreen: 'WacbQuestion5',
    progress: getOnboardingProgress('WacbQuestion4'),
  },
  {
    headerText: HEADER_TEXT,
    title: `In the past two weeks, how often has ${childName} had a screaming fit or tantrum that was hard to stop?`,
    options: SCALE_OPTIONS,
    dataField: 'wacb.q5Scream',
    nextScreen: 'WacbQuestion6',
    progress: getOnboardingProgress('WacbQuestion5'),
  },
  {
    headerText: HEADER_TEXT,
    title: `In the past two weeks, how often has ${childName} broken things or been too rough with other people's toys?`,
    options: SCALE_OPTIONS,
    dataField: 'wacb.q6Destroy',
    nextScreen: 'WacbQuestion7',
    progress: getOnboardingProgress('WacbQuestion6'),
  },
  {
    headerText: HEADER_TEXT,
    title: `In the past two weeks, how often has ${childName} started arguments or teased others on purpose?`,
    options: SCALE_OPTIONS,
    dataField: 'wacb.q7ProvokeFights',
    nextScreen: 'WacbQuestion8',
    progress: getOnboardingProgress('WacbQuestion7'),
  },
  {
    headerText: HEADER_TEXT,
    title: `In the past two weeks, how often has ${childName} interrupted conversations or demanded constant attention?`,
    options: SCALE_OPTIONS,
    dataField: 'wacb.q8Interrupt',
    nextScreen: 'WacbQuestion9',
    progress: getOnboardingProgress('WacbQuestion8'),
  },
  {
    headerText: HEADER_TEXT,
    title: `In the past two weeks, how often has ${childName} struggled to focus or been unable to sit still?`,
    options: SCALE_OPTIONS,
    dataField: 'wacb.q9Attention',
    nextScreen: 'Reassurance', // Last question navigates to Reassurance
    continueText: 'Submit Survey',
    progress: getOnboardingProgress('WacbQuestion9'),
  },
];
