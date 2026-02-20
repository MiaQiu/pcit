/**
 * Wellbeing Intro Screen
 * "Checking in with you" - Shown after WACB survey, before depression questions
 */

import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { IntroScreenTemplate } from './IntroScreenTemplate';

export const WellbeingIntroScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();
  const userName = data.name || '';

  return (
    <IntroScreenTemplate
      subtitle="Checking in with you"
      title={`Hi${userName ? ` ${userName}` : ''}, Your wellbeing matters too!`}
      description="Parenting takes a lot of energy. Before we dive into the program, we want to check in on how you have been feeling"
      buttonText="Let's go!  →"
      onNext={() => navigation.navigate('DepressionQuestion1')}
      onBack={() => navigation.goBack()}
    />
  );
};
