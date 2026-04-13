import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { PlaySessionScreenTemplate } from './PlaySessionScreenTemplate';

export const PlaySession4Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <PlaySessionScreenTemplate
      title="Instant Coaching Support"
      image={require('../../../assets/images/play4.png')}
      subtitle="Real-time guidance helps you manage your sessions, set boundaries, and support your child's daily development."
      onContinue={() => navigation.navigate('PlaySession5')}
    />
  );
};
