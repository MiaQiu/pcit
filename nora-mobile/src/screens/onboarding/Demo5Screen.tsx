import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { DemoScreenTemplate } from './DemoScreenTemplate';

export const Demo5Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  return (
    <DemoScreenTemplate
      image={require('../../../assets/images/demo5.png')}
      title={`Empowering every caregiver,\nin any language.`}
      resizeMode="contain"
      onNext={() => navigation.navigate('ParentingIntro')}
    />
  );
};
