import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { PlaySessionScreenTemplate } from './PlaySessionScreenTemplate';

export const PlaySession4Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <PlaySessionScreenTemplate
      title="Short Play, Big Insights"
      image={require('../../../assets/images/play4.png')}
      subtitle={`The recording stops automatically after 5 minutes.\nOur AI analyzes the interaction and generates a personalized report in just a few minutes`}
      onContinue={() => navigation.navigate('PlaySession5')}
    />
  );
};
