/**
 * Create Account Screen
 * Email/password signup
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Purchases from 'react-native-purchases';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { useAuthService } from '../../contexts/AppContext';
import { ErrorMessages, getErrorMessage } from '../../utils/errorMessages';
import { handleApiSuccess } from '../../utils/NetworkMonitor';
import amplitudeService from '../../services/amplitudeService';

export const CreateAccountScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { updateData } = useOnboarding();
  const authService = useAuthService();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

  const validateEmail = (text: string) => {
    return emailRegex.test(text);
  };

  const validatePassword = (text: string) => {
    return passwordRegex.test(text);
  };

  const isFormValid =
    email.length > 0 &&
    validateEmail(email) &&
    password.length >= 8 &&
    validatePassword(password) &&
    password === confirmPassword;

  const handleSignup = async () => {
    if (!isFormValid) {
      if (!validateEmail(email)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address');
        return;
      }
      if (!validatePassword(password)) {
        Alert.alert(
          'Weak Password',
          'Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number'
        );
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert('Password Mismatch', 'Passwords do not match');
        return;
      }
      return;
    }

    setIsLoading(true);

    try {
      // For now, we'll create a temporary account with minimal data
      // The full profile will be filled in during the next steps
      const response = await authService.signup({
        email: email.toLowerCase().trim(),
        password,
        name: 'User', // Placeholder, will be updated in NameInputScreen
        childName: 'Child', // Placeholder, will be updated in ChildNameScreen
        childBirthYear: new Date().getFullYear() - 5, // Placeholder
        childConditions: ['none'],// Placeholder
      });
      handleApiSuccess(); // Mark server as up

      // Track signup in Amplitude with user properties
      if (response && response.user) {
        amplitudeService.identifyUser(response.user.id, {
          email: response.user.email,
          name: response.user.name,
          currentStreak: 0,
          longestStreak: 0,
          subscriptionPlan: response.user.subscriptionPlan,
          subscriptionStatus: response.user.subscriptionStatus,
          childAge: response.user.childBirthYear ? new Date().getFullYear() - response.user.childBirthYear : undefined,
          relationshipToChild: response.user.relationshipToChild,
          daysInApp: 0, // New user
        });
        amplitudeService.trackSignup('email');

        // Identify user to RevenueCat IMMEDIATELY after account creation
        // This ensures when user reaches subscription screen, RevenueCat knows their ID
        // Webhooks will contain the actual user ID, not an anonymous ID
        try {
          const userId = String(response.user.id);
          await Purchases.logIn(userId);
          console.log('✅ User identified to RevenueCat:', userId);
        } catch (revenueCatError) {
          console.error('⚠️ Failed to identify user to RevenueCat:', revenueCatError);
          // Don't block signup flow if RevenueCat identification fails
        }
      }

      // Store email in onboarding context
      updateData({ email: email.toLowerCase().trim() });

      // Navigate to next step
      navigation.navigate('ParentingIntro');
    } catch (error: any) {
      console.error('Signup error:', error);
      const errorMessage = getErrorMessage(error, ErrorMessages.AUTH.SIGNUP_FAILED);
      Alert.alert('Signup Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create your account</Text>
            {/* <Text style={styles.subtitle}>
              Enter your email and password to get started
            </Text> */}
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
              editable={!isLoading}
              textContentType="oneTimeCode"
              autoComplete="off"
              importantForAutofill="no"
            />
            {email.length > 0 && !validateEmail(email) && (
              <Text style={styles.errorText}>Please enter a valid email</Text>
            )}
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="At least 8 characters"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                editable={!isLoading}
                textContentType="none"
                autoComplete="off"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>
            {password.length > 0 && !validatePassword(password) && (
              <Text style={styles.errorText}>
                Must have 8+ characters, 1 uppercase, 1 lowercase, 1 number
              </Text>
            )}
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Re-enter password"
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSignup}
                editable={!isLoading}
                textContentType="none"
                autoComplete="off"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && password !== confirmPassword && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}
          </View>

          {/* Spacer */}
          <View style={styles.spacer} />

          {/* Create Account Button */}
          <TouchableOpacity
            style={[styles.button, (!isFormValid || isLoading) && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={!isFormValid || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.buttonText, (!isFormValid || isLoading) && styles.buttonTextDisabled]}>
                Create Account
              </Text>
            )}
          </TouchableOpacity>

          {/* Terms */}
          {/* <Text style={styles.terms}>
            By continuing, you agree to our{'\n'}
            <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text> */}
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 32,
    paddingTop: 30,
    paddingBottom: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginLeft: -8,
  },
  header: {
    marginBottom: 32,
    marginTop: 28,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 32,
    color: '#1F2937',
    marginBottom: 32,
    marginTop: 8,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 8,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 20,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#1F2937',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    height: 56,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 20,
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#1F2937',
  },
  eyeIcon: {
    paddingHorizontal: 16,
  },
  errorText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  spacer: {
    flex: 1,
    minHeight: 24,
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#1E1E1E',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 32,
  },
  buttonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  buttonTextDisabled: {
    color: '#9CA3AF',
  },
  terms: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  termsLink: {
    color: '#8C49D5',
    textDecorationLine: 'underline',
  },
});
