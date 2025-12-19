/**
 * WACB Question 3 Screen
 */

import React from 'react';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { WACB_QUESTIONS } from './wacbQuestions.config';

export const WacbQuestion3Screen: React.FC = () => {
  return <MultipleChoiceScreen {...WACB_QUESTIONS[2]} />;
};
