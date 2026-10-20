/**
 * Start Screen
 * Welcome screen after the Nora-Onboarding-1 prototype ("Beyond Parenting Advice.
 * Build Real Skills."). Account-last signup: "Let's start" goes straight into the
 * questions; the account is created at the end of onboarding. Returning users log in here.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useTranslation } from 'react-i18next';
import amplitudeService from '../../services/amplitudeService';
import { TrackedTouchable } from '../../components/TrackedTouchable';

export const StartScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  useEffect(() => {
    amplitudeService.trackOnboardingScreen('start', 2);
  }, []);

  const handleGetStarted = () => {
    amplitudeService.trackOnboardingStepCompleted('start', 2);
    navigation.navigate('NameInput');
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Image source={require('../../../assets/images/dragon_waving.png')} style={styles.art} resizeMode="contain" />

        <Text style={styles.title}>{t('start.welcomeTitle')}</Text>
        <Text style={styles.subtitle}>{t('start.welcomeSubtitle')}</Text>

        <TrackedTouchable analyticsId="start.getStarted" style={styles.button} onPress={handleGetStarted} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{t('start.letsStart')}</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TrackedTouchable>

        <TrackedTouchable analyticsId="start.alreadyHaveAccount" style={styles.loginButton} onPress={handleLogin} activeOpacity={0.6}>
          <Text style={styles.loginButtonText}>{t('start.alreadyHaveAccount')}</Text>
        </TrackedTouchable>
      </View>
    </SafeAreaView>
  );
};

// After the prototype's welcome (index.css .nora-welcome), at the app's text scale
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 110,
  },
  // dragon_waving.png carries its own mint arch background, so no tile around it
  art: {
    width: 110,
    height: 110 * (690 / 640),
    marginBottom: 28,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -1.4,
    color: '#292631',
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 17,
    lineHeight: 29,
    color: '#716d77',
    marginTop: 18,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 54,
    marginTop: 32,
    borderRadius: 10,
    backgroundColor: '#8C49D5',
  },
  buttonText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  loginButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  loginButtonText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 15,
    color: '#5d438f',
  },
});
