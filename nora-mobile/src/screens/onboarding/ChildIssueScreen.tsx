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
        { value: 'behavior_challenges', label: 'Behavior Challenges (Tantrums, Arguing)' },
        { value: 'big_emotions', label: 'Handling big emotions' },
        { value: 'frustration_tolerance', label: 'Low frustration tolerance' },
        { value: 'new_baby_in_the_house', label: 'New Baby in the Home' },
        { value: 'moving_house', label: 'Moving House & School Changes' },
        { value: 'parental_divorce', label: 'Navigating Parental Divorces' },
        { value: 'social', label: 'Building Social-Emotional Skills' },
        { value: 'attention_focus', label: 'Attention and Focus Issues' },
        { value: 'adhd', label: 'ADHD / Attention & Hyperactivity' },
        { value: 'parenting_strategies', label: 'Learning More Effective Parenting Strategies' },
        { value: 'other', label: 'Others' },
      ]}
      dataField="issue"
      nextScreen="ChildSnapshotIntro"
      prevScreen="ChildBirthday"
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
