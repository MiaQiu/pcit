import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { RootStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { hasAdhdOrDevelopmentalConcern } from '../../utils/onboardingBranch';
import amplitudeService from '../../services/amplitudeService';
import { OBTemplateV2 } from './OBTemplateV2';

// OB-intro2_v2.png (clean, text-free) natural size 598x1102 — much taller
// than the original OB-intro2.png (598x608): the "We can do it." speech
// bubble text was dropped from the art, and the canvas grew a large blank
// top region. The existing title/subtitle text (sentence1/2 or altPara1-3)
// stays exactly as before, now passed via aboveImage instead of sitting in
// its own separate View.
const IMAGE_ASPECT_RATIO = 598 / 1102;

export const OBIntro2Screen_v2: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { data, completeOnboarding } = useOnboarding();
  const { t } = useTranslation();
  const isAltBranch = hasAdhdOrDevelopmentalConcern(data.issue);

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob_intro2', 27); }, []);

  return (
    <OBTemplateV2
      image={require('../../../assets/images/new onboarding/OB-intro2_v2.png')}
      imageAspectRatio={IMAGE_ASPECT_RATIO}
      imageScale={1.7}
      contentOffsetY={-40}
      onNext={async () => {
        amplitudeService.trackOnboardingStepCompleted('ob_intro2', 27);
        await completeOnboarding();
        navigation.replace('MainTabs');
      }}
      aboveImage={
        isAltBranch ? (
          <View style={styles.aboveImageWrap}>
            <Text style={styles.title}>
              {t('onboarding.obIntro2.altPara1Pre')}
              <Text style={styles.highlight}>{t('onboarding.obIntro2.altPara1Highlight')}</Text>
            </Text>
            <Text style={styles.titleAlt}>
              {t('onboarding.obIntro2.altPara2Pre')}
              <Text style={styles.highlight}>{t('onboarding.obIntro2.altPara2Highlight')}</Text>
              {t('onboarding.obIntro2.altPara2Post')}
            </Text>
            <Text style={styles.titleAlt}>
              {t('onboarding.obIntro2.altPara3Pre')}
              <Text style={styles.highlight}>{t('onboarding.obIntro2.altPara3Highlight')}</Text>
              {t('onboarding.obIntro2.altPara3Post')}
            </Text>
          </View>
        ) : (
          <View style={styles.aboveImageWrap}>
            <Text style={styles.title}>
              {t('onboarding.obIntro2.sentence1Pre')}
              <Text style={styles.highlight}>{t('onboarding.obIntro2.sentence1Highlight')}</Text>
              {t('onboarding.obIntro2.sentence1Mid')}
              <Text style={styles.highlight}>{t('onboarding.obIntro2.sentence1HighlightWeeks')}</Text>
            </Text>
            <Text style={styles.subtitle}>{t('onboarding.obIntro2.sentence2')}</Text>
          </View>
        )
      }
    >
      <Text style={[styles.bubbleText, { top: '49%', left: '44%', width: '42%' }]}>
        {t('onboarding.obIntro2.bubbleText')}
      </Text>
    </OBTemplateV2>
  );
};

const styles = StyleSheet.create({
  aboveImageWrap: {
    marginBottom: -130,
    transform: [{ translateY: 30 }],
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: '#1F2937',
    lineHeight: 28,
    paddingHorizontal: 50,
    paddingTop: 85,
  },
  titleAlt: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    color: '#1F2937',
    lineHeight: 28,
    paddingHorizontal: 50,
    marginTop: 16,
  },
  highlight: {
    color: '#8C49D5',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    paddingHorizontal: 50,
    marginTop: 8,
  },
  bubbleText: {
    position: 'absolute',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#5B21B6',
  },
});
