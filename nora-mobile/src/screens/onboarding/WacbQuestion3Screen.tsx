/**
 * WACB Question 3 Screen
 */

import React from 'react';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { getWacbQuestions } from './wacbQuestions.config';
import { useOnboarding } from '../../contexts/OnboardingContext';

export const WacbQuestion3Screen: React.FC = () => {
  const { data } = useOnboarding();
  const childName = data.childName || 'your child';
  return <MultipleChoiceScreen {...getWacbQuestions(childName)[2]} />;
};
