import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import amplitudeService from '../../services/amplitudeService';
import { OBTemplate } from './OBTemplate';

export const OBPlay1Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob_play1', 22); }, []);

  return (
    <OBTemplate
      image={require('../../../assets/images/new onboarding/OB-play1.png')}
      imageScale={1.3}
      onNext={() => {
        amplitudeService.trackOnboardingStepCompleted('ob_play1', 22);
        navigation.navigate('OBPlay2');
      }}
    />
  );
};
