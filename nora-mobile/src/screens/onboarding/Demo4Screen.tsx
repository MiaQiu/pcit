import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { DemoScreenTemplate } from './DemoScreenTemplate';

export const Demo4Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <DemoScreenTemplate
      image={require('../../../assets/images/demo4.png')}
      title="Help your child thrive. Build on their strengths and support their emotional and social growth."
      resizeMode="contain"
      onNext={() => navigation.navigate('Demo5')}
    />
  );
};
