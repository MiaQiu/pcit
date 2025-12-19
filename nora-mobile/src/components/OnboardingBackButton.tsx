/**
 * OnboardingBackButton
 * Back button for onboarding screens
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

interface OnboardingBackButtonProps {
  onPress: () => void;
  text?: string;
}

export const OnboardingBackButton: React.FC<OnboardingBackButtonProps> = ({
  onPress,
  text = 'Back',
}) => {
  return (
    <TouchableOpacity
      style={styles.button}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.buttonText}>{text}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flex: 1,
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#000000',
  },
});
