/**
 * Intro 3 Screen
 * "We'll show you what a 5-minute session looks like" - preview teaser before subscription
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const Intro3Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();
  const userName = data.name || 'there';
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      {/* Gradient hero */}
      <LinearGradient
        colors={['#B2EAE0', '#DFFAF5', '#FFFFFF']}
        locations={[0, 0.6, 1]}
        style={[styles.heroSection, { paddingTop: insets.top }]}
      >
        <Image
          source={require('../../../assets/images/dragon_s1.png')}
          style={styles.dragonImage}
          resizeMode="contain"
        />
      </LinearGradient>

      {/* Text */}
      <View style={styles.bottomSection}>
        <Text style={styles.description}>
          Hi {userName}, We'll show you what a 5-minute session looks like.{'\n'}No need to do anything yet.
        </Text>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('PlaySession1')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Preview  →</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('Subscription')}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Skip for Now</Text>
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
    justifyContent: 'center',
  },
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 26,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: 'center',
    gap: 12,
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
  skipText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: '#6B7280',
  },
});
