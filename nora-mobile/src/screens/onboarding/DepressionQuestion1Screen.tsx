/**
 * Depression Survey Question 1 Screen (PHQ-2)
 * Question: Little interest or pleasure in doing things?
 */

import React from 'react';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';

const OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
];

export const DepressionQuestion1Screen: React.FC = () => {
  return (
    <MultipleChoiceScreen
      headerText="Your answers are private and used only to personalize your experience."
      title="Over the last 2 weeks, how often have you been bothered by: Little interest or pleasure in doing things?"
      options={OPTIONS}
      dataField="phq2.q1Interest"
      nextScreen="DepressionQuestion2"
      phase={2}
      stepInPhase={10}
      totalStepsInPhase={11}
    />
  );
};
