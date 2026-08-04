/**
 * Parent Goal Screen
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { useAuthService } from '../../contexts/AppContext';

export const ParentGoalScreen: React.FC = () => {
  const { t } = useTranslation();
  const authService = useAuthService();

  const handleBeforeNavigate = async (selectedValue: any) => {
    authService.completeOnboarding({ parentGoal: selectedValue }).catch(() => {});
  };

  return (
    <MultipleChoiceScreen
      headerText={t('onboarding.parentGoal.headerText')}
      title={t('onboarding.parentGoal.title')}
      options={[
        { value: 'truly_understanding_kid', label: t('onboarding.parentGoal.trulyUnderstanding') },
        { value: 'boost_kid_development', label: t('onboarding.parentGoal.boostDevelopment') },
        { value: 'feeling_more_connected', label: t('onboarding.parentGoal.feelingConnected') },
        { value: 'feeling_less_overwhelmed', label: t('onboarding.parentGoal.feelingLessOverwhelmed') },
        { value: 'less_chaos_day_to_day', label: t('onboarding.parentGoal.lessChaos') },
        { value: 'respond_calmly', label: t('onboarding.parentGoal.respondCalmly') },
        { value: 'confident_in_parenting', label: t('onboarding.parentGoal.confidentParenting') },
      ]}
      dataField="parentGoal"
      nextScreen="ParentGoalIntro"
      prevScreen="ChildIssue"
      multiSelect={true}
      phase={1}
      stepInPhase={7}
      totalStepsInPhase={7}
      screenName="parent_goal"
      screenStep={18}
      onBeforeNavigate={handleBeforeNavigate}
    />
  );
};
