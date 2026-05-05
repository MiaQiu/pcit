/**
 * Child Issue Screen
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import amplitudeService from '../../services/amplitudeService';

export const ChildIssueScreen: React.FC = () => {
  const { t } = useTranslation();

  useEffect(() => {
    amplitudeService.trackEvent('Onboarding Screen Viewed', {
      screen: 'child_issue',
      step: 2,
    });
  }, []);

  return (
    <MultipleChoiceScreen
      headerText={t('onboarding.childIssue.headerText')}
      title={t('onboarding.childIssue.title')}
      options={[
        { value: 'behavior_challenges', label: t('onboarding.childIssue.behaviorChallenges') },
        { value: 'big_emotions', label: t('onboarding.childIssue.bigEmotions') },
        { value: 'frustration_tolerance', label: t('onboarding.childIssue.frustrationTolerance') },
        { value: 'new_baby_in_the_house', label: t('onboarding.childIssue.newBaby') },
        { value: 'moving_house', label: t('onboarding.childIssue.movingHouse') },
        { value: 'parental_divorce', label: t('onboarding.childIssue.parentalDivorce') },
        { value: 'social', label: t('onboarding.childIssue.social') },
        { value: 'attention_focus', label: t('onboarding.childIssue.attentionFocus') },
        { value: 'adhd', label: t('onboarding.childIssue.adhd') },
        { value: 'parenting_strategies', label: t('onboarding.childIssue.parentingStrategies') },
        { value: 'other', label: t('onboarding.childIssue.other') },
      ]}
      dataField="issue"
      nextScreen="ChildSnapshotIntro"
      prevScreen="ChildBirthday"
      multiSelect={true}
      allowOtherOption={true}
      otherOptionValue="other"
      otherOptionPlaceholder={t('onboarding.childIssue.otherPlaceholder')}
      phase={1}
      stepInPhase={6}
      totalStepsInPhase={6}
    />
  );
};
