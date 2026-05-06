/**
 * OnboardingButtonRow
 * Layout component for back and continue buttons
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { OnboardingBackButton } from './OnboardingBackButton';
import { OnboardingButton } from './OnboardingButton';

interface OnboardingButtonRowProps {
  onBack?: () => void;
  onContinue: () => void;
  continueDisabled?: boolean;
  continueText?: string | undefined;
}

export const OnboardingButtonRow: React.FC<OnboardingButtonRowProps> = ({
  onBack,
  onContinue,
  continueDisabled = false,
  continueText,
}) => {
  return (
    <View style={styles.buttonRow}>
      {onBack ? <OnboardingBackButton onPress={onBack} /> : null}
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
    gap: 12,
  },
});
