import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { PlaySessionScreenTemplate } from './PlaySessionScreenTemplate';

export const PlaySession5Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <PlaySessionScreenTemplate
      title="Your data stays private"
      image={require('../../../assets/images/play5.png')}
      subtitle="Your data is always protected and never shared without your permission."
      onContinue={() => navigation.navigate('Subscription')}
    />
  );
};
