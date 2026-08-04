import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import amplitudeService from '../../services/amplitudeService';
import { OBTemplate } from './OBTemplate';

export const OB2Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob2', 5); }, []);

  return (
    <OBTemplate
      image={require('../../../assets/images/new onboarding/OB-2.png')}
      imageScale={1.1}
      onNext={() => {
        amplitudeService.trackOnboardingStepCompleted('ob2', 5);
        navigation.navigate('OB3');
      }}
    />
  );
};
