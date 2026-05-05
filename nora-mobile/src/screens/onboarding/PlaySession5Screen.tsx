import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { PlaySessionScreenTemplate } from './PlaySessionScreenTemplate';

export const PlaySession5Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();

  return (
    <PlaySessionScreenTemplate
      title={t('onboarding.playSession5.title')}
      image={require('../../../assets/images/play5.png')}
      subtitle={t('onboarding.playSession5.subtitle')}
      onBack={() => navigation.goBack()}
      onContinue={() => navigation.navigate('Subscription')}
    />
  );
};
