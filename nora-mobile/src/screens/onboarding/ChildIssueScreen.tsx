/**
 * Child Issue Screen
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { useAuthService } from '../../contexts/AppContext';
import { hasAdhdOrDevelopmentalConcern } from '../../utils/onboardingBranch';

export const ChildIssueScreen: React.FC = () => {
  const { t } = useTranslation();
  const authService = useAuthService();

  const handleBeforeNavigate = async (selectedValue: any) => {
    authService.completeOnboarding({ issue: selectedValue }).catch(() => {});
  };

  return (
    <MultipleChoiceScreen
      headerText={t('onboarding.childIssue.headerText')}
      title={t('onboarding.childIssue.title')}
      options={[
        { value: 'big_feelings_tantrums', label: t('onboarding.childIssue.bigFeelingsTantrums') },
        { value: 'listening_cooperation', label: t('onboarding.childIssue.listeningCooperation') },
        { value: 'attention_focus', label: t('onboarding.childIssue.attentionFocus') },
        { value: 'social', label: t('onboarding.childIssue.social') },
        { value: 'anxiety_confidence', label: t('onboarding.childIssue.anxietyConfidence') },
        { value: 'adhd', label: t('onboarding.childIssue.adhd') },
        { value: 'developmental_concerns', label: t('onboarding.childIssue.developmentalConcerns') },
        { value: 'parenting_strategies', label: t('onboarding.childIssue.parentingStrategies') },
        { value: 'other', label: t('onboarding.childIssue.other') },
      ]}
      dataField="issue"
      nextScreen={(selectedValue) => hasAdhdOrDevelopmentalConcern(selectedValue) ? 'DiagnosisStatus' : 'ParentGoal'}
      prevScreen="ChildBirthday"
      multiSelect={true}
      allowOtherOption={true}
      otherOptionValue="other"
      otherOptionPlaceholder={t('onboarding.childIssue.otherPlaceholder')}
      phase={1}
      stepInPhase={6}
      totalStepsInPhase={7}
      screenName="child_issue"
      screenStep={17}
      onBeforeNavigate={handleBeforeNavigate}
    />
  );
};
