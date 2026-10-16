/**
 * Onboarding Footer
 * Back / continue buttons for onboarding screens, after the Nora-Onboarding-1
 * prototype's footer (index.css .nora-footer): a light top line, a quiet "← Back"
 * text button on the left and a compact main button with an arrow on the right.
 * Colors stay the app's (#8C49D5 main button).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TrackedTouchable } from './TrackedTouchable';

interface OnboardingFooterProps {
  onBack?: () => void;
  onContinue: () => void;
  continueText?: string;
  continueDisabled?: boolean;
  // Side padding of the parent to bleed through, so the top line spans the screen
  parentPadding?: number;
}

export const OnboardingFooter: React.FC<OnboardingFooterProps> = ({
  onBack,
  onContinue,
  continueText,
  continueDisabled = false,
  parentPadding = 0,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const label = continueText ?? t('onboarding.continue');

  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12), marginHorizontal: -parentPadding }]}>
      {onBack ? (
        <TrackedTouchable analyticsId="Onboarding Back" style={styles.back} onPress={onBack} activeOpacity={0.6}>
          <Ionicons name="arrow-back" size={17} color="#79737d" />
          <Text style={styles.backText}>{t('onboarding.back')}</Text>
        </TrackedTouchable>
      ) : (
        <View />
      )}
      <TrackedTouchable
        analyticsId="Onboarding Continue"
        style={[styles.button, continueDisabled && styles.buttonDisabled]}
        onPress={onContinue}
        disabled={continueDisabled}
        activeOpacity={0.85}
      >
        <Text style={[styles.buttonText, continueDisabled && styles.buttonTextDisabled]}>{label}</Text>
        <Ionicons name="arrow-forward" size={17} color={continueDisabled ? '#9CA3AF' : '#FFFFFF'} />
      </TrackedTouchable>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 15,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eeebed',
    backgroundColor: '#FFFFFF',
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  backText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: '#79737d',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 48,
    maxWidth: '76%',
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#8C49D5',
  },
  buttonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  buttonText: {
    flexShrink: 1,
    fontFamily: 'DMSans_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  buttonTextDisabled: {
    color: '#9CA3AF',
  },
});
