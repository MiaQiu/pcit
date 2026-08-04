/**
 * OB Intro1 Screen
 * Shown after OBDiscipline, before ChildSnapshotIntro.
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import amplitudeService from '../../services/amplitudeService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SCALE = 0.9;
const IMAGE_ASPECT_RATIO = 586 / 890;
const IMAGE_WIDTH = (SCREEN_WIDTH - 48) * IMAGE_SCALE;
const IMAGE_HEIGHT = IMAGE_WIDTH / IMAGE_ASPECT_RATIO;

export const OBIntro1Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const childName = data.childName || 'your child';

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob_intro1', 25); }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>
        {t('onboarding.obIntro1.helping')}
        {'\n'}
        <Text style={styles.highlight}>{childName}</Text>
        {'\n'}
        {t('onboarding.obIntro1.startsHere')}
      </Text>

      <View style={styles.imageWrapper}>
        <Image
          source={require('../../../assets/images/new onboarding/OB-intro1.png')}
          style={styles.image}
          resizeMode="contain"
        />
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            amplitudeService.trackOnboardingStepCompleted('ob_intro1', 25);
            navigation.navigate('ReminderTime');
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>{t('onboarding.obIntro1.continueButton')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFDFF',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 32,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 38,
    paddingHorizontal: 36,
    paddingTop: 32,
  },
  highlight: {
    color: '#8C49D5',
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
});
