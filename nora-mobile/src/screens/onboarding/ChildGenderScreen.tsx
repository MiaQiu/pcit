/**
 * Child Gender Screen
 */

import React from 'react';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';

export const ChildGenderScreen: React.FC = () => {
  return (
    <MultipleChoiceScreen
      headerText="Used only to personalize guidance."
      title="What is your child's gender?"
      options={[
        { value: 'BOY', label: 'Boy' },
        { value: 'GIRL', label: 'Girl' },
        { value: 'OTHER', label: 'Prefer not to share' },
      ]}
      dataField="childGender"
      nextScreen="ChildBirthday"
    />
  );
};
