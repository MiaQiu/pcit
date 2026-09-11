/**
 * Child Snapshot Questions Configuration
 * Defines all 10 Child Snapshot question screens (formerly "WACB", 9 items).
 */

import { TFunction } from 'i18next';
import { MultipleChoiceScreenProps } from '../../components/MultipleChoiceScreen';
import { OnboardingStackParamList } from '../../navigation/types';

type ScreenName = keyof OnboardingStackParamList;

const getScaleOptions = (t: TFunction) => [
  { value: 1, label: t('onboarding.wacb.scaleNever') },
  { value: 2, label: t('onboarding.wacb.scaleRarely') },
  { value: 3, label: t('onboarding.wacb.scaleSometimes') },
  { value: 4, label: t('onboarding.wacb.scaleOften') },
  { value: 5, label: t('onboarding.wacb.scaleVeryOften') },
];

// question key (i18n suffix under onboarding.wacb.*) → survey dataField, in screen order.
const QUESTIONS: { i18nKey: string; field: string }[] = [
  { i18nKey: 'q1', field: 'q1Dawdle' },
  { i18nKey: 'q2', field: 'q2Disobey' },
  { i18nKey: 'q3', field: 'q3Tantrum' },
  { i18nKey: 'q4', field: 'q4Defiance' },
  { i18nKey: 'q5', field: 'q5FocusDemand' },
  { i18nKey: 'q6', field: 'q6Restless' },
  { i18nKey: 'q7', field: 'q7TaskCompletion' },
  { i18nKey: 'q8', field: 'q8Destroy' },
  { i18nKey: 'q9', field: 'q9Aggression' },
  { i18nKey: 'q10', field: 'q10LieSteal' },
];

const TOTAL = QUESTIONS.length;

export const getWacbQuestions = (childName: string = 'your child', t: TFunction): Omit<MultipleChoiceScreenProps, 'navigation'>[] => {
  const SCALE_OPTIONS = getScaleOptions(t);
  const HEADER_TEXT = t('onboarding.wacb.headerText');
  const name = childName;

  return QUESTIONS.map((q, i) => {
    const step = i + 1;
    const isLast = step === TOTAL;
    return {
      headerText: HEADER_TEXT,
      title: t(`onboarding.wacb.${q.i18nKey}`, { name }),
      options: SCALE_OPTIONS,
      dataField: `wacb.${q.field}`,
      nextScreen: (isLast ? 'ChildBehaviorProfile' : `WacbQuestion${step + 1}`) as ScreenName,
      prevScreen: (step === 1 ? 'ChildSnapshotIntro' : `WacbQuestion${step - 1}`) as ScreenName,
      ...(isLast ? { continueText: t('onboarding.wacb.submitSurvey') } : {}),
      phase: 2,
      singlePhaseHeader: true,
      stepInPhase: step,
      totalStepsInPhase: TOTAL,
      screenName: `wacb_q${step}`,
      screenStep: 28 + step,
    };
  });
};
