import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import amplitudeService from '../../services/amplitudeService';
import { OBTemplate } from './OBTemplate';

export const OBPlay2Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob_play2', 23); }, []);

  return (
    <OBTemplate
      image={require('../../../assets/images/new onboarding/OB-play2.png')}
      imageScale={1.3}
      onNext={() => {
        amplitudeService.trackOnboardingStepCompleted('ob_play2', 23);
        navigation.navigate('OBDiscipline');
      }}
    />
  );
};
