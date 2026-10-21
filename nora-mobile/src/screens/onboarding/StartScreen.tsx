/**
 * Start Screen
 * Introduction screen with "Get Started" button. Account-first signup: Get Started
 * creates the account, then onboarding continues at OB1V2. The Terms and Privacy
 * line is on CreateAccount.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { MaskedDinoImage } from '../../components/MaskedDinoImage';
import { useTranslation } from 'react-i18next';
import amplitudeService from '../../services/amplitudeService';
import { TrackedTouchable } from '../../components/TrackedTouchable';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const StartScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  useEffect(() => {
    amplitudeService.trackOnboardingScreen('start', 2);
  }, []);

  const handleGetStarted = () => {
    amplitudeService.trackOnboardingStepCompleted('start', 2);
    navigation.navigate('CreateAccount');
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Dragon Image Section */}
        <View style={styles.dragonSection}>
          {/* Dragon Image - Figma node 35:798 */}
          <View style={styles.dragonContainer}>
            <MaskedDinoImage style={styles.dragonImage} />
          </View>
        </View>

        {/* Spacer before title */}
        <View style={styles.spacer} />

        {/* Title */}
        <Text style={styles.title}>Nora</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>{t('start.subtitle')}</Text>

        {/* Spacer after title */}
        <View style={styles.spacer} />

        {/* Get Started Button */}
        <TrackedTouchable analyticsId="start.getStarted"
          style={styles.button}
          onPress={handleGetStarted}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>{t('start.getStarted')}</Text>
        </TrackedTouchable>

        {/* Login Button */}
        <TrackedTouchable analyticsId="start.alreadyHaveAccount"
          style={styles.loginButton}
          onPress={handleLogin}
          activeOpacity={0.8}
        >
          <Text style={styles.loginButtonText}>{t('start.alreadyHaveAccount')}</Text>
        </TrackedTouchable>

      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  dragonSection: {
    position: 'relative',
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    marginTop: -20,
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragonContainer: {
    position: 'absolute',
    width: '125%',
    height: '125%',
    alignItems: 'center',
    //marginBottom: 20,

  },
  dragonImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 40,
    color: '#1E2939',
    marginTop: 10,
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Medium',
    fontSize: 20,
    color: '#1E2939',
    textAlign: 'center',
    lineHeight: 24,
  },
  spacer: {
    flex: 1,
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#1E2939',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    //shadowColor: '#8C49D5',
    // shadowOffset: {
    //   width: 0,
    //   height: 4,
    // },
    //shadowOpacity: 0.3,
    //shadowRadius: 8,
   //elevation: 8,
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  loginButton: {
    width: '100%',
    height: 56,
    backgroundColor: 'transparent',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  loginButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#1E2939',
  },
});
