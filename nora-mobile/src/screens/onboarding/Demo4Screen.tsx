import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { DemoScreenTemplate } from './DemoScreenTemplate';

export const Demo4Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();
  const childName = data.childName || 'your child';

  return (
    <DemoScreenTemplate
      subtitle={`We are creating a personalized approach for you and ${childName}.`}
      image={require('../../../assets/images/demo4.png')}
      title={`Discover ${childName}'s unique strengths and help them grow over time.`}
      onNext={() => navigation.navigate('Demo5')}
      onBack={() => navigation.goBack()}
    />
  );
};
