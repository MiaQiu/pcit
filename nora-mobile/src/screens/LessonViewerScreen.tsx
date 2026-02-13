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

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Share, PanResponder, Clipboard, AppState, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressBar } from '../components/ProgressBar';
import { Button } from '../components/Button';
import { ResponseButton } from '../components/ResponseButton';
import { QuizFeedback } from '../components/QuizFeedback';
import { TextInputFeedbackCard } from '../components/TextInputFeedbackCard';
import { LessonContentCard } from '../components/LessonContentCard';
import { PhaseCelebrationModal } from '../components/PhaseCelebrationModal';
import { COLORS, FONTS } from '../constants/assets';
import { LessonDetailResponse, LessonSegment, SubmitQuizResponse, SubmitTextInputResponse, LessonNotFoundError, Keyword, KeywordMatch } from '@nora/core';
import { useLessonService } from '../contexts/AppContext';
import { KeywordDefinitionModal } from '../components/KeywordDefinitionModal';
import { getMockLessonDetail } from '../data/mockLessons';
import { LessonCache } from '../lib/LessonCache';
import amplitudeService from '../services/amplitudeService';
import { getTodaySingapore } from '../utils/timezone';

/**
 * Format body text with markdown-like formatting:
 * - Replace * at start of lines with purple bullets
 * - Convert **text** to bold
 * - Highlight keywords
 */
const formatBodyText = (text: string, keywordsList: Keyword[], setSelectedKeyword: (k: Keyword) => void, setShowKeywordModal: (show: boolean) => void) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    // Check if line starts with * (bullet point)
    const bulletMatch = line.match(/^(\s*)\*\s(.+)$/);

    if (bulletMatch) {
      // Line is a bullet point
      const indent = bulletMatch[1];
      const content = bulletMatch[2];
      const formattedContent = formatInlineText(content, keywordsList, setSelectedKeyword, setShowKeywordModal);

      elements.push(
        <View key={lineIndex} style={{ flexDirection: 'row', marginBottom: 10 }}>
          <Text style={{ color: COLORS.mainPurple, fontSize: 32, marginRight: 8, marginTop: -8}}>•</Text>
          <Text style={{ flex: 1, fontFamily: FONTS.regular, fontSize: 18, lineHeight: 26, color: COLORS.textDark }}>
            {formattedContent}
          </Text>
        </View>
      );
    } else if (line.trim() === '') {
      // Empty line
      elements.push(<View key={lineIndex} style={{ height: 8 }} />);
    } else {
      // Regular text line
      const formattedContent = formatInlineText(line, keywordsList, setSelectedKeyword, setShowKeywordModal);
      elements.push(
        <Text key={lineIndex} style={{ fontFamily: FONTS.regular, fontSize: 18, lineHeight: 26, color: COLORS.textDark, marginBottom: 10 }}>
          {formattedContent}
        </Text>
      );
    }
  });

  return <View>{elements}</View>;
};

/**
 * Format inline text to handle **bold** markers and keyword highlighting
 */
