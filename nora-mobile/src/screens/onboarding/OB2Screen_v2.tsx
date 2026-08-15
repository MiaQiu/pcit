import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import amplitudeService from '../../services/amplitudeService';
import { OBTemplateV2 } from './OBTemplateV2';

// OB-2_v2.png (clean, text-free) natural size 690x552 — same dimensions and
// card/photo layout as the original OB-2.png, just with the text baked out.
const IMAGE_ASPECT_RATIO = 690 / 552;

export const OB2Screen_v2: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob2', 5); }, []);

  return (
    <OBTemplateV2
      image={require('../../../assets/images/new onboarding/OB-2_v2.png')}
      imageAspectRatio={IMAGE_ASPECT_RATIO}
      imageScale={1.3}
      onNext={() => {
        amplitudeService.trackOnboardingStepCompleted('ob2', 5);
        navigation.navigate('OB3V2');
      }}
    >
      <Text style={[styles.profName, { top: '23%', left: '37%', width: '58%' }]}>
        {t('onboarding.ob2.profName')}
      </Text>
      <Text style={[styles.profTitle, { top: '33%', left: '37%', width: '58%' }]}>
        {t('onboarding.ob2.profTitle1')}
        {'\n'}
        {t('onboarding.ob2.profTitle2')}
      </Text>

      <Text style={[styles.heading, { top: '63%', left: '4%', width: '92%' }]}>
        {t('onboarding.ob2.headingPre')}
        <Text style={styles.headingHighlight}>{t('onboarding.ob2.headingHighlight')}</Text>
        {t('onboarding.ob2.headingPost')}
      </Text>
    </OBTemplateV2>
  );
};

const styles = StyleSheet.create({
  profName: {
    position: 'absolute',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    lineHeight: 22,
    color: '#8C49D5',
  },
  profTitle: {
    position: 'absolute',
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    lineHeight: 19,
    color: '#1F2937',
  },
  heading: {
    position: 'absolute',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 22,
    lineHeight: 28,
    color: '#1F2937',
  },
  headingHighlight: {
    color: '#8C49D5',
  },
});
