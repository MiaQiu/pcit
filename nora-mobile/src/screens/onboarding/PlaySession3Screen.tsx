import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { PlaySessionScreenTemplate } from './PlaySessionScreenTemplate';

export const PlaySession3Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <PlaySessionScreenTemplate
      title="Record Using Nora App"
      image={require('../../../assets/images/play3.png')}
      subtitle="Set your phone nearby where it can clearly hear your conversation. You don't need to hold it—just focus on the play!"
      onContinue={() => navigation.navigate('PlaySession4')}
    />
  );
};
