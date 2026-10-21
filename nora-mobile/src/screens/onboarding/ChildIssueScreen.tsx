/**
 * Child Issue Screen
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { useAuthService } from '../../contexts/AppContext';
import { hasAdhdOrDevelopmentalConcern } from '../../utils/onboardingBranch';
import amplitudeService from '../../services/amplitudeService';
import { saveOnboardingFields } from '../../utils/onboardingDraft';
import { OnboardingFooter } from '../../components/OnboardingFooter';

export const ChildIssueScreen: React.FC = () => {
  const { t } = useTranslation();
  const authService = useAuthService();

  const handleBeforeNavigate = async (selectedValue: any, _updateData: any, navigation: any) => {
    saveOnboardingFields(authService, { issue: selectedValue });
    if (selectedValue === 'screen_time') {
      // Explicit step 0 so a dev-forced ScreenTimeStep stepId (initialParams) can't apply here
      amplitudeService.trackOnboardingStepCompleted('child_issue', 17);
      navigation.navigate('ScreenTimeStep', { step: 0 });
      return false;
    }
  };

  return (
    <MultipleChoiceScreen
      headerText={t('onboarding.childIssue.headerText')}
      title={t('onboarding.childIssue.title')}
      options={[
        { value: 'screen_time', label: t('onboarding.childIssue.screenTime') },
        { value: 'big_feelings_tantrums', label: t('onboarding.childIssue.bigFeelingsTantrums') },
        { value: 'behavior_challenges', label: t('onboarding.childIssue.behaviorChallenges') },
        { value: 'listening_cooperation', label: t('onboarding.childIssue.listeningCooperation') },
        { value: 'attention_focus', label: t('onboarding.childIssue.attentionFocus') },
        { value: 'social', label: t('onboarding.childIssue.social') },
        { value: 'anxiety', label: t('onboarding.childIssue.anxiety') },
        { value: 'confidence', label: t('onboarding.childIssue.confidence') },
        { value: 'adhd', label: t('onboarding.childIssue.adhd') },
        { value: 'developmental_concerns', label: t('onboarding.childIssue.developmentalConcerns') },
        { value: 'parenting_strategies', label: t('onboarding.childIssue.parentingStrategies') },
        { value: 'other', label: t('onboarding.childIssue.other') },
      ]}
      dataField="issue"
      nextScreen={(selectedValue) =>
        selectedValue === 'screen_time' ? 'ScreenTimeStep'
          : hasAdhdOrDevelopmentalConcern(selectedValue) ? 'DiagnosisStatus'
          : 'ParentGoal'}
      prevScreen="ChildBirthday"
      allowOtherOption={true}
      otherOptionValue="other"
      otherOptionPlaceholder={t('onboarding.childIssue.otherPlaceholder')}
      phase={1}
      stepInPhase={6}
      totalStepsInPhase={7}
      singlePhaseHeader
      screenName="child_issue"
      screenStep={17}
      renderButtons={(buttonProps) => <OnboardingFooter {...buttonProps} />}
      onBeforeNavigate={handleBeforeNavigate}
    />
  );
};
