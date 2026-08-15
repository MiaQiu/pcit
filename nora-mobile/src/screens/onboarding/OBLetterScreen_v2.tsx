import React, { useEffect } from 'react';
import { View, TouchableOpacity, Image, Text, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import amplitudeService from '../../services/amplitudeService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// OB-letter_v2.png (clean-ish) natural size 634x398 — landscape, cropped
// tight around the envelope + dragon. Unlike the other _v2 assets, "A little
// Secret from Nora" is still baked into the envelope art (kept as stylized
// script), only "Tap to open" was dropped and is overlaid as real text here.
// Rendered "contain" within a (SCREEN_WIDTH-48) square box — since it's
// landscape (w>h), width fills the box and height is letterboxed. The
// <Image> keeps that exact original square size/position; only the text
// overlay is offset to the actual (letterboxed) rendered rect within it.
const IMAGE_ASPECT_RATIO = 634 / 398;
const BOX_SIDE = SCREEN_WIDTH - 48;
const RENDERED_WIDTH = BOX_SIDE;
const RENDERED_HEIGHT = BOX_SIDE / IMAGE_ASPECT_RATIO;
const OVERLAY_LEFT = (BOX_SIDE - RENDERED_WIDTH) / 2;
const OVERLAY_TOP = (BOX_SIDE - RENDERED_HEIGHT) / 2;

export const OBLetterScreen_v2: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob_letter', 20); }, []);

  const handleOpen = () => {
    amplitudeService.trackOnboardingStepCompleted('ob_letter', 20);
    navigation.navigate('OBLetterContent');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <TouchableOpacity style={styles.content} onPress={handleOpen} activeOpacity={0.85}>
        <View style={{ width: BOX_SIDE, height: BOX_SIDE }}>
          <Image
            source={require('../../../assets/images/new onboarding/OB-letter_v2.png')}
            style={{ width: BOX_SIDE, height: BOX_SIDE }}
            resizeMode="contain"
          />
          <View
            style={{
              position: 'absolute',
              left: OVERLAY_LEFT,
              top: OVERLAY_TOP,
              width: RENDERED_WIDTH,
              height: RENDERED_HEIGHT,
            }}
          >
            <Text style={[styles.tapToOpen, { top: '-8%', left: '18%', width: '38%' }]}>
              {t('onboarding.obLetter.tapToOpen')}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDFF',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapToOpen: {
    position: 'absolute',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 20,
    color: '#8C49D5',
  },
});
