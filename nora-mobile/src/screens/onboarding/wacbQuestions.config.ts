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

export const WACB_QUESTIONS: Omit<MultipleChoiceScreenProps, 'navigation'>[] = [
  {
    headerText: HEADER_TEXT,
    title: 'In the past two weeks, how often has your child taken too long to do things or dragged their feet on purpose?',
    options: SCALE_OPTIONS,
    dataField: 'wacb.q1Dawdle',
    nextScreen: 'WacbQuestion2',
  },
  {
    headerText: HEADER_TEXT,
    title: 'In the past two weeks, how often has your child acted up or misbehaved while eating?',
    options: SCALE_OPTIONS,
    dataField: 'wacb.q2MealBehavior',
    nextScreen: 'WacbQuestion3',
  },
  {
    headerText: HEADER_TEXT,
    title: 'In the past two weeks, how often has your child refused to listen or said "no" to rules?',
    options: SCALE_OPTIONS,
    dataField: 'wacb.q3Disobey',
    nextScreen: 'WacbQuestion4',
  },
  {
    headerText: HEADER_TEXT,
    title: 'In the past two weeks, how often has your child lost their temper or acted physically rough?',
    options: SCALE_OPTIONS,
    dataField: 'wacb.q4Angry',
    nextScreen: 'WacbQuestion5',
  },
  {
    headerText: HEADER_TEXT,
    title: 'In the past two weeks, how often has your child had a screaming fit or tantrum that was hard to stop?',
    options: SCALE_OPTIONS,
    dataField: 'wacb.q5Scream',
    nextScreen: 'WacbQuestion6',
  },
  {
    headerText: HEADER_TEXT,
    title: 'In the past two weeks, how often has your child broken things or been too rough with other people\'s toys?',
    options: SCALE_OPTIONS,
    dataField: 'wacb.q6Destroy',
    nextScreen: 'WacbQuestion7',
  },
  {
    headerText: HEADER_TEXT,
    title: 'In the past two weeks, how often has your child started arguments or teased others on purpose?',
    options: SCALE_OPTIONS,
    dataField: 'wacb.q7ProvokeFights',
    nextScreen: 'WacbQuestion8',
  },
  {
    headerText: HEADER_TEXT,
    title: 'In the past two weeks, how often has your child interrupted conversations or demanded constant attention?',
    options: SCALE_OPTIONS,
    dataField: 'wacb.q8Interrupt',
    nextScreen: 'WacbQuestion9',
  },
  {
    headerText: HEADER_TEXT,
    title: 'In the past two weeks, how often has your child struggled to focus or been unable to sit still?',
    options: SCALE_OPTIONS,
    dataField: 'wacb.q9Attention',
    nextScreen: 'Reassurance', // Last question navigates to Reassurance
    continueText: 'Submit Survey',
  },
];
