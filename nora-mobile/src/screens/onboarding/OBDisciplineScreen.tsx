import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import amplitudeService from '../../services/amplitudeService';
import { OBTemplate } from './OBTemplate';

export const OBDisciplineScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob_discipline', 24); }, []);

  return (
    <OBTemplate
      image={require('../../../assets/images/new onboarding/OB-Discipline.png')}
      imageScale={1.5}
      onNext={() => {
        amplitudeService.trackOnboardingStepCompleted('ob_discipline', 24);
        navigation.navigate('OBIntro1');
      }}
    />
  );
};
