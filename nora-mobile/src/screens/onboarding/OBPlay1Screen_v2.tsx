import React, { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import amplitudeService from '../../services/amplitudeService';
import { OBTemplateV2 } from './OBTemplateV2';
import { ArcText } from './ArcText';

// OB-play1_v2.png (clean, text-free) natural size 598x936 — taller/more
// spaced out than the original OB-play1.png (634x796), so all overlay
// positions are re-mapped to the new blank gaps between the decorative
// sparkles, divider, and tip box.
const IMAGE_ASPECT_RATIO = 598 / 936;

export const OBPlay1Screen_v2: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob_play1', 22); }, []);

  return (
    <OBTemplateV2
      image={require('../../../assets/images/new onboarding/OB-play1_v2.png')}
      imageAspectRatio={IMAGE_ASPECT_RATIO}
      imageScale={1.3}
      onNext={() => {
        amplitudeService.trackOnboardingStepCompleted('ob_play1', 22);
        navigation.navigate('OBPlay2V2');
      }}
    >
      <View pointerEvents="none" style={[styles.headingWrap, { top: '1%' }]}>
        <ArcText text={t('onboarding.obPlay1.heading')} style={styles.heading} />
      </View>

      <Text style={[styles.subtitle, { top: '26%' }]}>
        {t('onboarding.obPlay1.subtitle1Pre')}
        {'\n'}
        <Text style={styles.subtitleHighlight}>{t('onboarding.obPlay1.subtitle1Highlight')}</Text>
      </Text>

      <Text style={[styles.subtitle, { top: '53%' }]}>
        {t('onboarding.obPlay1.subtitle2Line1')}
        {'\n'}
        {t('onboarding.obPlay1.subtitle2Line2')}
        {'\n'}
        <Text style={styles.subtitleHighlight}>{t('onboarding.obPlay1.subtitle2Highlight')}</Text>
      </Text>

      <Text style={[styles.tipLabel, { top: '81%', left: '30%', width: '65%' }]}>
        {t('onboarding.obPlay1.tipLabel')}
      </Text>
      <Text style={[styles.tipLine, { top: '86%', left: '30%', width: '65%' }]}>
        {t('onboarding.obPlay1.tipLine1')}
      </Text>
      <Text style={[styles.tipLine, { top: '91%', left: '30%', width: '65%' }]}>
        {t('onboarding.obPlay1.tipLine2Pre')}
        <Text style={styles.tipHighlight}>{t('onboarding.obPlay1.tipLine2Highlight')}</Text>
        {t('onboarding.obPlay1.tipLine2Post')}
      </Text>
    </OBTemplateV2>
  );
};

const styles = StyleSheet.create({
  headingWrap: {
    position: 'absolute',
    left: 0,
    width: '100%',
  },
  heading: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 46,
    color: '#8C49D5',
  },
  subtitle: {
    position: 'absolute',
    left: 0,
    width: '100%',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 19,
    lineHeight: 26,
    color: '#1F2937',
  },
  subtitleHighlight: {
    color: '#8C49D5',
  },
  tipLabel: {
    position: 'absolute',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    lineHeight: 24,
    color: '#8C49D5',
  },
  tipLine: {
    position: 'absolute',
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 18,
    lineHeight: 24,
    color: '#1F2937',
  },
  tipHighlight: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#8C49D5',
  },
});
