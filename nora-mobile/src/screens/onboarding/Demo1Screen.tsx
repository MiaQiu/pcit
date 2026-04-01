import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { DemoScreenTemplate } from './DemoScreenTemplate';

export const Demo1Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();
  const childName = data.childName || 'your child';

  return (
    <DemoScreenTemplate
      subtitle={`We are creating a personalized approach for you and ${childName}.`}
      image={require('../../../assets/images/demo1.png')}
      title="Nora is grounded in decades of child psychology and clinical research."
      onNext={() => navigation.navigate('Demo2')}
      onBack={() => navigation.goBack()}
    />
  );
};
