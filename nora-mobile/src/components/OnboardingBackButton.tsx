/**
 * OnboardingBackButton
 * Back button for onboarding screens
 */

import React from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TrackedTouchable } from './TrackedTouchable';

interface OnboardingBackButtonProps {
  onPress: () => void;
}

export const OnboardingBackButton: React.FC<OnboardingBackButtonProps> = ({
  onPress,
}) => {
  return (
    <TrackedTouchable analyticsId="on"
      style={styles.button}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons name="arrow-back" size={22} color="#1F2937" />
    </TrackedTouchable>
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
});
