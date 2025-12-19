/**
 * WACB Question 6 Screen
 */

import React from 'react';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { WACB_QUESTIONS } from './wacbQuestions.config';

export const WacbQuestion6Screen: React.FC = () => {
  return <MultipleChoiceScreen {...WACB_QUESTIONS[5]} />;
};
