/**
 * Signup Options Screen
 * Shows social login options and email signup
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useSocialAuthService } from '../../contexts/AppContext';
import {
  useGoogleAuth,
  useFacebookAuth,
  signInWithApple,
} from '../../utils/socialAuth';

export const SignupOptionsScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const socialAuthService = useSocialAuthService();
  const [loading, setLoading] = useState(false);

  // Initialize Google and Facebook auth
  const { signIn: signInWithGoogle, request: googleRequest } = useGoogleAuth();
  const { signIn: signInWithFacebook, request: facebookRequest } =
    useFacebookAuth();

  const handleContinueWithEmail = () => {
    navigation.navigate('CreateAccount');
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  const handleGoogleSignIn = async () => {
    if (!googleRequest) return;

    try {
      setLoading(true);
      const provider = await signInWithGoogle();

      if (provider) {
        await socialAuthService.authenticateWithProvider(provider);
        // Navigation handled by RootNavigator when auth state changes
      }
    } catch (error: any) {
      console.error('Google sign in error:', error);
      Alert.alert('Error', error.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    if (!facebookRequest) return;

    try {
      setLoading(true);
      const provider = await signInWithFacebook();

      if (provider) {
        await socialAuthService.authenticateWithProvider(provider);
        // Navigation handled by RootNavigator when auth state changes
      }
    } catch (error: any) {
      console.error('Facebook sign in error:', error);
      Alert.alert('Error', error.message || 'Failed to sign in with Facebook');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      const provider = await signInWithApple();

      if (provider) {
        await socialAuthService.authenticateWithProvider(provider);
        // Navigation handled by RootNavigator when auth state changes
      }
    } catch (error: any) {
      console.error('Apple sign in error:', error);
      Alert.alert('Error', error.message || 'Failed to sign in with Apple');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>Create an account</Text>

        {/* Social Login Buttons */}
        <View style={styles.buttonsContainer}>
          {/* Google */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleGoogleSignIn}
            activeOpacity={0.8}
            disabled={loading || !googleRequest}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="logo-google" size={20} color="#DB4437" />
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </View>
            {loading && <ActivityIndicator size="small" color="#6B7280" />}
          </TouchableOpacity>

          {/* Apple */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleAppleSignIn}
            activeOpacity={0.8}
            disabled={loading}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="logo-apple" size={20} color="#000000" />
              <Text style={styles.socialButtonText}>Continue with Apple</Text>
            </View>
            {loading && <ActivityIndicator size="small" color="#6B7280" />}
          </TouchableOpacity>

          {/* Facebook */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleFacebookSignIn}
            activeOpacity={0.8}
            disabled={loading || !facebookRequest}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="logo-facebook" size={20} color="#1877F2" />
              <Text style={styles.socialButtonText}>Continue with Facebook</Text>
            </View>
            {loading && <ActivityIndicator size="small" color="#6B7280" />}
          </TouchableOpacity>

          {/* Email */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleContinueWithEmail}
            activeOpacity={0.8}
            disabled={loading}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="mail" size={20} color="#6B7280" />
              <Text style={styles.socialButtonText}>Continue with Email</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* Already have account */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={handleLogin}>
            <Text style={styles.loginLink}>Log in</Text>
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    color: '#1E2939',
    marginBottom: 70,
    marginTop: 60,
    textAlign: 'center',
  },
  buttonsContainer: {
    gap: 16,
  },
  socialButton: {
    width: '100%',
    height: 65,
    backgroundColor: 'transparent',
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  socialButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#1E2939',
  },
  spacer: {
    flex: 1,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 170,
  },
  loginText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#6B7280',
  },
  loginLink: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#1E2939',
    textDecorationLine: 'underline',
  },
});
