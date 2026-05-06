/**
 * WACB Questions Configuration
 * Defines all 9 WACB question screens
 */

import { TFunction } from 'i18next';
import { MultipleChoiceScreenProps } from '../../components/MultipleChoiceScreen';

const getScaleOptions = (t: TFunction) => [
  { value: 1, label: t('onboarding.wacb.scaleNever') },
  { value: 2, label: t('onboarding.wacb.scaleRarely') },
  { value: 3, label: t('onboarding.wacb.scaleSometimes') },
  { value: 4, label: t('onboarding.wacb.scaleOften') },
  { value: 5, label: t('onboarding.wacb.scaleVeryOften') },
];

export const getWacbQuestions = (childName: string = 'your child', t: TFunction): Omit<MultipleChoiceScreenProps, 'navigation'>[] => {
  const SCALE_OPTIONS = getScaleOptions(t);
  const HEADER_TEXT = t('onboarding.wacb.headerText');
  const name = childName;

  return [
    {
      headerText: HEADER_TEXT,
      title: t('onboarding.wacb.q1', { name }),
      options: SCALE_OPTIONS,
      dataField: 'wacb.q1Dawdle',
      nextScreen: 'WacbQuestion2',
      prevScreen: 'ChildSnapshotIntro',
      phase: 2,
      stepInPhase: 1,
      totalStepsInPhase: 9,
      screenName: 'wacb_q1',
      screenStep: 19,
    },
    {
      headerText: HEADER_TEXT,
      title: t('onboarding.wacb.q2', { name }),
      options: SCALE_OPTIONS,
      dataField: 'wacb.q2MealBehavior',
      nextScreen: 'WacbQuestion3',
      prevScreen: 'WacbQuestion1',
      phase: 2,
      stepInPhase: 2,
      totalStepsInPhase: 9,
      screenName: 'wacb_q2',
      screenStep: 20,
    },
    {
      headerText: HEADER_TEXT,
      title: t('onboarding.wacb.q3', { name }),
      options: SCALE_OPTIONS,
      dataField: 'wacb.q3Disobey',
      nextScreen: 'WacbQuestion4',
      prevScreen: 'WacbQuestion2',
      phase: 2,
      stepInPhase: 3,
      totalStepsInPhase: 9,
      screenName: 'wacb_q3',
      screenStep: 21,
    },
    {
      headerText: HEADER_TEXT,
      title: t('onboarding.wacb.q4', { name }),
      options: SCALE_OPTIONS,
      dataField: 'wacb.q4Angry',
      nextScreen: 'WacbQuestion5',
      prevScreen: 'WacbQuestion3',
      phase: 2,
      stepInPhase: 4,
      totalStepsInPhase: 9,
      screenName: 'wacb_q4',
      screenStep: 22,
    },
    {
      headerText: HEADER_TEXT,
      title: t('onboarding.wacb.q5', { name }),
      options: SCALE_OPTIONS,
      dataField: 'wacb.q5Scream',
      nextScreen: 'WacbQuestion6',
      prevScreen: 'WacbQuestion4',
      phase: 2,
      stepInPhase: 5,
      totalStepsInPhase: 9,
      screenName: 'wacb_q5',
      screenStep: 23,
    },
    {
      headerText: HEADER_TEXT,
      title: t('onboarding.wacb.q6', { name }),
      options: SCALE_OPTIONS,
      dataField: 'wacb.q6Destroy',
      nextScreen: 'WacbQuestion7',
      prevScreen: 'WacbQuestion5',
      phase: 2,
      stepInPhase: 6,
      totalStepsInPhase: 9,
      screenName: 'wacb_q6',
      screenStep: 24,
    },
    {
      headerText: HEADER_TEXT,
      title: t('onboarding.wacb.q7', { name }),
      options: SCALE_OPTIONS,
      dataField: 'wacb.q7ProvokeFights',
      nextScreen: 'WacbQuestion8',
      prevScreen: 'WacbQuestion6',
      phase: 2,
      stepInPhase: 7,
      totalStepsInPhase: 9,
      screenName: 'wacb_q7',
      screenStep: 25,
    },
    {
      headerText: HEADER_TEXT,
      title: t('onboarding.wacb.q8', { name }),
      options: SCALE_OPTIONS,
      dataField: 'wacb.q8Interrupt',
      nextScreen: 'WacbQuestion9',
      prevScreen: 'WacbQuestion7',
      phase: 2,
      stepInPhase: 8,
      totalStepsInPhase: 9,
      screenName: 'wacb_q8',
      screenStep: 26,
    },
    {
      headerText: HEADER_TEXT,
      title: t('onboarding.wacb.q9', { name }),
      options: SCALE_OPTIONS,
      dataField: 'wacb.q9Attention',
      nextScreen: 'ChildBehaviorProfile',
      prevScreen: 'WacbQuestion8',
      continueText: t('onboarding.wacb.submitSurvey'),
      phase: 2,
      stepInPhase: 9,
      totalStepsInPhase: 9,
      screenName: 'wacb_q9',
      screenStep: 27,
    },
  ];
};
