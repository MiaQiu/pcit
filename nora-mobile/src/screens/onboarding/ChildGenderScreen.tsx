/**
 * Child Gender Screen
 */

import React from 'react';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { useOnboarding } from '../../contexts/OnboardingContext';

export const ChildGenderScreen: React.FC = () => {
  const { data } = useOnboarding();
  const childName = data.childName || 'your child';

  return (
    <MultipleChoiceScreen
      headerText="Used only to personalize guidance."
      title={`What is ${childName}'s gender?`}
      options={[
        { value: 'BOY', label: 'Boy' },
        { value: 'GIRL', label: 'Girl' },
        { value: 'OTHER', label: 'Prefer not to share' },
      ]}
      dataField="childGender"
      nextScreen="ChildBirthday"
      phase={1}
      stepInPhase={4}
      totalStepsInPhase={6}
    />
  );
};
