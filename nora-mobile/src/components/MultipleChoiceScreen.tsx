/**
 * MultipleChoiceScreen Component
 * Reusable component for all multiple choice question screens
 * Supports both single-select and multi-select modes
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingStackNavigationProp } from '../navigation/types';
import { useOnboarding } from '../contexts/OnboardingContext';
import { OnboardingButtonRow } from './OnboardingButtonRow';
import { OnboardingDragonHeader } from './OnboardingDragonHeader';

export interface MultipleChoiceOption {
  value: string | number;
  label: string;
}

export interface MultipleChoiceScreenProps {
  headerText: string;
  title: string;
  options: MultipleChoiceOption[];
  dataField: string; // e.g., "childGender", "wacb.q1Dawdle", "issue"
  nextScreen: keyof import('../navigation/types').OnboardingStackParamList;
  multiSelect?: boolean;
  continueText?: string;
  onBeforeNavigate?: (selectedValue: any, updateData: any, navigation: any) => Promise<void>;
  progress?: number; // Progress as percentage (0-100)
  disableAutoNavigate?: boolean; // Disable auto-navigation for single-select
}

export const MultipleChoiceScreen: React.FC<MultipleChoiceScreenProps> = ({
  headerText,
  title,
  options,
  dataField,
  nextScreen,
  multiSelect = false,
  continueText = 'Continue',
  onBeforeNavigate,
  progress = 0,
  disableAutoNavigate = false,
}) => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data, updateData } = useOnboarding();

  // Get initial value from context
  const getInitialValue = () => {
    const keys = dataField.split('.');
    let value: any = data;
    for (const key of keys) {
      value = value?.[key];
    }

    if (multiSelect) {
      return Array.isArray(value) ? value : value ? [value] : [];
    }
    return value || null;
  };

  const [selectedValue, setSelectedValue] = useState<any>(getInitialValue());
  const [isLoading, setIsLoading] = useState(false);
  const autoNavigateTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSelect = (value: string | number) => {
    if (multiSelect) {
      setSelectedValue((prev: any[]) => {
        if (prev.includes(value)) {
          return prev.filter((v) => v !== value);
        } else {
          return [...prev, value];
        }
      });
    } else {
      setSelectedValue(value);
      // Auto-navigate for single-select after a short delay to show selection feedback
      if (!disableAutoNavigate) {
        if (autoNavigateTimerRef.current) {
          clearTimeout(autoNavigateTimerRef.current);
        }
        autoNavigateTimerRef.current = setTimeout(() => {
          handleContinue(value);
        }, 50);
      }
    }
  };

  const handleContinue = async (valueOverride?: any) => {
    const valueToUse = valueOverride !== undefined ? valueOverride : selectedValue;

    // Validate the value
    const isValueValid = multiSelect
      ? Array.isArray(valueToUse) && valueToUse.length > 0
      : valueToUse !== null && valueToUse !== undefined;

    if (!isValueValid) return;

    // Build the update object based on dataField path
    const keys = dataField.split('.');
    let updateObj: any = {};

    if (keys.length === 1) {
      // Simple field like "childGender"
      updateObj[keys[0]] = valueToUse;
    } else if (keys.length === 2) {
      // Nested field like "wacb.q1Dawdle"
      const parentValue = data[keys[0] as keyof typeof data];
      updateObj[keys[0]] = {
        ...(typeof parentValue === 'object' && parentValue !== null ? parentValue : {}),
        [keys[1]]: valueToUse,
      };
    }

    updateData(updateObj);

    // Call custom logic before navigation if provided
    if (onBeforeNavigate) {
      setIsLoading(true);
      try {
        await onBeforeNavigate(valueToUse, updateData, navigation);
      } catch (error) {
        // If onBeforeNavigate throws, we don't navigate
        setIsLoading(false);
        return;
      }
      setIsLoading(false);
    }

    navigation.navigate(nextScreen as any);
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const isSelected = (value: string | number) => {
    if (multiSelect) {
      return Array.isArray(selectedValue) && selectedValue.includes(value);
    }
    return selectedValue === value;
  };

  const isValid = multiSelect
    ? Array.isArray(selectedValue) && selectedValue.length > 0
    : selectedValue !== null && selectedValue !== undefined;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Dragon Header */}
        <OnboardingDragonHeader text={headerText} progress={progress} />

        {/* Title */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>

        {/* Options */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {options.map((option) => {
            const selected = isSelected(option.value);
            return (
              <TouchableOpacity
                key={String(option.value)}
                style={[
                  styles.optionCard,
                  selected && styles.optionCardSelected,
                ]}
                onPress={() => handleSelect(option.value)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.optionLabel,
                    selected && styles.optionLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>
                {selected && (
                  <View style={styles.checkmark}>
                    <Ionicons name="checkmark-circle" size={24} color="#007866" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Buttons */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#8C49D5" />
          </View>
        ) : (
          <OnboardingButtonRow
            onBack={handleBack}
            onContinue={() => handleContinue()}
            continueDisabled={!isValid}
            continueText={continueText}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 24,
    color: '#4A5565',
    marginBottom: 12,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 36,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  optionCardSelected: {
    borderColor: '#007866',
    borderWidth: 2,
    backgroundColor: '#EBF9F8',
  },
  optionLabel: {
    flex: 1,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#1E2939',
  },
  optionLabelSelected: {
    color: '#1E2939',
  },
  checkmark: {
    marginLeft: 8,
  },
  loadingContainer: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
