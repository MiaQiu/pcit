import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { PlaySessionScreenTemplate } from './PlaySessionScreenTemplate';

export const PlaySession2Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();
  const childName = data.childName || 'your child';

  return (
    <PlaySessionScreenTemplate
      title={`Let Your Child Lead`}
      image={require('../../../assets/images/play2.png')}
      subtitle="For the next 5 minutes, your goal is to be your child’s biggest fan, not their teacher.
Describe what they're doing, repeat their words."
      onBack={() => navigation.goBack()}
      onContinue={() => navigation.navigate('PlaySession3')}
    />
  );
};
