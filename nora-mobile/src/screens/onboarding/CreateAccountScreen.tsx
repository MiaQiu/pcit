/**
 * Create Account Screen
 * Social authentication options (Google, Apple, Facebook)
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';

export const CreateAccountScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { updateData } = useOnboarding();

  const handleGoogleAuth = async () => {
    try {
      // TODO: Implement Google authentication
      Alert.alert('Coming Soon', 'Google authentication will be implemented');
      // For now, mock the auth and continue
      updateData({ authMethod: 'google' });
      navigation.navigate('NameInput');
    } catch (error) {
      console.error('Google auth error:', error);
      Alert.alert('Error', 'Failed to authenticate with Google');
    }
  };

  const handleAppleAuth = async () => {
    try {
      // TODO: Implement Apple authentication
      Alert.alert('Coming Soon', 'Apple authentication will be implemented');
      // For now, mock the auth and continue
      updateData({ authMethod: 'apple' });
      navigation.navigate('NameInput');
    } catch (error) {
      console.error('Apple auth error:', error);
      Alert.alert('Error', 'Failed to authenticate with Apple');
    }
  };

  const handleFacebookAuth = async () => {
    try {
      // TODO: Implement Facebook authentication
      Alert.alert('Coming Soon', 'Facebook authentication will be implemented');
      // For now, mock the auth and continue
      updateData({ authMethod: 'facebook' });
      navigation.navigate('NameInput');
    } catch (error) {
      console.error('Facebook auth error:', error);
      Alert.alert('Error', 'Failed to authenticate with Facebook');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Choose your preferred sign-in method
          </Text>
        </View>

        {/* Auth Buttons */}
        <View style={styles.authButtons}>
          {/* Google */}
          <TouchableOpacity
            style={[styles.authButton, styles.googleButton]}
            onPress={handleGoogleAuth}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-google" size={24} color="#EA4335" />
            <Text style={styles.authButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Apple */}
          <TouchableOpacity
            style={[styles.authButton, styles.appleButton]}
            onPress={handleAppleAuth}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-apple" size={24} color="#FFFFFF" />
            <Text style={[styles.authButtonText, styles.appleButtonText]}>
              Continue with Apple
            </Text>
          </TouchableOpacity>

          {/* Facebook */}
          <TouchableOpacity
            style={[styles.authButton, styles.facebookButton]}
            onPress={handleFacebookAuth}
            activeOpacity={0.8}
          >
            <Ionicons name="logo-facebook" size={24} color="#1877F2" />
            <Text style={styles.authButtonText}>Continue with Facebook</Text>
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <Text style={styles.terms}>
          By continuing, you agree to our{'\n'}
          <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
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
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  header: {
    marginBottom: 48,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 32,
    color: '#1F2937',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  authButtons: {
    gap: 16,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  appleButton: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  facebookButton: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  authButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#1F2937',
  },
  appleButtonText: {
    color: '#FFFFFF',
  },
  terms: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 32,
    lineHeight: 18,
  },
  termsLink: {
    color: '#8C49D5',
    textDecorationLine: 'underline',
  },
});
