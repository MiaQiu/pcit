import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { hasAdhdOrDevelopmentalConcern } from '../../utils/onboardingBranch';
import amplitudeService from '../../services/amplitudeService';
import { OBTemplateV2 } from './OBTemplateV2';

// OB-Discipline_v2.png (clean, text-free) natural size 678x952 — the "CALM
// DISCIPLINE" heading, subtitle, and card title/body text were all dropped
// from the art; overlay positions are re-mapped to the new blank gaps.
const MAIN_ASPECT_RATIO = 678 / 952;
// OB-discpline_path2_v2.png natural size 602x1026
const ALT_ASPECT_RATIO = 602 / 1026;

export const OBDisciplineScreen_v2: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();
  const { t } = useTranslation();
  const isAltBranch = hasAdhdOrDevelopmentalConcern(data.issue);

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob_discipline', 24); }, []);

  const onNext = () => {
    amplitudeService.trackOnboardingStepCompleted('ob_discipline', 24);
    navigation.navigate('OBIntro1V2');
  };

  if (isAltBranch) {
    return (
      <OBTemplateV2
        image={require('../../../assets/images/new onboarding/OB-discpline_path2_v2.png')}
        imageAspectRatio={ALT_ASPECT_RATIO}
        imageScale={1.6}
        imageOffsetY={40}
        onNext={onNext}
      >
        <Text style={[styles.heading, { top: '1%' }]}>
          {t('onboarding.obDisciplineAlt.headingLine1')}
          {'\n'}
          <Text style={styles.headingHighlight}>{t('onboarding.obDisciplineAlt.headingLine2')}</Text>
        </Text>

        <Text style={[styles.subtitle, { top: '20%' }]}>
          {t('onboarding.obDisciplineAlt.subtitle')}
        </Text>

        <Text style={[styles.paragraph, { top: '32%', left: '4%', width: '92%' }]}>
          {t('onboarding.obDisciplineAlt.paragraphPre')}
          <Text style={styles.paragraphHighlight}>{t('onboarding.obDisciplineAlt.paragraphHighlight')}</Text>
        </Text>

        <Text style={[styles.cardTitle, { top: '51%', left: '26%', width: '70%' }]}>
          {t('onboarding.obDisciplineAlt.card1Title')}
        </Text>
        <Text style={[styles.cardBody, { top: '56%', left: '26%', width: '70%' }]}>
          {t('onboarding.obDisciplineAlt.card1Body')}
        </Text>

        <Text style={[styles.cardTitle, { top: '72%', left: '26%', width: '70%' }]}>
          {t('onboarding.obDisciplineAlt.card2Title')}
        </Text>
        <Text style={[styles.cardBody, { top: '77%', left: '26%', width: '70%' }]}>
          {t('onboarding.obDisciplineAlt.card2Body')}
        </Text>

        <Text style={[styles.cardTitle, { top: '92%', left: '26%', width: '70%' }]}>
          {t('onboarding.obDisciplineAlt.card3Title')}
        </Text>
        <Text style={[styles.cardBody, { top: '97%', left: '26%', width: '70%' }]}>
          {t('onboarding.obDisciplineAlt.card3Body')}
        </Text>
      </OBTemplateV2>
    );
  }

  return (
    <OBTemplateV2
      image={require('../../../assets/images/new onboarding/OB-Discipline_v2.png')}
      imageAspectRatio={MAIN_ASPECT_RATIO}
      imageScale={1.5}
      onNext={onNext}
    >
      <Text style={[styles.headingPurple, { top: '2%' }]}>
        {t('onboarding.obDiscipline.headingLine1')}
        {'\n'}
        {t('onboarding.obDiscipline.headingLine2')}
      </Text>

      <Text style={[styles.subtitle, { top: '24%' }]}>
        {t('onboarding.obDiscipline.subtitle')}
        {'\n'}
        <Text style={styles.subtitleHighlight}>{t('onboarding.obDiscipline.subtitleHighlight')}</Text>
      </Text>

      <Text style={[styles.cardTitle, { top: '58%', left: '0%', width: '44%' }]}>
        {t('onboarding.obDiscipline.card1Title')}
      </Text>
      <Text style={[styles.cardBody, { top: '63%', left: '0%', width: '44%' }]}>
        {t('onboarding.obDiscipline.card1Body')}
      </Text>

      <Text style={[styles.cardTitleGreen, { top: '58%', left: '54%', width: '44%' }]}>
        {t('onboarding.obDiscipline.card2Title')}
      </Text>
      <Text style={[styles.cardBody, { top: '63%', left: '54%', width: '44%' }]}>
        {t('onboarding.obDiscipline.card2Body')}
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
    fontSize: 34,
    lineHeight: 38,
    color: '#1F2937',
  },
  headingPurple: {
    position: 'absolute',
    left: 0,
    width: '100%',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 38,
    lineHeight: 42,
    color: '#8C49D5',
  },
  headingHighlight: {
    color: '#8C49D5',
  },
  subtitle: {
    position: 'absolute',
    left: 0,
    width: '100%',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 20,
    lineHeight: 26,
    color: '#1F2937',
  },
  subtitleHighlight: {
    color: '#8C49D5',
  },
  paragraph: {
    position: 'absolute',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    lineHeight: 20,
    color: '#1F2937',
  },
  paragraphHighlight: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#8C49D5',
  },
  cardTitle: {
    position: 'absolute',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: '#8C49D5',
  },
  cardTitleGreen: {
    position: 'absolute',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: '#16A34A',
  },
  cardBody: {
    position: 'absolute',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 19,
    color: '#1F2937',
  },
});
