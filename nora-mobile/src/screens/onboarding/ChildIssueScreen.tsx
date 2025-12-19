/**
 * Child Issue Screen
 */

import React from 'react';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { getOnboardingProgress } from '../../config/onboardingProgress';

export const ChildIssueScreen: React.FC = () => {
  return (
    <MultipleChoiceScreen
      headerText="There are no right or wrong answers. Select all that applies."
      title="How can Nora help?"
      options={[
        { value: 'tantrums', label: 'Tantrums or managing big feelings' },
        { value: 'not-listening', label: 'Not listening' },
        { value: 'arguing', label: 'Arguing' },
        { value: 'social', label: 'Social-emotional skills' },
        { value: 'new_baby_in_the_house', label: 'New baby in the home' },
        { value: 'frustration_tolerance', label: 'Low frustration tolerance' },
        { value: 'Navigating_change', label: 'Navigating a big change' },
      ]}
      dataField="issue"
      nextScreen="InitialReassurance"
      multiSelect={true}
      progress={getOnboardingProgress('ChildIssue')}
    />
  );
};
