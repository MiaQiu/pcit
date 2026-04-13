import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { DemoScreenTemplate } from './DemoScreenTemplate';

export const Demo6Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <DemoScreenTemplate
      image={require('../../../assets/images/demo6.png')}
      title="Your private moments stay private."
      onNext={() => navigation.navigate('ParentingIntro')}
    />
  );
};
