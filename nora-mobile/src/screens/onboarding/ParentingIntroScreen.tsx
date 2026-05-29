/**
 * Parenting Intro Screen
 * "Just 5 minutes a day can make a difference." - Shown after Demo6
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import amplitudeService from '../../services/amplitudeService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const ParentingIntroScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => { amplitudeService.trackOnboardingScreen('parenting_intro', 11); }, []);

  const CHECK_ITEMS = [
    t('onboarding.parentingIntro.benefit1'),
    t('onboarding.parentingIntro.benefit2'),
    t('onboarding.parentingIntro.benefit3'),
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('onboarding.parentingIntro.title')}</Text>

        <View style={styles.illustrationContainer}>
          <Image
            source={require('../../../assets/images/dragon_image.png')}
            style={styles.illustrationImage}
            resizeMode="contain"
          />
        </View>

        <View style={styles.checkList}>
          {CHECK_ITEMS.map((item) => (
            <View key={item} style={styles.checkRow}>
              <View style={styles.checkbox}>
                <Text style={styles.checkMark}>✓</Text>
              </View>
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Demo5')}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={22} color="#1F2937" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => { amplitudeService.trackOnboardingStepCompleted('parenting_intro', 11); navigation.navigate('NameInput'); }}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>{t('onboarding.parentingIntro.continueButton')}</Text>
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
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 26,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 32,
  },
  illustrationContainer: {
    width: SCREEN_WIDTH * 0.78,
    height: SCREEN_WIDTH * 0.48,
    borderRadius: 9999,
    backgroundColor: '#A2DFCB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 36,
  },
  illustrationImage: {
    width: SCREEN_WIDTH * 0.82,
    height: SCREEN_WIDTH * 0.82,
  },
  checkList: {
    alignSelf: 'center',
    gap: 16,
    marginTop:10
    
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#8C49D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  checkText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#1F2937',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  backButton: {
    width: 56,
    height: 56,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
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
});
