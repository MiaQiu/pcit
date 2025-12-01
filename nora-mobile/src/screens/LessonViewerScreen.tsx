/**
 * LessonViewerScreen
 * Display lesson content with progress tracking and multi-segment support
 * Based on Figma design (36:1210)
 *
 * Features:
 * - Segmented progress bar at top
 * - Close button (top-left)
 * - Scrollable content with phase badge, title, body text, and images
 * - Continue button at bottom
 * - Multi-segment navigation
 * - Progress tracking via API
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressBar } from '../components/ProgressBar';
import { Button } from '../components/Button';
import { COLORS, FONTS } from '../constants/assets';
import { LessonService, LessonDetailResponse, LessonSegment } from '@nora/core';

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

  const [loading, setLoading] = useState(true);
  const [lessonData, setLessonData] = useState<LessonDetailResponse | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [startTime, setStartTime] = useState<Date>(new Date());

  // Load lesson detail from API
  useEffect(() => {
    loadLessonDetail();
  }, [lessonId]);

  const loadLessonDetail = async () => {
    try {
      setLoading(true);
      // TODO: Get lessonService instance (need to set up in App context)
      // const lessonService = getLessonService();
      // const data = await lessonService.getLessonDetail(lessonId);

      // For now, using mock data
      // Remove this when API is connected
      console.log('Loading lesson:', lessonId);

      // Mock data - replace with actual API call
      const mockData: LessonDetailResponse = {
        lesson: {
          id: lessonId,
          phase: 'CONNECT',
          phaseNumber: 1,
          dayNumber: 1,
          title: 'The Power of Praise',
          subtitle: 'Why praise matters',
          shortDescription: 'Learn how praise shapes behavior',
          objectives: ['Understand the power of praise', 'Learn different types of praise'],
          estimatedMinutes: 2,
          isBooster: false,
          prerequisites: [],
          teachesCategories: ['PRAISE'],
          dragonImageUrl: 'https://example.com/dragon.png',
          backgroundColor: '#E4E4FF',
          ellipse77Color: '#9BD4DF',
          ellipse78Color: '#A6E0CB',
          segments: [
            {
              id: '1',
              lessonId,
              order: 1,
              sectionTitle: 'Introduction',
              contentType: 'TEXT',
              bodyText: 'When you praise your child for positive behaviors, you\'re not just making them feel good—you\'re teaching them what to do more of.\n\nSpecific praise like "I love how you shared your toy!" is more effective than general praise like "Good job!" because it shows your child exactly what they did right.\n\nThink of praise as fuel for their confidence and motivation to keep trying.',
            },
            {
              id: '2',
              lessonId,
              order: 2,
              sectionTitle: 'Types of Praise',
              contentType: 'EXAMPLE',
              bodyText: 'Labeled Praise: "I love how you put your toys away!"\nUnlabeled Praise: "Good job!"\n\nLabeled praise is more effective because it tells your child exactly what they did right.',
            },
            {
              id: '3',
              lessonId,
              order: 3,
              sectionTitle: 'Practice Tips',
              contentType: 'TIP',
              bodyText: 'Start with simple observations:\n• "You\'re sitting so nicely!"\n• "Great job sharing!"\n• "I love your gentle hands!"\n\nPractice during play time when behavior is positive.',
            },
          ],
          quiz: {
            id: 'quiz-1',
            lessonId,
            question: 'Which is a "Super-Praise"?',
            correctAnswer: 'option-2',
            explanation: 'It\'s specific, describes the behaviour, and shows positive attention.',
            options: [
              {
                id: 'option-1',
                optionLabel: 'A',
                optionText: 'You\'re so smart!',
                order: 1,
              },
              {
                id: 'option-2',
                optionLabel: 'B',
                optionText: 'You\'re using so many colors in that drawing!',
                order: 2,
              },
              {
                id: 'option-3',
                optionLabel: 'C',
                optionText: 'Good job!',
                order: 3,
              },
            ],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        userProgress: {
          id: 'progress-1',
          userId: 'user-1',
          lessonId,
          status: 'IN_PROGRESS',
          currentSegment: 1,
          totalSegments: 3,
          startedAt: new Date(),
          lastViewedAt: new Date(),
          timeSpentSeconds: 0,
        },
      };

      setLessonData(mockData);

      // Set initial segment index from user progress
      if (mockData.userProgress) {
        setCurrentSegmentIndex(mockData.userProgress.currentSegment - 1);
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load lesson:', error);
      Alert.alert('Error', 'Failed to load lesson. Please try again.');
      setLoading(false);
      navigation.goBack();
    }
  };

  const updateProgress = async (newSegmentIndex: number) => {
    if (!lessonData) return;

    try {
      // Calculate time spent (in seconds)
      const now = new Date();
      const timeSpent = Math.floor((now.getTime() - startTime.getTime()) / 1000);

      // TODO: Call API to update progress
      // const lessonService = getLessonService();
      // await lessonService.updateProgress(lessonId, {
      //   currentSegment: newSegmentIndex + 1,
      //   timeSpentSeconds: timeSpent,
      //   status: newSegmentIndex >= lessonData.lesson.segments!.length ? 'COMPLETED' : 'IN_PROGRESS'
      // });

      console.log('Progress updated:', {
        segment: newSegmentIndex + 1,
        timeSpent,
      });

      // Reset timer for next segment
      setStartTime(new Date());
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  };

  const handleContinue = async () => {
    if (!lessonData) return;

    const segments = lessonData.lesson.segments || [];

    if (currentSegmentIndex < segments.length - 1) {
      // Move to next segment
      const nextIndex = currentSegmentIndex + 1;
      await updateProgress(nextIndex);
      setCurrentSegmentIndex(nextIndex);
    } else {
      // All segments complete, navigate to quiz
      await updateProgress(currentSegmentIndex + 1);

      if (lessonData.lesson.quiz) {
        // Navigate to quiz screen
        const contentSegments = lessonData.lesson.segments?.length || 0;
        const totalSegs = contentSegments + 1; // +1 for quiz
        navigation.navigate('Quiz', {
          quizId: lessonData.lesson.quiz.id,
          lessonId,
          quiz: lessonData.lesson.quiz,
          totalSegments: totalSegs,
          currentSegment: totalSegs, // Quiz is the last segment
        });
      } else {
        // No quiz, lesson complete
        Alert.alert('Complete!', 'You finished this lesson!');
        navigation.goBack();
      }
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
  const currentSegment = segments[currentSegmentIndex];
  // Total segments includes content segments + quiz (if exists)
  const totalSegments = segments.length + (lesson.quiz ? 1 : 0);

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
            <Button onPress={handleContinue}>
              {currentSegmentIndex < totalSegments - 1 ? 'Continue →' : 'Take Quiz →'}
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
