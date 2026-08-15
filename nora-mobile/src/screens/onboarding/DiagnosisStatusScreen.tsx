/**
 * Diagnosis Status Screen
 * ADHD / developmental-concern branch only (see ChildIssueScreen's nextScreen
 * resolver). Replaces ParentGoal on this branch, alongside ProfessionalSupport.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { PersonalizingProgressHeader } from '../../components/PersonalizingProgressHeader';
import { useAuthService } from '../../contexts/AppContext';
import { useOnboarding } from '../../contexts/OnboardingContext';

export const DiagnosisStatusScreen: React.FC = () => {
  const { t } = useTranslation();
  const authService = useAuthService();
  const { data } = useOnboarding();
  const childName = data.childName || 'your child';

  const handleBeforeNavigate = async (selectedValue: any) => {
    authService.completeOnboarding({ diagnosisStatus: selectedValue }).catch(() => {});
  };

  return (
    <MultipleChoiceScreen
      headerOverride={<PersonalizingProgressHeader step={1} totalSteps={4} />}
      headerText=""
      title={t('onboarding.diagnosisStatus.title', { childName })}
      options={[
        { value: 'yes', label: t('onboarding.diagnosisStatus.yes') },
        { value: 'assessment_in_progress', label: t('onboarding.diagnosisStatus.assessmentInProgress') },
        { value: 'concerns_no_diagnosis', label: t('onboarding.diagnosisStatus.concernsNoDiagnosis') },
        { value: 'prefer_not_to_say', label: t('onboarding.diagnosisStatus.preferNotToSay') },
      ]}
      dataField="diagnosisStatus"
      nextScreen="ProfessionalSupport"
      prevScreen="ChildIssue"
      multiSelect={false}
      screenName="diagnosis_status"
      screenStep={46}
      onBeforeNavigate={handleBeforeNavigate}
    />
  );
};
