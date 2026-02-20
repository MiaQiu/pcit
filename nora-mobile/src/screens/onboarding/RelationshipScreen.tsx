/**
 * Relationship Screen
 */

import React from 'react';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { useOnboarding } from '../../contexts/OnboardingContext';

export const RelationshipScreen: React.FC = () => {
  const { data } = useOnboarding();
  const userName = data.name || 'there';

  return (
    <MultipleChoiceScreen
      headerText="This helps us tailor guidance to your role."
      title={`Hi ${userName}, what is your relationship to the child?`}
      options={[
        { value: 'MOTHER', label: 'Mother' },
        { value: 'FATHER', label: 'Father' },
        { value: 'GRANDMOTHER', label: 'Grandmother' },
        { value: 'GRANDFATHER', label: 'Grandfather' },
        { value: 'OTHER', label: 'Other' },
      ]}
      dataField="relationshipToChild"
      nextScreen="ChildName"
      prevScreen="NameInput"
      phase={1}
      stepInPhase={2}
      totalStepsInPhase={6}
    />
  );
};
