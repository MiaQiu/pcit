/**
 * WACB Survey Screen
 * Weekly Assessment of Child Behavior (WACB-N)
 * Collects parenting stress and child behavior data
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useAuthService } from '../../contexts/AppContext';

const QUESTION_TEXTS = [
  { key: 'q1', text: 'Dawdle, linger, stall, or delay?' },
  { key: 'q2', text: 'Have trouble behaving at meal times?' },
  { key: 'q3', text: 'Disobey or act defiant?' },
  { key: 'q4', text: 'Act angry, or aggressive?' },
  { key: 'q5', text: 'Scream and yell when upset and is hard to calm?' },
  { key: 'q6', text: "Destroy or act careless with others' things?" },
  { key: 'q7', text: 'Provoke others or pick fights?' },
  { key: 'q8', text: 'Interrupt or seek attention?' },
  { key: 'q9', text: 'Have trouble paying attention or is overactive?' },
];

type QuestionState = {
  value: number | null;
  change: boolean | null;
};

export const WacbSurveyScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const authService = useAuthService();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Parenting Stress
  const [parentingStressLevel, setParentingStressLevel] = useState<number | null>(null);
  const [parentingStressChange, setParentingStressChange] = useState<boolean | null>(null);

  // Step 2: Child Behavior Questions
  const [questions, setQuestions] = useState<Record<string, QuestionState>>({
    q1: { value: null, change: null },
    q2: { value: null, change: null },
    q3: { value: null, change: null },
    q4: { value: null, change: null },
    q5: { value: null, change: null },
    q6: { value: null, change: null },
    q7: { value: null, change: null },
    q8: { value: null, change: null },
    q9: { value: null, change: null },
  });

  const handleQuestionChange = (questionKey: string, value: number) => {
    setQuestions(prev => ({
      ...prev,
      [questionKey]: { ...prev[questionKey], value }
    }));
  };

  const handleChangeNeeded = (questionKey: string, needsChange: boolean) => {
    setQuestions(prev => ({
      ...prev,
      [questionKey]: { ...prev[questionKey], change: needsChange }
    }));
  };

  const validateForm = (): string | null => {
    if (parentingStressLevel === null) return 'Please rate your parenting stress level';
    if (parentingStressChange === null) return 'Please indicate if parenting stress needs to change';

    for (const q of QUESTION_TEXTS) {
      if (questions[q.key].value === null) {
        return `Please answer: ${q.text}`;
      }
      if (questions[q.key].change === null) {
        return `Please indicate if change is needed for: ${q.text}`;
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Incomplete Survey', validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      // Use the API URL from authService
      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

      console.log('Submitting WACB survey to:', `${API_URL}/api/wacb-survey`);

      const response = await authService.authenticatedRequest(
        `${API_URL}/api/wacb-survey`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parentingStressLevel,
            parentingStressChange,
            q1Dawdle: questions.q1.value,
            q1Change: questions.q1.change,
            q2MealBehavior: questions.q2.value,
            q2Change: questions.q2.change,
            q3Disobey: questions.q3.value,
            q3Change: questions.q3.change,
            q4Angry: questions.q4.value,
            q4Change: questions.q4.change,
            q5Scream: questions.q5.value,
            q5Change: questions.q5.change,
            q6Destroy: questions.q6.value,
            q6Change: questions.q6.change,
            q7ProvokeFights: questions.q7.value,
            q7Change: questions.q7.change,
            q8Interrupt: questions.q8.value,
            q8Change: questions.q8.change,
            q9Attention: questions.q9.value,
            q9Change: questions.q9.change
          })
        }
      );

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Survey submission error:', errorData);
        throw new Error(errorData.error || 'Failed to submit survey');
      }

      const result = await response.json();
      console.log('Survey submitted successfully:', result);

      // Success - continue to reassurance screen
      navigation.navigate('Reassurance');

    } catch (err: any) {
      console.error('WACB Survey submission error:', err);
      Alert.alert(
        'Submission Error',
        err.message || 'Failed to submit survey. Please try again.\n\nError: Network request failed'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Survey?',
      'You can complete this assessment later from your profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Skip', style: 'destructive', onPress: () => navigation.navigate('Intro1') },
      ]
    );
  };

  const ScaleButton: React.FC<{ value: number; selected: number | null; onPress: (v: number) => void }> = ({ value, selected, onPress }) => (
    <TouchableOpacity
      onPress={() => onPress(value)}
      style={[
        styles.scaleButton,
        selected === value && styles.scaleButtonSelected
      ]}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.scaleButtonText,
        selected === value && styles.scaleButtonTextSelected
      ]}>
        {value}
      </Text>
    </TouchableOpacity>
  );

  const YesNoButton: React.FC<{ label: string; selected: boolean | null; onPress: (v: boolean) => void }> = ({ label, selected, onPress }) => {
    const isYes = label === 'Yes';
    return (
      <TouchableOpacity
        onPress={() => onPress(isYes)}
        style={[
          styles.yesNoButton,
          selected === isYes && styles.yesNoButtonSelected
        ]}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.yesNoButtonText,
          selected === isYes && styles.yesNoButtonTextSelected
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Child Progress Assessment</Text>
        <Text style={styles.subtitle}>Weekly Assessment of Child Behavior (WACB-N)</Text>
        {/* <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity> */}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* STEP 1: Parenting Stress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>STEP 1: Parenting Stress</Text>

          <View style={styles.questionBlock}>
            <Text style={styles.questionText}>
              In the past week, how stressful was it to parent this child?
            </Text>
            <View style={styles.scaleLabels}>
              <Text style={styles.scaleLabel}>Not at all</Text>
              <Text style={styles.scaleLabel}>Very</Text>
            </View>
            <View style={styles.scaleRow}>
              {[1, 2, 3, 4, 5, 6, 7].map(val => (
                <ScaleButton
                  key={val}
                  value={val}
                  selected={parentingStressLevel}
                  onPress={setParentingStressLevel}
                />
              ))}
            </View>
          </View>

          <View style={styles.questionBlock}>
            <Text style={styles.questionText}>Does this need to change?</Text>
            <View style={styles.yesNoRow}>
              <YesNoButton label="Yes" selected={parentingStressChange} onPress={setParentingStressChange} />
              <YesNoButton label="No" selected={parentingStressChange} onPress={setParentingStressChange} />
            </View>
          </View>
        </View>

        {/* STEP 2: Child Behavior Questions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>STEP 2: Child Behavior</Text>
          <Text style={styles.sectionSubtitle}>
            How often does your child... (Select one number per question)
          </Text>

          {QUESTION_TEXTS.map(({ key, text }, index) => (
            <View key={key} style={styles.behaviorQuestion}>
              <Text style={styles.behaviorQuestionText}>
                {index + 1}. {text}
              </Text>

              <View style={styles.scaleLabels}>
                <Text style={styles.scaleLabel}>Never</Text>
                <Text style={styles.scaleLabel}>Always</Text>
              </View>
              <View style={styles.scaleRow}>
                {[1, 2, 3, 4, 5, 6, 7].map(val => (
                  <ScaleButton
                    key={val}
                    value={val}
                    selected={questions[key].value}
                    onPress={(v) => handleQuestionChange(key, v)}
                  />
                ))}
              </View>

              <View style={styles.changeNeededContainer}>
                <Text style={styles.changeNeededText}>Does this need to change?</Text>
                <View style={styles.yesNoRow}>
                  <YesNoButton
                    label="Yes"
                    selected={questions[key].change}
                    onPress={(val) => handleChangeNeeded(key, val)}
                  />
                  <YesNoButton
                    label="No"
                    selected={questions[key].change}
                    onPress={(val) => handleChangeNeeded(key, val)}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Copyright Notice */}
        <Text style={styles.copyright}>
          Copyright © [2011] Dr. Susan Timmer and The Regents of the University of California, Davis campus. All Rights Reserved. Used with permission.
        </Text>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Survey</Text>
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
    fontSize: 24,
    color: '#1E2939',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#6B7280',
  },
  skipButton: {
    position: 'absolute',
    top: 20,
    right: 24,
  },
  skipButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#8C49D5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  section: {
    marginTop: 24,
    padding: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    color: '#1E2939',
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  questionBlock: {
    marginBottom: 20,
  },
  questionText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#1E2939',
    marginBottom: 12,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scaleLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#6B7280',
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  scaleButton: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 44,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleButtonSelected: {
    backgroundColor: '#8C49D5',
  },
  scaleButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#1E2939',
  },
  scaleButtonTextSelected: {
    color: '#FFFFFF',
  },
  yesNoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  yesNoButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    alignItems: 'center',
  },
  yesNoButtonSelected: {
    backgroundColor: '#8C49D5',
  },
  yesNoButtonText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#1E2939',
  },
  yesNoButtonTextSelected: {
    color: '#FFFFFF',
  },
  behaviorQuestion: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  behaviorQuestionText: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 16,
    color: '#1E2939',
    marginBottom: 16,
  },
  changeNeededContainer: {
    marginTop: 16,
  },
  changeNeededText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  copyright: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 24,
    lineHeight: 16,
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
});
