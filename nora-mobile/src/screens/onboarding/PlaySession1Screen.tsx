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
      title={`Prepare the Right Toys`}
      image={require('../../../assets/images/play1.png')}
      subtitle="To let your child’s imagination run wild, pick unstructured toys. These allow them to be the boss of the play."
      onBack={() => navigation.goBack()}
      onContinue={() => navigation.navigate('PlaySession2')}
    />
  );
};
