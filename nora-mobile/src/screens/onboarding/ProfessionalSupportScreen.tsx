/**
 * Professional Support Screen
 * ADHD / developmental-concern branch only. Follows DiagnosisStatus,
 * rejoins the main flow at ParentGoalIntro (ParentGoal is skipped on this branch).
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { PersonalizingProgressHeader } from '../../components/PersonalizingProgressHeader';
import { useAuthService } from '../../contexts/AppContext';
import { useOnboarding } from '../../contexts/OnboardingContext';

export const ProfessionalSupportScreen: React.FC = () => {
  const { t } = useTranslation();
  const authService = useAuthService();
  const { data } = useOnboarding();
  const childName = data.childName || 'your child';

  const handleBeforeNavigate = async (selectedValue: any) => {
    authService.completeOnboarding({ professionalSupport: selectedValue }).catch(() => {});
  };

  return (
    <MultipleChoiceScreen
      headerOverride={<PersonalizingProgressHeader step={2} totalSteps={4} />}
      headerText=""
      title={t('onboarding.professionalSupport.title', { childName })}
      options={[
        { value: 'occupational_therapy', label: t('onboarding.professionalSupport.occupationalTherapy') },
        { value: 'speech_therapy', label: t('onboarding.professionalSupport.speechTherapy') },
        { value: 'early_intervention', label: t('onboarding.professionalSupport.earlyIntervention') },
        { value: 'aba_behavioral_therapy', label: t('onboarding.professionalSupport.abaBehavioralTherapy') },
        { value: 'school_support', label: t('onboarding.professionalSupport.schoolSupport') },
        { value: 'other', label: t('onboarding.professionalSupport.other') },
        { value: 'none', label: t('onboarding.professionalSupport.none') },
        { value: 'prefer_not_to_say', label: t('onboarding.professionalSupport.preferNotToSay') },
      ]}
      dataField="professionalSupport"
      nextScreen="ParentGoalIntro"
      prevScreen="DiagnosisStatus"
      multiSelect={true}
      screenName="professional_support"
      screenStep={47}
      onBeforeNavigate={handleBeforeNavigate}
    />
  );
};
