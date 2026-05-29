/**
 * OnboardingButtonRow
 * Layout component for back and continue buttons
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const bottomPadding = insets.bottom + 12;

  return (
    <View style={[styles.buttonRow, { paddingBottom: bottomPadding }]}>
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
    backgroundColor: '#FFFFFF',
    gap: 12,
  },
});
