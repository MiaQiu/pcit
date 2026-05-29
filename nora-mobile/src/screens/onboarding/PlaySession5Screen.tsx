import React, { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { PlaySessionScreenTemplate } from './PlaySessionScreenTemplate';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuthService, useLessonService } from '../../contexts/AppContext';
import { prefetchLessons } from '../../services/lessonDataCache';
import amplitudeService from '../../services/amplitudeService';

export const PlaySession5Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t, i18n } = useTranslation();
  const { data } = useOnboarding();
  const authService = useAuthService();
  const lessonService = useLessonService();

  useEffect(() => { amplitudeService.trackOnboardingScreen('play_session5', 34); }, []);

  const handleContinue = async () => {
    amplitudeService.trackOnboardingStepCompleted('play_session5', 34);
    try {
      await authService.completeOnboarding({
        name: data.name,
        relationshipToChild: data.relationshipToChild || undefined,
        childName: data.childName,
        childGender: data.childGender || undefined,
        childBirthday: data.childBirthday || undefined,
        issue: data.issue || undefined,
      });
      prefetchLessons(lessonService, i18n.language);
    } catch (err) {
      console.error('Failed to save onboarding data:', err);
    }
    navigation.navigate('NotificationPermission');
  };

  return (
    <PlaySessionScreenTemplate
      title={t('onboarding.playSession5.title')}
      image={require('../../../assets/images/play5.png')}
      subtitle={t('onboarding.playSession5.subtitle')}
      onBack={() => navigation.goBack()}
      onContinue={handleContinue}
    />
  );
};
