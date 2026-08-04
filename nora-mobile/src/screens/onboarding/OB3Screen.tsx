import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import amplitudeService from '../../services/amplitudeService';
import { OBTemplate } from './OBTemplate';

export const OB3Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob3', 6); }, []);

  return (
    <OBTemplate
      image={require('../../../assets/images/new onboarding/OB-3.png')}
      imageScale={1.2}
      onNext={() => {
        amplitudeService.trackOnboardingStepCompleted('ob3', 6);
        navigation.navigate('NameInput');
      }}
    />
  );
};
