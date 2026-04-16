/**
 * OnboardingBackButton
 * Back button for onboarding screens
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

interface OnboardingBackButtonProps {
  onPress: () => void;
}

export const OnboardingBackButton: React.FC<OnboardingBackButtonProps> = ({
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={styles.buttonText}>←</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 56,
    height: 56,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 22,
    color: '#1F2937',
  },
});
