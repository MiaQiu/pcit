/**
 * Child Gender Screen
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { useOnboarding } from '../../contexts/OnboardingContext';

export const ChildGenderScreen: React.FC = () => {
  const { data } = useOnboarding();
  const { t } = useTranslation();
  const childName = data.childName || 'your child';

  return (
    <MultipleChoiceScreen
      headerText={t('onboarding.childGender.headerText')}
      title={t('onboarding.childGender.title', { name: childName })}
      options={[
        { value: 'BOY', label: t('onboarding.childGender.boy') },
        { value: 'GIRL', label: t('onboarding.childGender.girl') },
        { value: 'OTHER', label: t('onboarding.childGender.preferNotToShare') },
      ]}
      dataField="childGender"
      nextScreen="ChildBirthday"
      prevScreen="ChildName"
      phase={1}
      stepInPhase={4}
      totalStepsInPhase={6}
      screenName="child_gender"
      screenStep={15}
    />
  );
};
