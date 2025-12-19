/**
 * WACB Question 2 Screen
 */

import React from 'react';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { WACB_QUESTIONS } from './wacbQuestions.config';

export const WacbQuestion2Screen: React.FC = () => {
  return <MultipleChoiceScreen {...WACB_QUESTIONS[1]} />;
};
