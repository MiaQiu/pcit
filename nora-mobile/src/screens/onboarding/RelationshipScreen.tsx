/**
 * Relationship Screen
 */

import React from 'react';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';

export const RelationshipScreen: React.FC = () => {
  return (
    <MultipleChoiceScreen
      headerText="This helps us tailor guidance to your role."
      title="What is your relationship to the child?"
      options={[
        { value: 'MOTHER', label: 'Mother' },
        { value: 'FATHER', label: 'Father' },
        { value: 'GRANDMOTHER', label: 'Grandmother' },
        { value: 'GRANDFATHER', label: 'Grandfather' },
        { value: 'OTHER', label: 'Other' },
      ]}
      dataField="relationshipToChild"
      nextScreen="ChildName"
    />
  );
};
