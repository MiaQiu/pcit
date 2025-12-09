/**
 * Depression Survey Screen (PHQ-2)
 * Checks parent wellbeing before starting the program
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useAuthService } from '../../contexts/AppContext';
import { Ionicons } from '@expo/vector-icons';

const OPTIONS = [
  { label: 'Not at all', value: 0 },
  { label: 'Several days', value: 1 },
  { label: 'More than half the days', value: 2 },
  { label: 'Nearly every day', value: 3 },
];

export const DepressionSurveyScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const authService = useAuthService();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [q1Answer, setQ1Answer] = useState<number | null>(null);
  const [q2Answer, setQ2Answer] = useState<number | null>(null);

  const handleSubmit = async () => {
    if (q1Answer === null || q2Answer === null) {
      Alert.alert('Incomplete', 'Please answer both questions to continue.');
      return;
    }

    setIsSubmitting(true);

    try {
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
      const totalScore = q1Answer + q2Answer;

      console.log('Submitting PHQ-2 survey:', { q1Answer, q2Answer, totalScore });
      console.log('API URL:', `${API_URL}/api/phq2-survey`);

      const response = await authService.authenticatedRequest(
        `${API_URL}/api/phq2-survey`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q1Interest: q1Answer,
            q2Depressed: q2Answer,
            totalScore,
          })
        }
      );

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('PHQ-2 submission error:', errorData);
        throw new Error(errorData.error || 'Failed to submit survey');
      }

      // Check score and navigate accordingly
      if (totalScore >= 3) {
        // Positive screen - show self-care message
        navigation.navigate('SelfCare');
      } else {
        // Negative screen - continue to Intro1
        navigation.navigate('Intro1');
      }

    } catch (err: any) {
      console.error('PHQ-2 Survey submission error:', err);
      Alert.alert(
        'Submission Error',
        'Failed to submit survey. You can continue and complete it later from your profile.'
      );
      // Continue anyway on error
      navigation.navigate('Intro1');
    } finally {
      setIsSubmitting(false);
    }
  };

  const OptionButton: React.FC<{ option: typeof OPTIONS[0]; selected: boolean; onPress: () => void }> = ({ option, selected, onPress }) => (
    <TouchableOpacity
      style={[
        styles.optionButton,
        selected && styles.optionButtonSelected
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.optionContent}>
        <Text style={[
          styles.optionText,
          selected && styles.optionTextSelected
        ]}>
          {option.label}
        </Text>
        {selected && (
          <Ionicons name="checkmark-circle" size={24} color="#8C49D5" />
        )}
      </View>
    </TouchableOpacity>
  );

  const isValid = q1Answer !== null && q2Answer !== null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Check-in</Text>
        <Text style={styles.subtitle}>How have you been feeling?</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Introduction */}
        <View style={styles.introBox}>
          <Text style={styles.introText}>
            Parenting takes a lot of energy. Before we dive into the program, we want to check in on how you have been feeling lately.
          </Text>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsBox}>
          <Text style={styles.instructionsText}>
            Over the last 2 weeks, how often have you been bothered by the following problems?
          </Text>
        </View>

        {/* Question 1 */}
        <View style={styles.questionBlock}>
          <Text style={styles.questionText}>
            1. Little interest or pleasure in doing things?
          </Text>
          <View style={styles.optionsContainer}>
            {OPTIONS.map((option) => (
              <OptionButton
                key={option.value}
                option={option}
                selected={q1Answer === option.value}
                onPress={() => setQ1Answer(option.value)}
              />
            ))}
          </View>
        </View>

        {/* Question 2 */}
        <View style={styles.questionBlock}>
          <Text style={styles.questionText}>
            2. Feeling down, depressed, or hopeless?
          </Text>
          <View style={styles.optionsContainer}>
            {OPTIONS.map((option) => (
              <OptionButton
                key={option.value}
                option={option}
                selected={q2Answer === option.value}
                onPress={() => setQ2Answer(option.value)}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, !isValid && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!isValid || isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.submitButtonText, !isValid && styles.submitButtonTextDisabled]}>
              Continue
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 28,
    color: '#1E2939',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  introBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#8C49D5',
  },
  introText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#1E2939',
    lineHeight: 24,
  },
  instructionsBox: {
    marginBottom: 24,
  },
  instructionsText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
  },
  questionBlock: {
    marginBottom: 32,
  },
  questionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#1E2939',
    marginBottom: 16,
    lineHeight: 26,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  optionButtonSelected: {
    borderColor: '#8C49D5',
    backgroundColor: '#F5F0FF',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#4B5563',
  },
  optionTextSelected: {
    color: '#1E2939',
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  submitButton: {
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  submitButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
  submitButtonTextDisabled: {
    color: '#9CA3AF',
  },
});
