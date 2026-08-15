import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import amplitudeService from '../../services/amplitudeService';
import { OBTemplateV2 } from './OBTemplateV2';

// OB-3_v2.png (clean, text-free) natural size 594x752 — shorter than the
// original OB-3.png (594x876) since the bottom paragraph block was dropped
// from the art entirely; that copy now renders in belowImage instead of
// overlaid on the image itself.
const IMAGE_ASPECT_RATIO = 594 / 752;

export const OB3Screen_v2: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob3', 6); }, []);

  return (
    <OBTemplateV2
      image={require('../../../assets/images/new onboarding/OB-3_v2.png')}
      imageAspectRatio={IMAGE_ASPECT_RATIO}
      imageScale={1.2}
      onNext={() => {
        amplitudeService.trackOnboardingStepCompleted('ob3', 6);
        navigation.navigate('NameInput');
      }}
      belowImage={
        <Text style={styles.paragraph}>
          {t('onboarding.ob3.paragraphPre')}
          <Text style={styles.paragraphHighlight}>{t('onboarding.ob3.paragraphHighlight')}</Text>
          {t('onboarding.ob3.paragraphPost')}
        </Text>
      }
    >
      <Text style={[styles.title, { top: '20%' }]}>
        {t('onboarding.ob3.titlePre')}
        {'\n'}
        <Text style={styles.titleHighlight}>{t('onboarding.ob3.titleHighlight')}</Text>
      </Text>
    </OBTemplateV2>
  );
};

const styles = StyleSheet.create({
  title: {
    position: 'absolute',
    left: 0,
    width: '100%',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 27,
    lineHeight: 33,
    color: '#1F2937',
  },
  titleHighlight: {
    color: '#8C49D5',
  },
  paragraph: {
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    lineHeight: 22,
    color: '#6B7280',
    paddingHorizontal: 20,
    marginTop: 28,
  },
  paragraphHighlight: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#8C49D5',
  },
});
