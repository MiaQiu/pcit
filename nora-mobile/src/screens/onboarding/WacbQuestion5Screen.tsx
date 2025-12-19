/**
 * WACB Question 5 Screen
 */

import React from 'react';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { WACB_QUESTIONS } from './wacbQuestions.config';

export const WacbQuestion5Screen: React.FC = () => {
  return <MultipleChoiceScreen {...WACB_QUESTIONS[4]} />;
};
