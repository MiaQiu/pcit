import React, { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import amplitudeService from '../../services/amplitudeService';
import { OBTemplateV2 } from './OBTemplateV2';
import { ArcText } from './ArcText';

// OB-play2_v2.png (clean, text-free) natural size 606x934 — taller/more
// spaced out than the original OB-play2.png (596x812), so overlay positions
// are re-mapped to the new blank gaps between sparkles, icon row, and tip box.
const IMAGE_ASPECT_RATIO = 606 / 934;

export const OBPlay2Screen_v2: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob_play2', 23); }, []);

  return (
    <OBTemplateV2
      image={require('../../../assets/images/new onboarding/OB-play2_v2.png')}
      imageAspectRatio={IMAGE_ASPECT_RATIO}
      imageScale={1.3}
      onNext={() => {
        amplitudeService.trackOnboardingStepCompleted('ob_play2', 23);
        navigation.navigate('OBDisciplineV2');
      }}
    >
      <View pointerEvents="none" style={[styles.headingWrap, { top: '-10%' }]}>
        <ArcText text={t('onboarding.obPlay2.headingLine1')} style={styles.heading} />
        <ArcText text={t('onboarding.obPlay2.headingLine2')} style={styles.heading} />
      </View>

      <Text style={[styles.subtitle, { top: '33%' }]}>
        {t('onboarding.obPlay2.subtitlePre')}
        <Text style={styles.subtitleHighlight}>{t('onboarding.obPlay2.subtitleHighlight')}</Text>
        {t('onboarding.obPlay2.subtitlePost')}
      </Text>

      <Text style={[styles.iconLabel, { top: '70%', left: '-5%', width: '33%' }]}>
        {t('onboarding.obPlay2.iconSeen')}
      </Text>
      <Text style={[styles.iconLabel, { top: '70%', left: '30%', width: '34%' }]}>
        {t('onboarding.obPlay2.iconUnderstood')}
      </Text>
      <Text style={[styles.iconLabel, { top: '70%', left: '70%', width: '33%' }]}>
        {t('onboarding.obPlay2.iconConfident')}
      </Text>

      <Text style={[styles.tip, { top: '90%', left: '18%', width: '78%' }]}>
        {t('onboarding.obPlay2.tipPre')}
        <Text style={styles.tipHighlight}>{t('onboarding.obPlay2.tipHighlight')}</Text>
        {t('onboarding.obPlay2.tipPost')}
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
    fontSize: 44,
    color: '#8C49D5',
  },
  subtitle: {
    position: 'absolute',
    left: 0,
    width: '100%',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 18,
    lineHeight: 24,
    color: '#1F2937',
    marginTop:-30,
  },
  subtitleHighlight: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#8C49D5',
  },
  iconLabel: {
    position: 'absolute',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#1F2937',
  },
  tip: {
    position: 'absolute',
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    lineHeight: 19,
    color: '#1F2937',
  },
  tipHighlight: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#8C49D5',
  },
});
