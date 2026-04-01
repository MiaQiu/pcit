import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { DemoScreenTemplate } from './DemoScreenTemplate';

export const Demo5Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();
  const childName = data.childName || 'your child';

  return (
    <DemoScreenTemplate
      subtitle={`We are creating a personalized approach for you and ${childName}.`}
      image={require('../../../assets/images/demo5.png')}
      title="Empowering every caregiver, in any language."
      onNext={() => navigation.navigate('Demo6')}
      onBack={() => navigation.goBack()}
    />
  );
};
