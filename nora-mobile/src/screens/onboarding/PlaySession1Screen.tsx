import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { PlaySessionScreenTemplate } from './PlaySessionScreenTemplate';

export const PlaySession1Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();
  const childName = data.childName || 'your child';

  return (
    <PlaySessionScreenTemplate
      title={`Provide options of toys for ${childName} to choose`}
      image={require('../../../assets/images/play1.png')}
      subtitle="Simple. Gentle. Personalized & fun."
      onContinue={() => navigation.navigate('PlaySession2')}
    />
  );
};
