/**
 * OnboardingTextInput
 * Shared text input for onboarding screens
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';

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
  const navigation = useNavigation();
  const inputRef = useRef<TextInput>(null);

  // Focus once the screen has finished sliding in. autoFocus opened the keyboard
  // mid-transition, and the keyboard-avoiding layout jumped while the screen animated.
  useEffect(() => {
    const unsubscribe = navigation.addListener('transitionEnd' as any, (e: any) => {
      if (!e?.data?.closing) inputRef.current?.focus();
    });
    // No transition (e.g. the first screen shown): focus shortly after mount
    const fallback = setTimeout(() => inputRef.current?.focus(), 600);
    return () => {
      unsubscribe();
      clearTimeout(fallback);
    };
  }, [navigation]);

  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={value}
        ref={inputRef}
        onChangeText={onChangeText}
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
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 40,
    color: '#4A5565',
    textAlign: 'center',
    ...Platform.select({
      ios: {
        height: 56,
      },
      android: {
        includeFontPadding: false,
        textAlignVertical: 'center',
        paddingVertical: 8,
      },
    }),
  },
});
