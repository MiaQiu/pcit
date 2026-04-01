import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { DemoScreenTemplate } from './DemoScreenTemplate';

export const Demo6Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();
  const childName = data.childName || 'your child';

  return (
    <DemoScreenTemplate
      subtitle={`We are creating a personalized approach for you and ${childName}.`}
      image={require('../../../assets/images/demo6.png')}
      title="Your private moments stay private."
      onNext={() => navigation.navigate('PlanReady')}
      onBack={() => navigation.goBack()}
    />
  );
};
