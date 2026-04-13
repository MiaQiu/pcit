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
      title={`Let ${childName} lead the play. Just describe and echo`}
      image={require('../../../assets/images/play2.png')}
      subtitle="Child-Led Play — to build patterns, connection, and structure."
      onContinue={() => navigation.navigate('PlaySession3')}
    />
  );
};
