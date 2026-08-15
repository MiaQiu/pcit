import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import amplitudeService from '../../services/amplitudeService';
import { OBTemplateV2 } from './OBTemplateV2';

// OB-1_v2.png (clean, text-free) natural size 654x1020 — shorter than the
// original OB-1.png (662x1196) since the "Meet Nora" heading and paragraph
// block were dropped from the art entirely; that copy now renders in
// belowImage instead of overlaid on the image itself.
// OB-1_SC_v2.png (660x832) / OB-1_tw_v2.png (654x832) are locale-specific
// variants with the icon labels baked into the art in Simplified/Traditional
// Chinese, used instead of the English OB-1_v2.png + overlay when the app
// language is zh-CN / zh-TW.
const IMAGE_BY_LOCALE: Record<string, { source: ReturnType<typeof require>; aspectRatio: number }> = {
  'zh-CN': {
    source: require('../../../assets/images/new onboarding/OB-1_SC_v2.png'),
    aspectRatio: 660 / 832,
  },
  'zh-TW': {
    source: require('../../../assets/images/new onboarding/OB-1_tw_v2.png'),
    aspectRatio: 654 / 832,
  },
};
const DEFAULT_IMAGE = {
  source: require('../../../assets/images/new onboarding/OB-1_v2.png'),
  aspectRatio: 654 / 1020,
};

export const OB1Screen_v2: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t, i18n } = useTranslation();
  const { source: image, aspectRatio: IMAGE_ASPECT_RATIO } = IMAGE_BY_LOCALE[i18n.language] ?? DEFAULT_IMAGE;

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob1', 4); }, []);

  return (
    <OBTemplateV2
      image={image}
      imageAspectRatio={IMAGE_ASPECT_RATIO}
      imageScale={1.6}
      onNext={() => {
        amplitudeService.trackOnboardingStepCompleted('ob1', 4);
        navigation.navigate('OB2V2');
      }}
      belowImage={
        <Text style={styles.paragraph}>
          {t('onboarding.ob1.paragraphPre')}
          <Text style={styles.paragraphHighlight}>{t('onboarding.ob1.paragraphHighlight')}</Text>
          {t('onboarding.ob1.paragraphPost')}
        </Text>
      }
    >
      <Text style={[styles.heading, { top: '1%' }]}>{t('onboarding.ob1.heading')}</Text>

      <Text style={[styles.subtitle, { top: '9%' }]}>
        {t('onboarding.ob1.subtitlePre')}
        <Text style={styles.subtitleHighlight}>{t('onboarding.ob1.subtitleHighlight')}</Text>
      </Text>

      <Text style={[styles.meetNora, { top: '85%' }]}>
        {t('onboarding.ob1.meetPre')}
        <Text style={styles.meetNoraHighlight}>{t('onboarding.ob1.meetHighlight')}</Text>
      </Text>
    </OBTemplateV2>
  );
};

const styles = StyleSheet.create({
  heading: {
    position: 'absolute',
    left: 0,
    width: '100%',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    color: '#8C49D5',
  },
  subtitle: {
    position: 'absolute',
    left: 0,
    width: '100%',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 25,
    lineHeight: 31,
    color: '#1F2937',
  },
  subtitleHighlight: {
    color: '#8C49D5',
  },
  meetNora: {
    position: 'absolute',
    left: 0,
    width: '100%',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    color: '#1F2937',
  },
  meetNoraHighlight: {
    color: '#8C49D5',
  },
  paragraph: {
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    lineHeight: 21,
    color: '#6B7280',
    paddingHorizontal: 20,
    marginTop: 8,
  },
  paragraphHighlight: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#8C49D5',
  },
});
