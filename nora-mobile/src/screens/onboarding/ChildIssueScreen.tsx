/**
 * Child Issue Screen
 */

import React, { useEffect } from 'react';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import amplitudeService from '../../services/amplitudeService';

export const ChildIssueScreen: React.FC = () => {
  useEffect(() => {
    // Track onboarding screen viewed
    amplitudeService.trackEvent('Onboarding Screen Viewed', {
      screen: 'child_issue',
      step: 2,
    });
  }, []);

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
        { value: 'other', label: 'Others' },
      ]}
      dataField="issue"
      nextScreen="ChildSnapshotIntro"
      multiSelect={true}
      allowOtherOption={true}
      otherOptionValue="other"
      otherOptionPlaceholder="Please describe the issue..."
      phase={1}
      stepInPhase={6}
      totalStepsInPhase={6}
    />
  );
};
