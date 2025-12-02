/**
 * LessonViewerScreen
 * Display lesson content with progress tracking, multi-segment support, and integrated quiz
 * Based on Figma design (36:1210)
 *
 * Features:
 * - Segmented progress bar at top
 * - Close button (top-left)
 * - Scrollable content with phase badge, title, body text, and images
 * - Continue button at bottom
 * - Multi-segment navigation
 * - Integrated quiz as final segment
 * - Progress tracking via API
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressBar } from '../components/ProgressBar';
import { Button } from '../components/Button';
import { ResponseButton } from '../components/ResponseButton';
import { QuizFeedback } from '../components/QuizFeedback';
import { COLORS, FONTS } from '../constants/assets';
import { LessonDetailResponse, LessonSegment, SubmitQuizResponse } from '@nora/core';
import { useLessonService } from '../contexts/AppContext';
import { getMockLessonDetail } from '../data/mockLessons';

interface LessonViewerScreenProps {
  route: {
    params: {
      lessonId: string;
    };
  };
  navigation: any;
}

export const LessonViewerScreen: React.FC<LessonViewerScreenProps> = ({ route, navigation }) => {
  const { lessonId } = route.params;
  const lessonService = useLessonService();

  const [loading, setLoading] = useState(true);
  const [lessonData, setLessonData] = useState<LessonDetailResponse | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [startTime, setStartTime] = useState<Date>(new Date());

  // Quiz state
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false);
  const [quizFeedback, setQuizFeedback] = useState<SubmitQuizResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load lesson detail from API
  useEffect(() => {
    loadLessonDetail();
  }, [lessonId]);

  const loadLessonDetail = async () => {
    try {
      setLoading(true);

      // Try to fetch from API
      const data = await lessonService.getLessonDetail(lessonId);
      setLessonData(data);

      // Set initial segment index from user progress
      if (data.userProgress) {
        setCurrentSegmentIndex(data.userProgress.currentSegment - 1);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load lesson:', error);

      // Fallback to mock data
      console.log('Using mock data for lesson:', lessonId);
      const mockData = getMockLessonDetail(lessonId);
      setLessonData(mockData);
      setLoading(false);
    }
  };

  const updateProgress = async (newSegmentIndex: number) => {
    if (!lessonData) return;

    try {
      // Calculate time spent (in seconds)
      const now = new Date();
      const timeSpent = Math.floor((now.getTime() - startTime.getTime()) / 1000);

      // Call API to update progress
      await lessonService.updateProgress(lessonId, {
        currentSegment: newSegmentIndex + 1,
        timeSpentSeconds: timeSpent,
      });

      console.log('Progress updated:', {
        segment: newSegmentIndex + 1,
        timeSpent,
      });

      // Reset timer for next segment
      setStartTime(new Date());
    } catch (error) {
      console.error('Failed to update progress:', error);
      // Continue anyway - don't block user if progress update fails
    }
  };

  const handleSubmitQuiz = async () => {
    if (!selectedOption || !lessonData?.lesson.quiz) return;

    try {
      setIsSubmitting(true);

      // Call API to submit quiz answer
      const response = await lessonService.submitQuizAnswer(
        lessonData.lesson.quiz.id,
        selectedOption
      );

      setQuizFeedback(response);
      setIsQuizSubmitted(true);
      setIsSubmitting(false);
    } catch (error) {
      console.error('Failed to submit quiz:', error);

      // Fallback to mock response
      const isCorrect = selectedOption === lessonData.lesson.quiz.correctAnswer;
      const mockResponse: SubmitQuizResponse = {
        isCorrect,
        explanation: lessonData.lesson.quiz.explanation,
        attemptNumber: 1,
        correctAnswer: lessonData.lesson.quiz.correctAnswer,
        quizResponse: {
          id: 'mock-quiz-response',
          userId: 'mock-user',
          quizId: lessonData.lesson.quiz.id,
          selectedAnswer: selectedOption,
          isCorrect,
          attemptNumber: 1,
          respondedAt: new Date(),
        },
      };

      setQuizFeedback(mockResponse);
      setIsQuizSubmitted(true);
      setIsSubmitting(false);
    }
  };

  const handleContinue = async () => {
    if (!lessonData) return;

    const segments = lessonData.lesson.segments || [];
    const isOnQuiz = currentSegmentIndex === segments.length;

    // If on quiz and submitted, complete the lesson
    if (isOnQuiz && isQuizSubmitted) {
      // Lesson complete, navigate to completion screen
      await updateProgress(currentSegmentIndex + 1);
      navigation.replace('LessonComplete', { lessonId });
      return;
    }

    // If on quiz but not submitted, need to submit first
    if (isOnQuiz && !isQuizSubmitted) {
      await handleSubmitQuiz();
      return;
    }

    // Move to next segment or quiz
    if (currentSegmentIndex < segments.length - 1) {
      // Move to next content segment
      const nextIndex = currentSegmentIndex + 1;
      await updateProgress(nextIndex);
      setCurrentSegmentIndex(nextIndex);
    } else if (lessonData.lesson.quiz) {
      // Move to quiz (last segment)
      await updateProgress(currentSegmentIndex + 1);
      setCurrentSegmentIndex(segments.length);
    } else {
      // No quiz, lesson complete
      Alert.alert('Complete!', 'You finished this lesson!');
      navigation.replace('LessonComplete', { lessonId });
    }
  };

  const handleClose = () => {
    // Save progress before closing
    updateProgress(currentSegmentIndex);
    navigation.goBack();
  };

  const handleBack = () => {
    if (currentSegmentIndex > 0) {
      // Go to previous segment
      setCurrentSegmentIndex(currentSegmentIndex - 1);
      // Reset quiz state if going back from quiz
      const segments = lessonData?.lesson.segments || [];
      if (currentSegmentIndex === segments.length) {
        setSelectedOption(null);
        setIsQuizSubmitted(false);
        setQuizFeedback(null);
      }
    } else {
      // First segment, close the lesson
      handleClose();
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.mainPurple} />
          <Text style={styles.loadingText}>Loading lesson...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!lessonData) {
    return null;
  }

  const { lesson, userProgress } = lessonData;
  const segments = lesson.segments || [];
  const totalSegments = segments.length + (lesson.quiz ? 1 : 0);
  const isOnQuiz = currentSegmentIndex === segments.length;
  const currentSegment = !isOnQuiz ? segments[currentSegmentIndex] : null;

  // Determine button text
  let buttonText = 'Continue →';
  if (isOnQuiz) {
    buttonText = isQuizSubmitted ? 'Continue →' : 'Check Answer';
  } else if (currentSegmentIndex === segments.length - 1 && lesson.quiz) {
    buttonText = 'Take Quiz →';
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header with Progress Bar */}
      <View style={styles.header}>
        <ProgressBar
          totalSegments={totalSegments}
          currentSegment={currentSegmentIndex + 1}
        />

        {/* Close Button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          accessibilityLabel="Close lesson"
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
        {isOnQuiz && lesson.quiz ? (
          /* Quiz Content */
          <>
            {/* Badge */}
            <Text style={styles.quizBadge}>Just a quick check</Text>

            {/* Question */}
            <Text style={styles.quizQuestion}>{lesson.quiz.question}</Text>

            {/* Options */}
            <View style={styles.optionsContainer}>
              {[...lesson.quiz.options].sort((a, b) => a.order - b.order).map((option) => (
                <ResponseButton
                  key={option.id}
                  label={option.optionLabel}
                  text={option.optionText}
                  isSelected={selectedOption === option.id}
                  isSubmitted={isQuizSubmitted}
                  isCorrect={option.id === lesson.quiz!.correctAnswer}
                  onPress={() => !isQuizSubmitted && setSelectedOption(option.id)}
                />
              ))}
            </View>

            {/* Feedback */}
            {quizFeedback && (
              <QuizFeedback
                isCorrect={quizFeedback.isCorrect}
                explanation={quizFeedback.explanation}
              />
            )}
          </>
        ) : (
          /* Lesson Content */
          <>
            {/* Phase Badge */}
            <Text style={styles.phaseBadge}>{lesson.phase}</Text>

            {/* Title */}
            <Text style={styles.title}>{lesson.title}</Text>

            {/* Section Title (if present) */}
            {currentSegment?.sectionTitle && (
              <Text style={styles.sectionTitle}>{currentSegment.sectionTitle}</Text>
            )}

            {/* Body Text */}
            <Text style={styles.bodyText}>{currentSegment?.bodyText || ''}</Text>

            {/* Dragon Image (show on first segment) */}
            {currentSegmentIndex === 0 && lesson.dragonImageUrl && (
              <View style={styles.imageContainer}>
                {/* TODO: Replace with actual Image component when assets are ready */}
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderText}>🐉</Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* Spacer for button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer with Back and Continue Buttons */}
      <View style={styles.footer}>
        <View style={styles.buttonRow}>
          <View style={styles.halfButton}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonText}>← Back</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.halfButton}>
            <Button
              onPress={handleContinue}
              disabled={isOnQuiz && !isQuizSubmitted && !selectedOption}
              loading={isSubmitting}
            >
              {buttonText}
            </Button>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: COLORS.textDark,
    marginTop: 16,
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
  phaseBadge: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.mainPurple,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.2,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 20,
    lineHeight: 26,
    color: COLORS.textDark,
    marginBottom: 16,
  },
  bodyText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textDark,
    textAlign: 'left',
    marginBottom: 32,
  },
  imageContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: '#F5F0FF',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 80,
  },
  quizBadge: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.mainPurple,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  quizQuestion: {
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
  halfButton: {
    flex: 1,
  },
  backButton: {
    height: 64,
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
});
