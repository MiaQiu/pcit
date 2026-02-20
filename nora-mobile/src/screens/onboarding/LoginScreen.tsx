/**
 * Login Screen
 * Allow existing users to log in with email/password, Apple, or Google
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Purchases from 'react-native-purchases';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useAuthService, useSocialAuthService } from '../../contexts/AppContext';
import { ErrorMessages, getErrorMessage } from '../../utils/errorMessages';
import { handleApiSuccess } from '../../utils/NetworkMonitor';
import { requestNotificationPermissions } from '../../utils/notifications';
import amplitudeService from '../../services/amplitudeService';
import { useGoogleAuth, signInWithApple } from '../../utils/socialAuth';

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const authService = useAuthService();
  const socialAuthService = useSocialAuthService();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const { signIn: signInWithGoogle, request: googleRequest } = useGoogleAuth();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }

    try {
      setLoading(true);
      const response = await authService.login(email.trim(), password);
      handleApiSuccess();

      if (response && response.user) {
        const daysInApp = response.user.createdAt
          ? Math.floor((Date.now() - new Date(response.user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        amplitudeService.identifyUser(response.user.id, {
          email: response.user.email,
          name: response.user.name,
          currentStreak: response.user.currentStreak || 0,
          longestStreak: response.user.longestStreak || 0,
          subscriptionPlan: response.user.subscriptionPlan,
          subscriptionStatus: response.user.subscriptionStatus,
          childAge: response.user.childBirthYear ? new Date().getFullYear() - response.user.childBirthYear : undefined,
          relationshipToChild: response.user.relationshipToChild,
          daysInApp,
        });
        amplitudeService.trackLogin('email');

        try {
          const userId = String(response.user.id);
          await Purchases.logIn(userId);
        } catch (revenueCatError) {
          console.error('⚠️ Failed to identify user to RevenueCat:', revenueCatError);
        }
      }

      const accessToken = authService.getAccessToken();
      if (accessToken) {
        requestNotificationPermissions(accessToken).catch(error => {
          console.error('[LoginScreen] Failed to register push notifications:', error);
        });
      }

      const subscriptionStatus = response?.user?.subscriptionStatus;
      if (subscriptionStatus === 'ACTIVE') {
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' as any }] })
        );
      } else {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Onboarding' as any, params: { initialStep: 'Subscription' } }],
          })
        );
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = getErrorMessage(error, ErrorMessages.AUTH.LOGIN_FAILED);
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialAuthSuccess = async (user: any) => {
    // Sync tokens from storage into AuthService's in-memory state so that
    // authenticatedRequest() calls work correctly after social sign-in.
    await authService.initialize();

    try {
      await Purchases.logIn(String(user.id));
    } catch (e) {
      console.error('RevenueCat logIn failed:', e);
    }

    amplitudeService.trackLogin('social');

    const subscriptionStatus = user?.subscriptionStatus;
    if (subscriptionStatus === 'ACTIVE') {
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' as any }] })
      );
    } else {
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Onboarding' as any, params: { initialStep: 'Subscription' } }],
        })
      );
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      const provider = await signInWithApple();
      if (provider) {
        const response = await socialAuthService.authenticateWithProvider(provider);
        await handleSocialAuthSuccess(response.user);
      }
    } catch (error: any) {
      console.error('Apple sign in error:', error);
      Alert.alert('Error', error.message || 'Failed to sign in with Apple');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!googleRequest) return;
    try {
      setLoading(true);
      const provider = await signInWithGoogle();
      if (provider) {
        const response = await socialAuthService.authenticateWithProvider(provider);
        await handleSocialAuthSuccess(response.user);
      }
    } catch (error: any) {
      console.error('Google sign in error:', error);
      Alert.alert('Error', error.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#1E2939" />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Text style={styles.title}>Let's get you logged in</Text>

          {/* Apple Sign In */}
          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleAppleSignIn}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.socialButtonContent}>
                <Ionicons name="logo-apple" size={22} color="#FFFFFF" />
                <Text style={styles.appleButtonText}>Sign in with Apple</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Google Sign In */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleSignIn}
            activeOpacity={0.85}
            disabled={loading || !googleRequest}
          >
            <View style={styles.socialButtonContent}>
              <Ionicons name="logo-google" size={20} color="#DB4437" />
              <Text style={styles.googleButtonText}>Sign in with Google</Text>
            </View>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email Input */}
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            editable={!loading}
          />

          {/* Password Input */}
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#9CA3AF"
              />
            </TouchableOpacity>
          </View>

          {/* Log In Button */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#1E2939" />
            ) : (
              <Text style={styles.loginButtonText}>LOG IN</Text>
            )}
          </TouchableOpacity>

          {/* Forgot Password */}
          <TouchableOpacity
            style={styles.forgotPasswordContainer}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.forgotPasswordText}>Forgot your Password?</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  backButton: {
    marginTop: 8,
    marginLeft: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 30,
    color: '#1E2939',
    marginBottom: 32,
  },
  appleButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#000000',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  socialButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appleButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  googleButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  googleButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#1E2939',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#9CA3AF',
  },
  input: {
    width: '100%',
    height: 56,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 18,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#1E2939',
    marginBottom: 14,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 56,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginBottom: 24,
  },
  passwordInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 18,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#1E2939',
  },
  eyeIcon: {
    paddingHorizontal: 16,
  },
  loginButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  forgotPasswordContainer: {
    alignItems: 'center',
  },
  forgotPasswordText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#1E2939',
  },
});
