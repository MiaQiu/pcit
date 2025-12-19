/**
 * OnboardingButtonRow
 * Layout component for back and continue buttons
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { OnboardingBackButton } from './OnboardingBackButton';
import { OnboardingButton } from './OnboardingButton';

interface OnboardingButtonRowProps {
  onBack: () => void;
  onContinue: () => void;
  continueDisabled?: boolean;
  continueText?: string;
  backText?: string;
}

export const OnboardingButtonRow: React.FC<OnboardingButtonRowProps> = ({
  onBack,
  onContinue,
  continueDisabled = false,
  continueText = 'Continue',
  backText = 'Back',
}) => {
  return (
    <View style={styles.buttonRow}>
      <OnboardingBackButton onPress={onBack} text={backText} />
      <View style={styles.spacer} />
      <OnboardingButton
        onPress={onContinue}
        disabled={continueDisabled}
        text={continueText}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 0,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  spacer: {
    width: 12,
  },
});
