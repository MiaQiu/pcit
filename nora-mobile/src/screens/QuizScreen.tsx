/**
 * QuizScreen
 * Full-screen quiz experience with question, options, and feedback
 * Based on Figma design
 *
 * Flow:
 * 1. Display question and options
 * 2. User selects answer
 * 3. User clicks "Check Answer"
 * 4. Show feedback (correct/incorrect with explanation)
 * 5. User clicks "Continue" to go back to home
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ResponseButton } from '../components/ResponseButton';
import { QuizFeedback } from '../components/QuizFeedback';
import { ProgressBar } from '../components/ProgressBar';
import { Button } from '../components/Button';
import { COLORS, FONTS } from '../constants/assets';
import { LessonService, Quiz, QuizOption, SubmitQuizResponse } from '@nora/core';

interface QuizScreenProps {
  route: {
    params: {
      quizId: string;
      lessonId: string;
      quiz: Quiz;
      totalSegments: number;
      currentSegment: number;
    };
  };
  navigation: any;
}

export const QuizScreen: React.FC<QuizScreenProps> = ({ route, navigation }) => {
  const { quizId, lessonId, quiz, totalSegments, currentSegment } = route.params;

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<SubmitQuizResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedOption) return;

    try {
      setIsLoading(true);

      // TODO: Get lessonService instance from App context
      // const lessonService = getLessonService();
      // const response = await lessonService.submitQuizAnswer(quizId, selectedOption);

      // Mock response - replace with actual API call
      const mockResponse: SubmitQuizResponse = {
        isCorrect: selectedOption === quiz.correctAnswer,
        explanation: quiz.explanation,
        attemptNumber: 1,
      };

      setFeedback(mockResponse);
      setIsSubmitted(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      Alert.alert('Error', 'Failed to submit quiz. Please try again.');
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    // Navigate back to home screen
    navigation.navigate('MainTabs', { screen: 'Home' });
  };

  const handleClose = () => {
    // Go back without submitting
    navigation.goBack();
  };

  // Sort options by order
  const sortedOptions = [...quiz.options].sort((a, b) => a.order - b.order);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header with Progress Bar and Close Button */}
      <View style={styles.header}>
        <ProgressBar
          totalSegments={totalSegments}
          currentSegment={currentSegment}
        />
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          accessibilityLabel="Close quiz"
        >
          <Text style={styles.closeIcon}>×</Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Quiz Icon */}
        {/* <View style={styles.iconContainer}>
          <Text style={styles.icon}>🧠</Text>
        </View> */}

        {/* Badge */}
        <Text style={styles.badge}>Just a quick check</Text>

        {/* Question */}
        <Text style={styles.question}>{quiz.question}</Text>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {sortedOptions.map((option) => (
            <ResponseButton
              key={option.id}
              label={option.optionLabel}
              text={option.optionText}
              isSelected={selectedOption === option.id}
              isSubmitted={isSubmitted}
              isCorrect={option.id === quiz.correctAnswer}
              onPress={() => !isSubmitted && setSelectedOption(option.id)}
            />
          ))}
        </View>

        {/* Feedback */}
        {feedback && (
          <QuizFeedback
            isCorrect={feedback.isCorrect}
            explanation={feedback.explanation}
          />
        )}

        {/* Spacer for button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer with Action Button */}
      <View style={styles.footer}>
        {!isSubmitted ? (
          <Button
            onPress={handleSubmit}
            disabled={!selectedOption || isLoading}
            loading={isLoading}
          >
            Check Answer
          </Button>
        ) : (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
            <View style={styles.continueButton}>
              <Button onPress={handleContinue}>
                Continue →
              </Button>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    position: 'relative',
    paddingTop: 16,
    paddingBottom: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeIcon: {
    fontSize: 32,
    color: COLORS.textDark,
    fontWeight: '300',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 48,
  },
  badge: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.mainPurple,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  question: {
    fontFamily: FONTS.semiBold,
    fontSize: 20,
    lineHeight: 28,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 32,
  },
  optionsContainer: {
    marginBottom: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    height: 64,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 112,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  backButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textDark,
  },
  continueButton: {
    flex: 1,
  },
});
