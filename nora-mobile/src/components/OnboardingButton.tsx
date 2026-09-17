/**
 * OnboardingButton
 * Shared continue button for onboarding screens
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { TrackedTouchable } from './TrackedTouchable';

interface OnboardingButtonProps {
  onPress: () => void;
  disabled?: boolean;
  text?: string;
}

export const OnboardingButton: React.FC<OnboardingButtonProps> = ({
  onPress,
  disabled = false,
  text,
}) => {
  const { t } = useTranslation();
  const label = text ?? t('onboarding.continue');

  return (
    <TrackedTouchable analyticsId="on"
      style={[styles.button, disabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[styles.buttonText, disabled && styles.buttonTextDisabled]}>
        {label}
      </Text>
    </TrackedTouchable>
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
