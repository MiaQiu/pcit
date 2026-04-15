/**
 * Plan Ready Screen
 * Shown after Demo6, before ChildBehaviorProfile.
 * Celebrates that the personalized plan is ready.
 */

import React from 'react';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const PlanReadyScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();
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
        <Text style={styles.title}>
          Hi {userName}, Your Nora{'\n'}plan is ready..
        </Text>
        <Text style={styles.description}>
          Become the confident, authoritative parent you aspire to be—in just 5 minutes a day.
          Watch {childName}'s progress, step by step
        </Text>
      </View>

      {/* Button pinned at the bottom */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('ChildBehaviorProfile')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Unlock my plan  →</Text>
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
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 16,
  },
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
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
