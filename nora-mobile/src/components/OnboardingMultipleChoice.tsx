/**
 * OnboardingMultipleChoice
 * Shared multiple choice options for onboarding screens
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export interface Option<T = string> {
  id: T;
  label: string;
}

interface OnboardingMultipleChoiceProps<T = string> {
  title: string;
  options: Option<T>[];
  selectedValue: T | null;
  onSelect: (value: T) => void;
}

export const OnboardingMultipleChoice = <T extends string>({
  title,
  options,
  selectedValue,
  onSelect,
}: OnboardingMultipleChoiceProps<T>) => {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.optionButton,
              selectedValue === option.id && styles.optionButtonSelected,
            ]}
            onPress={() => onSelect(option.id)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.optionText,
                selectedValue === option.id && styles.optionTextSelected,
              ]}
            >
              {option.label}
            </Text>
            {selectedValue === option.id && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#4A5565',
    lineHeight: 32,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  optionButtonSelected: {
    backgroundColor: '#E0F2F1',
    borderColor: '#0D9488',
  },
  optionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#1E2939',
    textAlign: 'left',
    flex: 1,
  },
  optionTextSelected: {
    color: '#1E2939',
  },
  checkmark: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0D9488',
    marginLeft: 8,
  },
});
