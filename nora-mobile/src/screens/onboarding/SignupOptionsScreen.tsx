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
import { useNavigation, CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Purchases from 'react-native-purchases';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useAuthService, useSocialAuthService } from '../../contexts/AppContext';
import { useOnboarding } from '../../contexts/OnboardingContext';
import {
  useGoogleAuth,
  signInWithApple,
} from '../../utils/socialAuth';

export const SignupOptionsScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const authService = useAuthService();
  const socialAuthService = useSocialAuthService();
  const { updateData } = useOnboarding();
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);

  const { signIn: signInWithGoogle, request: googleRequest } = useGoogleAuth();

  const handleContinueWithEmail = () => {
    navigation.navigate('CreateAccount');
  };

  const handleLogin = () => {
    navigation.navigate('Login');
  };

  const handleSocialAuthSuccess = async (user: any) => {
    // Sync tokens from storage into AuthService's in-memory state so that
    // authenticatedRequest() calls later in onboarding (surveys) work correctly.
    await authService.initialize();

    // Identify user to RevenueCat (same as email signup)
    try {
      await Purchases.logIn(String(user.id));
    } catch (e) {
      console.error('RevenueCat logIn failed:', e);
    }

    // Store email in onboarding context (same as email signup)
    if (user.email) {
      updateData({ email: user.email });
    }

    // New user (childName placeholder) → start onboarding, same as email signup
    // Returning user → go straight to main app
    if (!user.childName || user.childName === 'Child') {
      navigation.navigate('ParentingIntro');
    } else {
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' as any }] })
      );
    }
  };

  const handleGoogleSignIn = async () => {
    if (!googleRequest) return;

    try {
      setLoadingProvider('google');
      const provider = await signInWithGoogle();

      if (provider) {
        const response = await socialAuthService.authenticateWithProvider(provider);
        handleSocialAuthSuccess(response.user);
      }
    } catch (error: any) {
      console.error('Google sign in error:', error);
      Alert.alert('Error', error.message || 'Failed to sign in with Google');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoadingProvider('apple');
      const provider = await signInWithApple();

      if (provider) {
        const response = await socialAuthService.authenticateWithProvider(provider);
        handleSocialAuthSuccess(response.user);
      }
    } catch (error: any) {
      console.error('Apple sign in error:', error);
      Alert.alert('Error', error.message || 'Failed to sign in with Apple');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.replace('Start');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={28} color="#1E2939" />
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.title}>Create an account to save your progress</Text>

        {/* Social Login Buttons */}
        <View style={styles.buttonsContainer}>
          {/* Email */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleContinueWithEmail}
            activeOpacity={0.8}
            disabled={loadingProvider !== null}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="mail" size={20} color="#6B7280" />
              <Text style={styles.socialButtonText}>Continue with Email</Text>
            </View>
          </TouchableOpacity>

          {/* Google */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleGoogleSignIn}
            activeOpacity={0.8}
            disabled={loadingProvider !== null || !googleRequest}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="logo-google" size={20} color="#DB4437" />
              <Text style={styles.socialButtonText}>Continue with Google</Text>
            </View>
            {loadingProvider === 'google' && <ActivityIndicator size="small" color="#6B7280" />}
          </TouchableOpacity>

          {/* Apple - temporarily hidden */}
          {false && (
            <TouchableOpacity
              style={styles.socialButton}
              onPress={handleAppleSignIn}
              activeOpacity={0.8}
              disabled={loadingProvider !== null}
            >
              <View style={styles.buttonContent}>
                <Ionicons name="logo-apple" size={20} color="#000000" />
                <Text style={styles.socialButtonText}>Continue with Apple</Text>
              </View>
              {loadingProvider === 'apple' && <ActivityIndicator size="small" color="#6B7280" />}
            </TouchableOpacity>
          )}
        </View>

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
    paddingTop: 16,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 4,
    marginBottom: 8,
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
    marginTop: 24,
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
