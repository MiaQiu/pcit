/**
 * Diagnosis Status Screen
 * ADHD / developmental-concern / anxiety branch only (see ChildIssueScreen's
 * nextScreen resolver). Replaces ParentGoal on this branch, alongside
 * ProfessionalSupport.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { OnboardingProgressHeader } from '../../components/OnboardingProgressHeader';
import { useAuthService } from '../../contexts/AppContext';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { saveOnboardingFields } from '../../utils/onboardingDraft';
import { OnboardingFooter } from '../../components/OnboardingFooter';

export const DiagnosisStatusScreen: React.FC = () => {
  const { t } = useTranslation();
  const authService = useAuthService();
  const { data } = useOnboarding();
  const childName = data.childName || 'your child';

  const handleBeforeNavigate = async (selectedValue: any) => {
    saveOnboardingFields(authService, { diagnosisStatus: selectedValue });
  };

  return (
    <MultipleChoiceScreen
      headerOverride={
        <OnboardingProgressHeader phase={1} step={1} totalSteps={2} singlePhase />
      }
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
      renderButtons={(buttonProps) => <OnboardingFooter {...buttonProps} />}
      onBeforeNavigate={handleBeforeNavigate}
    />
  );
};
