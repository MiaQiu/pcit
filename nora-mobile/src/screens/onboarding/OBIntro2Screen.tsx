/**
 * OB Intro2 Screen
 * Shown after OBIntro1/ReminderTime — the last screen of onboarding.
 * ChildSnapshotIntro/WacbQuestion1-9/ChildBehaviorProfile/Intro3/PlaySession1-5/
 * NotificationPermission remain registered (unreachable) like Demo1-5/ParentingIntro.
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
import { RootStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import amplitudeService from '../../services/amplitudeService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SCALE = 0.8;
const IMAGE_ASPECT_RATIO = 598 / 608;
const IMAGE_WIDTH = (SCREEN_WIDTH - 48) * IMAGE_SCALE;
const IMAGE_HEIGHT = IMAGE_WIDTH / IMAGE_ASPECT_RATIO;

export const OBIntro2Screen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { completeOnboarding } = useOnboarding();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => { amplitudeService.trackOnboardingScreen('ob_intro2', 27); }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>
        {t('onboarding.obIntro2.sentence1Pre')}
        <Text style={styles.highlight}>{t('onboarding.obIntro2.sentence1Highlight')}</Text>
        {t('onboarding.obIntro2.sentence1Mid')}
        <Text style={styles.highlight}>{t('onboarding.obIntro2.sentence1HighlightWeeks')}</Text>
      </Text>
      <Text style={styles.subtitle}>{t('onboarding.obIntro2.sentence2')}</Text>

      <View style={styles.imageWrapper}>
        <Image
          source={require('../../../assets/images/new onboarding/OB-intro2.png')}
          style={styles.image}
          resizeMode="contain"
        />
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={async () => {
            amplitudeService.trackOnboardingStepCompleted('ob_intro2', 27);
            await completeOnboarding();
            navigation.replace('MainTabs');
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>{t('onboarding.obIntro2.continueButton')}</Text>
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
    fontSize: 20,
    color: '#1F2937',
    lineHeight: 28,
    paddingHorizontal: 50,
    paddingTop: 120,
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
  imageWrapper: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 28,
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
