/**
 * OnboardingTextInput
 * Shared text input for onboarding screens
 */

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';

interface OnboardingTextInputProps {
  title: string;
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing?: () => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export const OnboardingTextInput: React.FC<OnboardingTextInputProps> = ({
  title,
  value,
  onChangeText,
  onSubmitEditing,
  placeholder = '',
  autoCapitalize = 'words',
}) => {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        autoFocus
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={onSubmitEditing}
      />
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: 32,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#4A5565',
    marginBottom: 12,
    textAlign: 'center',
  },
  input: {
    height: 56,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 40,
    color: '#4A5565',
    textAlign: 'center',
  },
});