const formatInlineText = (text: string, keywordsList: Keyword[] = [], setSelectedKeyword: (k: Keyword) => void, setShowKeywordModal: (show: boolean) => void) => {
  const parts: React.ReactNode[] = [];
  let currentIndex = 0;

  // Find all bold markers first
  const boldRegex = /\*\*(.+?)\*\*/g;
  const boldRanges: Array<{ start: number; end: number; innerText: string; innerStart: number; innerEnd: number }> = [];
  let match;

  while ((match = boldRegex.exec(text)) !== null) {
    boldRanges.push({
      start: match.index,
      end: match.index + match[0].length,
      innerText: match[1],
      innerStart: match.index + 2, // After **
      innerEnd: match.index + match[0].length - 2, // Before **
    });
  }

  // Find keywords, excluding those inside bold markers (we'll handle them separately)
  const keywordMatches = findKeywordMatches(text, keywordsList);
  const nonBoldKeywords = keywordMatches.filter(km => {
    // Check if this keyword is completely inside a bold range
    return !boldRanges.some(br => km.startIndex >= br.innerStart && km.endIndex <= br.innerEnd);
  });

  // Combine markers, but track bold ranges separately for nested rendering
  const allMarkers: Array<{
    start: number;
    end: number;
    type: 'bold' | 'keyword';
    data: any;
  }> = [
    ...boldRanges.map(m => ({
      start: m.start,
      end: m.end,
      type: 'bold' as const,
      data: m
    })),
    ...nonBoldKeywords.map(m => ({
      start: m.startIndex,
      end: m.endIndex,
      type: 'keyword' as const,
      data: m.keyword
    })),
  ].sort((a, b) => a.start - b.start);

  // Render text with markers
  allMarkers.forEach((marker, index) => {
    // Skip if we've already passed this position
    if (marker.start < currentIndex) {
      return;
    }

    // Add text before this marker
    if (marker.start > currentIndex) {
      parts.push(text.substring(currentIndex, marker.start));
    }

    if (marker.type === 'bold') {
      const boldRange = marker.data;
      const innerText = boldRange.innerText;

      // Check if there are keywords inside this bold text
      const keywordsInBold = keywordMatches.filter(km =>
        km.startIndex >= boldRange.innerStart && km.endIndex <= boldRange.innerEnd
      );

      if (keywordsInBold.length > 0) {
        // Render bold text with nested keywords
        const boldParts: React.ReactNode[] = [];
        let boldIndex = 0;

        keywordsInBold.forEach((km, kidx) => {
          const relativeStart = km.startIndex - boldRange.innerStart;
          const relativeEnd = km.endIndex - boldRange.innerStart;

          // Text before keyword
          if (relativeStart > boldIndex) {
            boldParts.push(innerText.substring(boldIndex, relativeStart));
          }

          // Keyword (bold + underlined)
          boldParts.push(
            <Text
              key={`keyword-${index}-${kidx}`}
              style={{
                fontFamily: FONTS.bold,
                textDecorationLine: 'underline',
                textDecorationColor: COLORS.mainPurple,
                color: COLORS.mainPurple,
              }}
              onPress={() => {
                setSelectedKeyword(km.keyword);
                setShowKeywordModal(true);
              }}
            >
              {innerText.substring(relativeStart, relativeEnd)}
            </Text>
          );

          boldIndex = relativeEnd;
        });

        // Remaining bold text
        if (boldIndex < innerText.length) {
          boldParts.push(innerText.substring(boldIndex));
        }

        parts.push(
          <Text key={`bold-${index}`} style={{ fontFamily: FONTS.bold }}>
            {boldParts}
          </Text>
        );
      } else {
        // Just bold, no keywords
        parts.push(
          <Text key={`bold-${index}`} style={{ fontFamily: FONTS.bold }}>
            {innerText}
          </Text>
        );
      }

      currentIndex = marker.end;
    } else if (marker.type === 'keyword') {
      const keywordText = text.substring(marker.start, marker.end);
      parts.push(
        <Text
          key={`keyword-${index}`}
          style={{
            textDecorationLine: 'underline',
            textDecorationColor: COLORS.mainPurple,
            color: COLORS.mainPurple,
          }}
          onPress={() => {
            setSelectedKeyword(marker.data);
            setShowKeywordModal(true);
          }}
        >
          {keywordText}
        </Text>
      );

      currentIndex = marker.end;
    }
  });

  // Add remaining text
  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }

  return parts.length > 0 ? parts : text;
};

/**
 * Escape special regex characters
 */
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Find keyword matches in text
 * @param text - The text to search
 * @param keywords - Array of keywords to match
 * @returns Array of matches with positions
 */
