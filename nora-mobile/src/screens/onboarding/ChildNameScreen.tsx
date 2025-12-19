/**
 * Child Name Screen
 * User enters their child's name
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
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';

export const ChildNameScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data, updateData } = useOnboarding();
  const [childName, setChildName] = useState(data.childName);

  const handleContinue = () => {
    if (childName.trim()) {
      updateData({ childName: childName.trim() });
      navigation.navigate('ChildGender');
    }
  };

  const isValid = childName.trim().length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          {/* Dragon Header with Text Box */}
          <View style={styles.headerSection}>
            <View style={styles.dragonIconContainer}>
              <Image
                source={require('../../../assets/images/dragon_image.png')}
                style={styles.dragonIcon}
                resizeMode="contain"
              />
            </View>
            <View style={styles.headerTextBox}>
              <Text style={styles.headerText}>We’ll use their name to personalize tips and messages.
             </Text>
            </View>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>What's your child's name?</Text>
          </View>

          {/* Input */}
          <TextInput
            style={styles.input}
            placeholder=""
            value={childName}
            onChangeText={setChildName}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={handleContinue}
          />

          {/* Spacer */}
          <View style={styles.spacer} />

          {/* Continue Button */}
          <TouchableOpacity
            style={[styles.button, !isValid && styles.buttonDisabled]}
            onPress={handleContinue}
            disabled={!isValid}
            activeOpacity={0.8}
          >
            <Text style={[styles.buttonText, !isValid && styles.buttonTextDisabled]}>
              Continue
            </Text>
          </TouchableOpacity>
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  headerSection: {
    marginBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dragonIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
  },
  dragonIcon: {
    width: 90,
    height: 90,
    marginLeft: 25,
  },
  headerTextBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#364153',
    lineHeight: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#4A5565',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  input: {
    height: 56,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 40,
    color: '#1E2939',
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
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
});
