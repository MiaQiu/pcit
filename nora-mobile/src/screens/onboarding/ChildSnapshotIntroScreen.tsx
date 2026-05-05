/**
 * Child Snapshot Intro Screen
 * Shown after ChildIssue, before WacbQuestion1.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { OnboardingBackButton } from '../../components/OnboardingBackButton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const ChildSnapshotIntroScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();
  const { t } = useTranslation();
  const userName = data.name || 'there';
  const childName = data.childName || 'your child';
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Gradient hero — extends behind status bar */}
      <LinearGradient
        colors={['#B2EAE0', '#DFFAF5', '#FFFFFF']}
        locations={[0, 0.6, 1]}
        style={[styles.heroSection, { paddingTop: insets.top }]}
      >
        <Image
          source={require('../../../assets/images/dragon_waving.png')}
          style={styles.dragonImage}
          resizeMode="contain"
        />
      </LinearGradient>

      {/* Text */}
      <View style={styles.bottomSection}>
        <Text style={styles.description}>
          {t('onboarding.childSnapshotIntro.description', { userName, childName })}
        </Text>
      </View>

      {/* Footer pinned at the bottom */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.buttonRow}>
          <OnboardingBackButton onPress={() => navigation.goBack()} />
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate('WacbQuestion1')}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>{t('onboarding.letsGo')}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('ChildBehaviorProfile', { locked: true })}
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
  dragonImage: {
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_WIDTH * 0.75,
    marginBottom: -8,
  },
  bottomSection: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 28,
    alignItems: 'center',
  },
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 26,
    marginTop:20
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
