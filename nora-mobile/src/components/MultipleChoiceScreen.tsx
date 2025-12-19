/**
 * MultipleChoiceScreen Component
 * Reusable component for all multiple choice question screens
 * Supports both single-select and multi-select modes
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingStackNavigationProp } from '../navigation/types';
import { useOnboarding } from '../contexts/OnboardingContext';
import { OnboardingButtonRow } from './OnboardingButtonRow';

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
    }
  };

  const handleContinue = async () => {
    if (!isValid) return;

    // Build the update object based on dataField path
    const keys = dataField.split('.');
    let updateObj: any = {};

    if (keys.length === 1) {
      // Simple field like "childGender"
      updateObj[keys[0]] = selectedValue;
    } else if (keys.length === 2) {
      // Nested field like "wacb.q1Dawdle"
      const parentValue = data[keys[0] as keyof typeof data];
      updateObj[keys[0]] = {
        ...(typeof parentValue === 'object' && parentValue !== null ? parentValue : {}),
        [keys[1]]: selectedValue,
      };
    }

    updateData(updateObj);

    // Call custom logic before navigation if provided
    if (onBeforeNavigate) {
      setIsLoading(true);
      try {
        await onBeforeNavigate(selectedValue, updateData, navigation);
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
        <View style={styles.headerSection}>
          <View style={styles.dragonIconContainer}>
            <Image
              source={require('../../assets/images/dragon_image.png')}
              style={styles.dragonIcon}
              resizeMode="contain"
            />
          </View>
          <View style={styles.headerTextBox}>
            <Text style={styles.headerText}>{headerText}</Text>
          </View>
        </View>

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
            onContinue={handleContinue}
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
  headerSection: {
    marginBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dragonIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
  },
  dragonIcon: {
    width: 90,
    height: 90,
    marginLeft: 25,
  },
  headerTextBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#364153',
    lineHeight: 24,
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
