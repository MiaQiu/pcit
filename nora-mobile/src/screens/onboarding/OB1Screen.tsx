import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import amplitudeService from '../../services/amplitudeService';
import { OBTemplate } from './OBTemplate';

export const OB1Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob1', 4); }, []);

  return (
    <OBTemplate
      image={require('../../../assets/images/new onboarding/OB-1.png')}
      imageScale={1.6}
      onNext={() => {
        amplitudeService.trackOnboardingStepCompleted('ob1', 4);
        navigation.navigate('OB2');
      }}
    />
  );
};
