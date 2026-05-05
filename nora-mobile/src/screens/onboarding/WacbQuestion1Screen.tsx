/**
 * WACB Question 1 Screen
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { MultipleChoiceScreen } from '../../components/MultipleChoiceScreen';
import { getWacbQuestions } from './wacbQuestions.config';
import { useOnboarding } from '../../contexts/OnboardingContext';

export const WacbQuestion1Screen: React.FC = () => {
  const { data } = useOnboarding();
  const { t } = useTranslation();
  const childName = data.childName || 'your child';
  return <MultipleChoiceScreen {...getWacbQuestions(childName, t)[0]} />;
};
