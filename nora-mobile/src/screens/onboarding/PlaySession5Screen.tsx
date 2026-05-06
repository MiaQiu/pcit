import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { PlaySessionScreenTemplate } from './PlaySessionScreenTemplate';
import amplitudeService from '../../services/amplitudeService';

export const PlaySession5Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();

  useEffect(() => { amplitudeService.trackOnboardingScreen('play_session5', 34); }, []);

  return (
    <PlaySessionScreenTemplate
      title={t('onboarding.playSession5.title')}
      image={require('../../../assets/images/play5.png')}
      subtitle={t('onboarding.playSession5.subtitle')}
      onBack={() => navigation.goBack()}
      onContinue={() => { amplitudeService.trackOnboardingStepCompleted('play_session5', 34); navigation.navigate('Subscription'); }}
    />
  );
};
