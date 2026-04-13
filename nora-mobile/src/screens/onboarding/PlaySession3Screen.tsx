import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { PlaySessionScreenTemplate } from './PlaySessionScreenTemplate';

export const PlaySession3Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <PlaySessionScreenTemplate
      title="5 Minutes That Works"
      image={require('../../../assets/images/play3.png')}
      subtitle="Strengthens connection and activates focus, supports social-emotional and cognitive growth, and gets you real coaching support."
      onContinue={() => navigation.navigate('PlaySession4')}
    />
  );
};
