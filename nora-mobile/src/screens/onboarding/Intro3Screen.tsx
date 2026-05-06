/**
 * Intro 3 Screen
 * Introduces "Emotional Massage" concept before the play session preview
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';

import { OnboardingBackButton } from '../../components/OnboardingBackButton';
import amplitudeService from '../../services/amplitudeService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const Intro3Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => { amplitudeService.trackOnboardingScreen('intro3', 29); }, []);

  return (
    <View style={styles.container}>
      {/* Gradient hero */}
      <LinearGradient
        colors={['#B2EAE0', '#DFFAF5', '#FFFFFF']}
        locations={[0, 0.6, 1]}
        style={[styles.heroSection, { paddingTop: insets.top }]}
      >
        <View style={styles.imageContainer}>
          <Image
            source={require('../../../assets/images/emotional_message.png')}
            style={styles.dragonImage}
            resizeMode="contain"
          />
        </View>
      </LinearGradient>

      {/* Text */}
      <View style={styles.bottomSection}>
        <Text style={styles.title}>{t('onboarding.intro3.title')}</Text>
        <Text style={styles.description}>{t('onboarding.intro3.description')}</Text>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.buttonRow}>
          <OnboardingBackButton onPress={() => navigation.goBack()} />
          <TouchableOpacity
            style={styles.button}
            onPress={() => { amplitudeService.trackOnboardingStepCompleted('intro3', 29); navigation.navigate('PlaySession1'); }}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>{t('onboarding.letsBegin')}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('Subscription')}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>{t('onboarding.skipForNow')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  heroSection: {
    height: SCREEN_HEIGHT * 0.52,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  imageContainer: {
    width: SCREEN_WIDTH * 0.78,
    height: SCREEN_WIDTH * 0.78,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: -8,
  },
  dragonImage: {
    width: SCREEN_WIDTH * 0.95,
    height: SCREEN_WIDTH * 0.95,
  },
  bottomSection: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 26,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: 'center',
    gap: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 12,
  },
  button: {
    flex: 1,
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
  skipText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: '#6B7280',
  },
});
