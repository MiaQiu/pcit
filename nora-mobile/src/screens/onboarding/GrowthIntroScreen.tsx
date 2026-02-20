/**
 * Growth Intro Screen
 * "Grow" - Shown after FocusAreas, before PreIntroReassurance
 */

import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { IntroScreenTemplate } from './IntroScreenTemplate';
import { OnboardingProgressHeader } from '../../components/OnboardingProgressHeader';

export const GrowthIntroScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <IntroScreenTemplate
      header={<OnboardingProgressHeader phase={3} step={3} totalSteps={3} />}
      subtitle="Grow"
      title="See growth over time"
      description="Nora notices patterns across sessions to help you understand your child's social and emotional development."
      buttonText="Let's go!  →"
      onNext={() => navigation.navigate('PreIntroReassurance')}
      onBack={() => navigation.goBack()}
    />
  );
};
