/**
 * Start Screen
 * Introduction screen with "Get Started" button
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { Ellipse } from '../../components/Ellipse';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const StartScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();

  const handleGetStarted = () => {
    //navigation.navigate('SignupOptions');
    navigation.navigate('CreateAccount');
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Dragon Image Section with Ellipse Backgrounds */}
        <View style={styles.dragonSection}>
          {/* Ellipse 78 - Top decorative background - #A6E0CB */}
          <Ellipse color="#A6E0CB" style={styles.ellipse78} />

          {/* Ellipse 77 - Bottom decorative background */}
          <Ellipse color="#9BD4DF" style={styles.ellipse77} />

          {/* Dragon Image - Figma node 35:798 */}
          <View style={styles.dragonContainer}>
            <Image
              source={require('../../../assets/images/dragon_image.png')}
              style={styles.dragonImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Nora</Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>
          5 Minutes a Day to a Calmer, {'\n'}
          Happier Child.
        </Text>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Get Started Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={handleGetStarted}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>

        {/* Login Button */}
        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          activeOpacity={0.8}
        >
          <Text style={styles.loginButtonText}>I already have an account</Text>
        </TouchableOpacity>

        {/* Terms and Privacy Policy */}
        <Text style={styles.termsText}>
          By continuing, you agree to Nora's{'\n'}
          <Text style={styles.termsLink}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>
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
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  dragonSection: {
    position: 'relative',
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    marginBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ellipse78: {
    position: 'absolute',
    left: -130,
    top: -70,
    width: 573,
    height: 259,
  },
  ellipse77: {
    position: 'absolute',
    left: -80,
    top: 80,
    width: 473,
    height: 200,
  },
  dragonContainer: {
    position: 'absolute',
    width: '120%',
    height: '120%',
    alignItems: 'center',
    marginBottom: 80,

  },
  dragonImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 40,
    color: '#1E2939',
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
    backgroundColor: '#1E1E1E',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#8C49D5',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  loginButton: {
    width: '100%',
    height: 56,
    backgroundColor: 'transparent',
    borderRadius: 32,
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
  termsText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#8C8C8C',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 8,
  },
  termsLink: {
    color: '#1E2939',
    textDecorationLine: 'underline',
  },
});
