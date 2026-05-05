import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { PlaySessionScreenTemplate } from './PlaySessionScreenTemplate';

export const PlaySession1Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();

  return (
    <PlaySessionScreenTemplate
      title={t('onboarding.playSession1.title')}
      image={require('../../../assets/images/play1.png')}
      subtitle={t('onboarding.playSession1.subtitle')}
      onBack={() => navigation.goBack()}
      onContinue={() => navigation.navigate('PlaySession2')}
    />
  );
};