const findKeywordMatches = (text: string, keywords: Keyword[]): KeywordMatch[] => {
  const matches: KeywordMatch[] = [];

  // Sort keywords by term length (longest first) to match longest terms first
  // This prevents "Play" from matching before "Play Therapy"
  const sortedKeywords = [...keywords].sort((a, b) => b.term.length - a.term.length);

  for (const keyword of sortedKeywords) {
    // Use word boundary regex for whole-word matching
    // Case-insensitive search
    const regex = new RegExp(`\\b${escapeRegex(keyword.term)}\\b`, 'gi');
    let match;

    while ((match = regex.exec(text)) !== null) {
      const startIndex = match.index;
      const endIndex = startIndex + match[0].length;

      // Check if this position overlaps with existing match
      const hasOverlap = matches.some(m =>
        (startIndex >= m.startIndex && startIndex < m.endIndex) ||
        (endIndex > m.startIndex && endIndex <= m.endIndex)
      );

      if (!hasOverlap) {
        matches.push({
          keyword,
          startIndex,
          endIndex,
        });
      }
    }
  }

  // Sort by position for sequential rendering
  return matches.sort((a, b) => a.startIndex - b.startIndex);
};

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
  const [showPhaseCelebration, setShowPhaseCelebration] = useState(false);
  const [lastRefreshDate, setLastRefreshDate] = useState<string>(getTodaySingapore());

  // Text input state
  const [userTextInput, setUserTextInput] = useState<string>('');
  const [isTextInputSubmitted, setIsTextInputSubmitted] = useState(false);
  const [isTextInputSubmitting, setIsTextInputSubmitting] = useState(false);
  const [textInputFeedback, setTextInputFeedback] = useState<SubmitTextInputResponse | null>(null);

  // Keyword modal state
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);
  const [showKeywordModal, setShowKeywordModal] = useState(false);
  const [keywords, setKeywords] = useState<Keyword[]>([]);

  // Refs to store latest function references for panResponder
  const handleContinueRef = useRef<(() => void) | undefined>(undefined);
  const handleBackRef = useRef<(() => void) | undefined>(undefined);

  // Swipe gesture handler
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => {
        const isHorizontalSwipe = Math.abs(gestureState.dx) > 15 &&
                                   Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.5;
        return isHorizontalSwipe;
      },
      onPanResponderGrant: () => {},
      onPanResponderRelease: (_, gestureState) => {
        const { dx, dy } = gestureState;
        const swipeThreshold = 60;

        console.log('Gesture detected:', { dx, dy, threshold: swipeThreshold });

        if (Math.abs(dx) > Math.abs(dy) * 1.5 && Math.abs(dx) > swipeThreshold) {
          if (dx > 0) {
            console.log('Swipe right detected - calling handleContinue');
            handleContinueRef.current?.();
          } else {
            console.log('Swipe left detected - calling handleBack');
            handleBackRef.current?.();
          }
        } else {
          console.log('Gesture did not meet threshold requirements');
        }
      },
    })
  ).current;

  // Load lesson detail from API
  useEffect(() => {
    loadLessonDetail();
  }, [lessonId]);

  // Listen for app coming to foreground and refresh if date changed
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        const today = getTodaySingapore();
        console.log('[LessonViewerScreen] App came to foreground. Last refresh:', lastRefreshDate, 'Today:', today);

        if (today !== lastRefreshDate) {
          console.log('[LessonViewerScreen] Date changed since last refresh - reloading lesson data');
          setLastRefreshDate(today);
          loadLessonDetail();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [lastRefreshDate, lessonId]);

  const loadLessonDetail = async () => {
    try {
      setLoading(true);

      // Try to get from cache first for instant loading
      const cachedData = await LessonCache.get(lessonId);
      if (cachedData) {
        console.log('Loading lesson from cache:', lessonId);

        // Validate cached data - check if segment index is valid
        const segments = cachedData.lesson.segments || [];
        const totalSegments = segments.length + (cachedData.lesson.quiz ? 1 : 0);
        const savedSegment = cachedData.userProgress?.currentSegment ?? 1;
        const segmentIndex = savedSegment - 1;

        // If cached data has invalid segment index, invalidate cache and fetch fresh
        if (segmentIndex < 0 || segmentIndex > totalSegments) {
          console.log('⚠️ Cache validation failed: invalid segment index, fetching fresh data');
          await LessonCache.remove(lessonId);
          // Continue to fetch from API below
        } else {
          console.log('✅ Cache validation passed, using cached data');
          setLessonData(cachedData);
          if (cachedData.keywords) {
            setKeywords(cachedData.keywords);
          }
          setLoading(false);

          // Set initial segment index from cached data
          // If lesson is completed, always start from beginning
          if (cachedData.userProgress?.status === 'COMPLETED') {
            setCurrentSegmentIndex(0);
          } else {
            const validSegment = segmentIndex >= totalSegments ? 0 : segmentIndex;
            setCurrentSegmentIndex(validSegment);
          }

          // Fetch fresh data in background to update cache and progress
          lessonService.getLessonDetail(lessonId)
            .then(freshData => {
              setLessonData(freshData);

              // Update last refresh date after successful API fetch
              setLastRefreshDate(getTodaySingapore());

              // Update segment index if progress changed
              if (freshData.userProgress) {
                // If lesson is completed, always start from beginning
                if (freshData.userProgress.status === 'COMPLETED') {
                  setCurrentSegmentIndex(0);
                } else {
                  const freshSegmentIndex = freshData.userProgress.currentSegment - 1;
                  const freshValidSegment = freshSegmentIndex >= totalSegments ? 0 : freshSegmentIndex;
                  setCurrentSegmentIndex(freshValidSegment);
                }
              }

              // Update keywords if changed
              if (freshData.keywords) {
                setKeywords(freshData.keywords);
              }

              LessonCache.set(lessonId, freshData);
            })
            .catch(err => console.log('Background refresh failed:', err));

          return;
        }
      }

      // No cache, fetch from API
      const data = await lessonService.getLessonDetail(lessonId);
      setLessonData(data);

      // Set keywords from API response
      if (data.keywords) {
        setKeywords(data.keywords);
      }

      // Update last refresh date after successful API fetch
      setLastRefreshDate(getTodaySingapore());

      // Cache the data for future use
      await LessonCache.set(lessonId, data);

      // Set initial segment index from user progress
      if (data.userProgress) {
        const segments = data.lesson.segments || [];
        const totalSegments = segments.length + (data.lesson.quiz ? 1 : 0);
        const savedSegment = data.userProgress.currentSegment - 1;

        // If lesson is completed, always start from beginning
        // Otherwise, resume from saved segment
        if (data.userProgress.status === 'COMPLETED') {
          setCurrentSegmentIndex(0);
        } else {
          // Bounds check: if saved segment is beyond total, reset to first segment
          const validSegment = savedSegment >= totalSegments ? 0 : savedSegment;
          setCurrentSegmentIndex(validSegment);
        }
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Failed to load lesson:', error);

      // Handle lesson not found (404) - lesson may have been updated/deleted
      if (error instanceof LessonNotFoundError || error.name === 'LessonNotFoundError') {
        console.log('Lesson not found - clearing cache and returning to Learn screen');
        setLoading(false);

        // Clear all lesson caches to force refresh
        await LessonCache.clear();
        await LessonCache.removeLessonsList();

        // Navigate back to Learn screen
        navigation.goBack();

        // Show user-friendly message
        Alert.alert(
          'Content Updated',
          'This lesson has been updated. Please select it again to view the latest version.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Check if lesson is locked (403 error)
      if (error.message?.includes('Prerequisites not met') || error.message?.includes('403')) {
        setLoading(false);
        // Navigate back and show error
        navigation.goBack();
        // Note: In a production app, you might want to show an Alert here
        return;
      }

      // Fallback to mock data for other errors
      console.log('Using mock data for lesson:', lessonId);
      const mockData = getMockLessonDetail(lessonId);
      setLessonData(mockData);
      setLoading(false);
    }
  };

  const updateProgress = async (newSegmentIndex: number, saveImmediately = false) => {
    if (!lessonData) return;

    try {
      // Calculate time spent (in seconds)
      const now = new Date();
      const timeSpent = Math.floor((now.getTime() - startTime.getTime()) / 1000);

      // Only save to API if explicitly requested (e.g., on lesson close or completion)
      // Otherwise, just track locally for better performance
      if (saveImmediately) {
        await lessonService.updateProgress(lessonId, {
          currentSegment: newSegmentIndex + 1,
          timeSpentSeconds: timeSpent,
        });

        console.log('Progress saved to server:', {
          segment: newSegmentIndex + 1,
          timeSpent,
        });
      } else {
        console.log('Progress tracked locally:', {
          segment: newSegmentIndex + 1,
          timeSpent,
        });
      }

      // Reset timer for next segment
      setStartTime(new Date());
    } catch (error: any) {
      console.error('Failed to update progress:', error);

      // Handle lesson not found (404) - lesson may have been updated/deleted
      if (error instanceof LessonNotFoundError || error.name === 'LessonNotFoundError') {
        console.log('Lesson not found during progress update - clearing cache');
        await LessonCache.clear();
        await LessonCache.removeLessonsList();
        navigation.goBack();
        Alert.alert(
          'Content Updated',
          'This lesson has been updated. Please select it again to view the latest version.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Continue anyway for other errors - don't block user if progress update fails
    }
  };

  const completeLesson = async () => {
    if (!lessonData) return;

    try {
      const now = new Date();
      const timeSpent = Math.floor((now.getTime() - startTime.getTime()) / 1000);
      const segments = lessonData.lesson.segments || [];
      const totalSegments = segments.length + (lessonData.lesson.quiz ? 1 : 0);

      await lessonService.updateProgress(lessonId, {
        currentSegment: totalSegments,
        timeSpentSeconds: timeSpent,
        status: 'COMPLETED',
      });

      console.log('Lesson marked as completed');

      // Track lesson completion
      amplitudeService.trackLessonCompleted(
        lessonData.lesson.id,
        lessonData.lesson.title,
        timeSpent,
        {
          lessonModule: lessonData.lesson.module,
          dayNumber: lessonData.lesson.dayNumber,
          totalSegments,
        }
      );
    } catch (error: any) {
      console.error('Failed to mark lesson as completed:', error);

      // Handle lesson not found (404) - lesson may have been updated/deleted
      if (error instanceof LessonNotFoundError || error.name === 'LessonNotFoundError') {
        console.log('Lesson not found during completion - clearing cache');
        await LessonCache.clear();
        await LessonCache.removeLessonsList();
        navigation.goBack();
        Alert.alert(
          'Content Updated',
          'This lesson has been updated. Please select it again to view the latest version.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  const handleSubmitQuiz = async () => {
    if (!selectedOption || !lessonData?.lesson.quiz) return;

    // Provide immediate feedback using client-side validation
    const isCorrect = selectedOption === lessonData.lesson.quiz.correctAnswer;
    const immediateResponse: SubmitQuizResponse = {
      isCorrect,
      explanation: lessonData.lesson.quiz.explanation,
      attemptNumber: 1,
      correctAnswer: lessonData.lesson.quiz.correctAnswer,
      quizResponse: {
        id: 'pending',
        userId: 'current-user',
        quizId: lessonData.lesson.quiz.id,
        selectedAnswer: selectedOption,
        isCorrect,
        attemptNumber: 1,
        respondedAt: new Date(),
      },
    };

    // Show feedback immediately
    setQuizFeedback(immediateResponse);
    setIsQuizSubmitted(true);

    // Track quiz answered
    amplitudeService.trackQuizAnswered(
      lessonData.lesson.id,
      lessonData.lesson.quiz.id,
      isCorrect,
      1,
      {
        lessonModule: lessonData.lesson.module,
        lessonTitle: lessonData.lesson.title,
        dayNumber: lessonData.lesson.dayNumber,
        selectedAnswer: selectedOption,
        correctAnswer: lessonData.lesson.quiz.correctAnswer,
      }
    );

    // Submit to API in background
    try {
      await lessonService.submitQuizAnswer(
        lessonData.lesson.quiz.id,
        selectedOption
      );
    } catch (error) {
      console.error('Failed to submit quiz to server:', error);
      // Don't show error to user since they already got immediate feedback
    }
  };

  const handleSubmitTextInput = async () => {
    if (!lessonData || !userTextInput.trim()) return;

    const segments = lessonData.lesson.segments || [];
    const currentSegment = segments[currentSegmentIndex];

    if (!currentSegment || currentSegment.contentType !== 'TEXT_INPUT') return;

    setIsTextInputSubmitting(true);

    try {
      const response = await lessonService.submitTextInputResponse(
        currentSegment.id,
        userTextInput.trim()
      );

      setTextInputFeedback(response);
      setIsTextInputSubmitted(true);

      // Track text input submission
      amplitudeService.trackEvent('Text Input Submitted', {
        lessonId: lessonData.lesson.id,
        segmentId: currentSegment.id,
        isCorrect: response.isCorrect,
        score: response.score,
        attemptNumber: response.attemptNumber,
      });
    } catch (error) {
      console.error('Failed to submit text input:', error);
      Alert.alert('Error', 'Failed to evaluate your response. Please try again.');
    } finally {
      setIsTextInputSubmitting(false);
    }
  };

  const handleContinue = async () => {
    console.log('handleContinue called');
    if (!lessonData) {
      console.log('No lesson data, returning');
      return;
    }

    const segments = lessonData.lesson.segments || [];
    const isOnQuiz = currentSegmentIndex === segments.length;
    console.log('handleContinue:', { currentSegmentIndex, totalSegments: segments.length, isOnQuiz });

    // If on quiz and submitted, complete the lesson
    if (isOnQuiz && isQuizSubmitted) {
      console.log('On quiz and submitted, completing lesson');
      // Lesson complete, navigate to Record screen
      // Save final progress to server before navigating away
      await completeLesson();

      // DON'T invalidate cache - keep it so user can review completed lesson instantly
      // Cache will be cleaned up when app opens and lesson is completed

      navigation.navigate('MainTabs', { screen: 'Home' });
      return;
    }

    // If on quiz but not submitted, need to submit first
    if (isOnQuiz && !isQuizSubmitted) {
      console.log('On quiz but not submitted, submitting first');
      await handleSubmitQuiz();
      return;
    }

    // Check if current segment is TEXT_INPUT and not yet submitted
    const currentSegment = segments[currentSegmentIndex];
    const isOnTextInput = currentSegment?.contentType === 'TEXT_INPUT';

    if (isOnTextInput && !isTextInputSubmitted) {
      console.log('On text input but not submitted, submitting first');
      await handleSubmitTextInput();
      return;
    }

    // Move to next segment or quiz
    if (currentSegmentIndex < segments.length - 1) {
      // Move to next content segment
      const nextIndex = currentSegmentIndex + 1;
      console.log('Moving to next segment:', nextIndex);
      // Update UI immediately, save progress in background
      setCurrentSegmentIndex(nextIndex);
      updateProgress(nextIndex);

      // Reset text input state for next segment
      setUserTextInput('');
      setIsTextInputSubmitted(false);
      setTextInputFeedback(null);

      // Track segment viewed
      amplitudeService.trackLessonSegmentViewed(
        lessonData.lesson.id,
        nextIndex + 1, // 1-indexed for readability
        {
          lessonTitle: lessonData.lesson.title,
          lessonModule: lessonData.lesson.module,
          dayNumber: lessonData.lesson.dayNumber,
          totalSegments: segments.length,
        }
      );
    } else if (lessonData.lesson.quiz) {
      // Move to quiz (last segment)
      console.log('Moving to quiz');
      // Update UI immediately, save progress in background
      setCurrentSegmentIndex(segments.length);
      updateProgress(currentSegmentIndex + 1);
    } else {
      // No quiz, lesson complete
      console.log('Lesson complete, no quiz');
      await completeLesson();
      navigation.navigate('MainTabs', { screen: 'Home' });
    }
  };

  // Update ref with latest function
  handleContinueRef.current = handleContinue;

  const handleClose = () => {
    // Save progress to server before closing
    updateProgress(currentSegmentIndex, true);
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
      // Reset text input state when navigating
      setUserTextInput('');
      setIsTextInputSubmitted(false);
      setTextInputFeedback(null);
    } else {
      // First segment, close the lesson
      handleClose();
    }
  };

  // Update ref with latest function
  handleBackRef.current = handleBack;

  const handleShare = async () => {
    if (!lessonData) return;

    const { lesson } = lessonData;

    // Generate shareable web link
    // TODO: Update this URL to your production domain when deploying
    const webUrl = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:3001';
    const shareUrl = `${webUrl}/share-lesson.html?lesson_id=${lesson.id}`;

    try {
      await Share.share({
        message: `Check out this parenting lesson: ${lesson.title}\n\n${shareUrl}`,
        title: lesson.title,
        url: shareUrl, // iOS will use this
      });
    } catch (error) {
      console.error('Error sharing lesson:', error);
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

  // Check if current segment is TEXT_INPUT
  const isTextInputSegment = currentSegment?.contentType === 'TEXT_INPUT';

  // Determine button text
  let buttonText = 'Continue →';
  if (isOnQuiz) {
    buttonText = isQuizSubmitted ? 'Continue →' : 'Check Answer';
  } else if (isTextInputSegment) {
    buttonText = isTextInputSubmitted ? 'Continue →' : 'Check Answer';
  } else if (currentSegmentIndex === segments.length - 1 && lesson.quiz) {
    buttonText = 'Take Quiz →';
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header with Close Button and Progress Bar */}
      <View style={styles.header}>
        {/* Close Button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          accessibilityLabel="Close lesson"
        >
          <Text style={styles.closeIcon}>×</Text>
        </TouchableOpacity>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <ProgressBar
            totalSegments={totalSegments}
            currentSegment={currentSegmentIndex + 1}
          />
        </View>
      </View>

      {/* Scrollable Content */}
      <View style={{ flex: 1 }}>
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
            {/* <Text style={styles.phaseBadge}>{lesson.phase}</Text> */}

            {/* Lesson Content Card */}
            <LessonContentCard
              backgroundColor={lesson.backgroundColor || '#F8F8FF'}
              ellipseColor={lesson.ellipse77Color || COLORS.mainPurple}
              onShare={handleShare}
              title={lesson.title}
            >
              {/* Section Title (if present) */}
              {currentSegment?.sectionTitle && (
                <Text style={styles.sectionTitle}>{currentSegment.sectionTitle}</Text>
              )}

              {/* Body Text */}
              <View style={styles.bodyTextContainer}>
                {formatBodyText(currentSegment?.bodyText || '', keywords, setSelectedKeyword, setShowKeywordModal)}
              </View>

              {/* Text Input Field (for TEXT_INPUT segments) */}
              {isTextInputSegment && (
                <View style={styles.textInputContainer}>
                  <Text style={styles.textInputLabel}>Your response:</Text>
                  <TextInput
                    style={[
                      styles.textInputField,
                      isTextInputSubmitted && styles.textInputFieldDisabled,
                    ]}
                    multiline
                    numberOfLines={4}
                    placeholder="Type your answer here..."
                    placeholderTextColor={COLORS.textSecondary}
                    value={userTextInput}
                    onChangeText={setUserTextInput}
                    editable={!isTextInputSubmitted && !isTextInputSubmitting}
                    textAlignVertical="top"
                  />
                  {isTextInputSubmitting && (
                    <View style={styles.textInputLoadingOverlay}>
                      <ActivityIndicator color={COLORS.mainPurple} />
                      <Text style={styles.textInputLoadingText}>Evaluating...</Text>
                    </View>
                  )}
                </View>
              )}

            </LessonContentCard>

            {/* Text Input Feedback - outside card for better scrolling */}
            {isTextInputSegment && textInputFeedback && (
              <TextInputFeedbackCard
                isCorrect={textInputFeedback.isCorrect}
                score={textInputFeedback.score}
                feedback={textInputFeedback.feedback}
                suggestions={textInputFeedback.suggestions}
                idealAnswer={textInputFeedback.idealAnswer}
              />
            )}

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
      </View>

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
              disabled={
                (isOnQuiz && !isQuizSubmitted && !selectedOption) ||
                (isTextInputSegment && !isTextInputSubmitted && !userTextInput.trim()) ||
                isTextInputSubmitting
              }
            >
              {buttonText}
            </Button>
          </View>
        </View>
      </View>

      {/* Phase Celebration Modal */}
      <PhaseCelebrationModal
        visible={showPhaseCelebration}
        onClose={() => {
          setShowPhaseCelebration(false);
          // Navigate back to home to see new lessons
          navigation.replace('MainTabs', { screen: 'Home' });
        }}
      />

      {/* Keyword Definition Modal */}
      <KeywordDefinitionModal
        visible={showKeywordModal}
        keyword={selectedKeyword}
        onClose={() => {
          setShowKeywordModal(false);
          setSelectedKeyword(null);
        }}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
    gap: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarContainer: {
    flex: 1,
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
    paddingHorizontal: 18,
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
    fontSize: 24,
    lineHeight: 24,
    letterSpacing: -0.2,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.2,
    color: COLORS.textDark,
    textAlign: 'left',
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    lineHeight: 32,
    color: COLORS.textDark,
    marginBottom: 16,
    marginTop:-20
  },
  bodyText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    lineHeight: 24,
    color: COLORS.textDark,
    textAlign: 'left',
    marginBottom: 32,
  },
  bodyTextContainer: {
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
  // Text Input Styles
  textInputContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  textInputLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 12,
  },
  textInputField: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textDark,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: COLORS.mainPurple,
    borderRadius: 16,
    padding: 16,
    minHeight: 120,
  },
  textInputFieldDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
  },
  textInputLoadingOverlay: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInputLoadingText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.mainPurple,
    marginTop: 8,
  },
});
