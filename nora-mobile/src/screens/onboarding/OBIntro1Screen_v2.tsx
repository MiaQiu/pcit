import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import amplitudeService from '../../services/amplitudeService';
import { OBTemplateV2 } from './OBTemplateV2';

// OB-intro1_v2.png (clean, text-free) natural size 654x1164 — the "Just 3
// simple steps..." heading and all 3 card titles/bodies were dropped from
// the art; overlaid below instead. Unlike the OBTemplate-driven screens,
// this one also keeps its own "Helping {childName} starts here" title above
// the image (unchanged from the original OBIntro1Screen).
const IMAGE_ASPECT_RATIO = 654 / 1164;

export const OBIntro1Screen_v2: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();
  const { t } = useTranslation();
  const childName = data.childName || 'your child';

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob_intro1', 25); }, []);

  return (
    <OBTemplateV2
      image={require('../../../assets/images/new onboarding/OB-intro1_v2.png')}
      imageAspectRatio={IMAGE_ASPECT_RATIO}
      imageScale={1.75}
      imageBoxOffsetY={-30}
      onNext={() => {
        amplitudeService.trackOnboardingStepCompleted('ob_intro1', 25);
        navigation.navigate('ReminderTime');
      }}
      aboveImage={
        <Text style={styles.title}>
          {t('onboarding.obIntro1.helping')}
          {'\n'}
          <Text style={styles.highlight}>{childName}</Text>
          {'\n'}
          {t('onboarding.obIntro1.startsHere')}
        </Text>
      }
    >
      <Text style={[styles.heading, { top: '6%' }]}>
        {t('onboarding.obIntro1.threeStepsPre')}
        <Text style={styles.headingHighlight}>{t('onboarding.obIntro1.threeStepsHighlight1')}</Text>
        {t('onboarding.obIntro1.threeStepsMid')}
        <Text style={styles.headingHighlight}>{t('onboarding.obIntro1.threeStepsHighlight2')}</Text>
      </Text>

      <Text style={[styles.cardTitle, { top: '44%', left: '52%', width: '44%' }]}>
        {t('onboarding.obIntro1.card1TitleLine1')}
        {'\n'}
        {t('onboarding.obIntro1.card1TitleLine2')}
      </Text>
      <Text style={[styles.cardBody, { top: '51%', left: '52%', width: '44%' }]}>
        {t('onboarding.obIntro1.card1Body')}
      </Text>

      <Text style={[styles.cardTitle, { top: '65%', left: '52%', width: '44%' }]}>
        {t('onboarding.obIntro1.card2TitleLine1')}
        {'\n'}
        {t('onboarding.obIntro1.card2TitleLine2')}
      </Text>
      <Text style={[styles.cardBody, { top: '72%', left: '52%', width: '44%' }]}>
        {t('onboarding.obIntro1.card2Body')}
      </Text>

      <Text style={[styles.cardTitle, { top: '86%', left: '52%', width: '44%' }]}>
        {t('onboarding.obIntro1.card3TitleLine1')}
        {'\n'}
        {t('onboarding.obIntro1.card3TitleLine2')}
      </Text>
      <Text style={[styles.cardBody, { top: '93%', left: '52%', width: '44%' }]}>
        {t('onboarding.obIntro1.card3Body')}
      </Text>
    </OBTemplateV2>
  );
};

const styles = StyleSheet.create({
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 32,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 38,
    paddingHorizontal: 36,
    paddingTop: 64,
    paddingBottom: 0,
    marginBottom: -92,
  },
  highlight: {
    color: '#8C49D5',
  },
  heading: {
    position: 'absolute',
    left: '2%',
    width: '96%',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    lineHeight: 24,
    color: '#1F2937',
    marginTop:130
  },
  headingHighlight: {
    color: '#8C49D5',
  },
  cardTitle: {
    position: 'absolute',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    lineHeight: 19,
    color: '#3730A3',
  },
  cardBody: {
    position: 'absolute',
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#1F2937',
  },
});
