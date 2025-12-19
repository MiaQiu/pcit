/**
 * OnboardingButton
 * Shared continue button for onboarding screens
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

interface OnboardingButtonProps {
  onPress: () => void;
  disabled?: boolean;
  text?: string;
}

export const OnboardingButton: React.FC<OnboardingButtonProps> = ({
  onPress,
  disabled = false,
  text = 'Continue',
}) => {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>
        {text}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flex: 1,
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
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
