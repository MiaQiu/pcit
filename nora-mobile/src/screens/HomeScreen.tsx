/**
 * Home Screen
 * Main home/learn screen with lesson cards
 */

import React, { useState, useEffect } from 'react';
import { View, ScrollView, ActivityIndicator, Text, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LessonCard } from '../components/LessonCard';
import { LessonCardProps } from '../components/LessonCard'; // Import type for lesson data
import { NextActionCard } from '../components/NextActionCard';
import { StreakWidget } from '../components/StreakWidget';
import { ProfileCircle } from '../components/ProfileCircle';
import { DRAGON_PURPLE, FONTS, COLORS } from '../constants/assets';
import { RootStackNavigationProp } from '../navigation/types';
import { useLessonService, useAuthService, useRecordingService } from '../contexts/AppContext';
import { MOCK_HOME_LESSONS } from '../data/mockLessons';
import { LessonCache } from '../lib/LessonCache';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const lessonService = useLessonService();
  const authService = useAuthService();
  const recordingService = useRecordingService();

  const [lessons, setLessons] = useState<LessonCardProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>();
  const [relationshipToChild, setRelationshipToChild] = useState<'MOTHER' | 'FATHER' | 'GRANDMOTHER' | 'GRANDFATHER' | 'GUARDIAN' | 'OTHER' | undefined>();
  const [currentStreak, setCurrentStreak] = useState(0);
  const [completedDaysThisWeek, setCompletedDaysThisWeek] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const [yesterdayScore, setYesterdayScore] = useState<{ score: number; maxScore: number; recordingId: string } | null>(null);
  const [encouragementMessage, setEncouragementMessage] = useState<string>('You\'re so close! Don\'t give up!');

  // State tracking for card display logic (L / S / R)
  const [isLessonCompleted, setIsLessonCompleted] = useState(false);
  const [hasRecordedSession, setHasRecordedSession] = useState(false);
  const [isReportRead, setIsReportRead] = useState(false);
  const [todayLessonId, setTodayLessonId] = useState<string | null>(null);
  const [latestRecordingId, setLatestRecordingId] = useState<string | null>(null);
  const [hasAnyRecordingsEver, setHasAnyRecordingsEver] = useState(false);

  useEffect(() => {
    // Clean up completed lessons from cache on app open
    LessonCache.cleanupCompletedLessons();

    loadLessons();
    loadUserProfile();
    loadStreakData();
    loadYesterdayReport();
    loadTodayState();
  }, []);

  // Reload state when screen comes into focus (after completing lesson/recording/reading report)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadTodayState();
      loadStreakData();
    });

    return unsubscribe;
  }, [navigation]);

  const loadUserProfile = async () => {
    try {
      // Only try to load profile if user is authenticated
      if (!authService.isAuthenticated()) {
        return;
      }

      const user = await authService.getCurrentUser();
      setProfileImageUrl(user.profileImageUrl);
      setRelationshipToChild(user.relationshipToChild);
    } catch (error) {
      // Silently fail - user profile is optional for HomeScreen
      console.log('Could not load user profile:', error);
    }
  };

  const loadStreakData = async () => {
    try {
      // Fetch recordings and lessons in parallel
      const [recordingsResponse, lessonsResponse] = await Promise.all([
        recordingService.getRecordings().catch(() => ({ recordings: [] })),
        lessonService.getLessons().catch(() => ({ lessons: [], userProgress: {} }))
      ]);

      const { recordings } = recordingsResponse;
      const { lessons } = lessonsResponse;

      // Extract completed lesson dates
      const completedLessons = lessons.filter(l => l.progress?.status === 'COMPLETED');
      const lessonCompletionDates = completedLessons
        .map(l => l.progress?.completedAt ? new Date(l.progress.completedAt) : null)
        .filter((date): date is Date => date !== null && !isNaN(date.getTime()));

      // Calculate streak
      const streak = calculateCombinedStreak(recordings, lessonCompletionDates);
      setCurrentStreak(streak);

      // Calculate which days this week were completed
      const thisWeekCompleted = getCompletedDaysThisWeek(recordings, lessonCompletionDates);
      setCompletedDaysThisWeek(thisWeekCompleted);
    } catch (error) {
      console.log('Failed to load streak data:', error);
    }
  };

  /**
   * Get an array of booleans representing which days this week (Mon-Sun) had both a lesson and recording completed
   */
  const getCompletedDaysThisWeek = (recordings: any[], lessonCompletionDates: Date[]): boolean[] => {
    // Get start of current week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days; otherwise go back to Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    // Get unique recording dates
    const recordingDateStrings = new Set(
      recordings
        .map((r) => new Date(r.createdAt))
        .filter((date) => !isNaN(date.getTime()))
        .map((date) => date.toDateString())
    );

    // Get unique lesson completion dates
    const lessonDateStrings = new Set(
      lessonCompletionDates.map((date) => date.toDateString())
    );

    // Check each day of the week (Mon-Sun)
    const weekDays: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(monday);
      checkDate.setDate(monday.getDate() + i);
      const dateStr = checkDate.toDateString();

      // Day is completed if it has BOTH a recording AND a completed lesson
      const hasRecording = recordingDateStrings.has(dateStr);
      const hasLesson = lessonDateStrings.has(dateStr);
      weekDays.push(hasRecording && hasLesson);
    }

    return weekDays;
  };

  const loadYesterdayReport = async () => {
    try {
      // Get recordings from yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const tomorrow = new Date(yesterday);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { recordings } = await recordingService.getRecordings().catch(() => ({ recordings: [] }));

      // Find yesterday's recordings
      const yesterdayRecordings = recordings.filter((r: any) => {
        const recordingDate = new Date(r.createdAt);
        return recordingDate >= yesterday && recordingDate < tomorrow;
      });

      if (yesterdayRecordings.length > 0) {
        // Get the most recent recording from yesterday
        const latestRecording = yesterdayRecordings.sort(
          (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];

        // Try to get the analysis for this recording
        try {
          const analysis = await recordingService.getAnalysis(latestRecording.id);
          if (analysis && analysis.noraScore !== undefined) {
            setYesterdayScore({
              score: Math.round(analysis.noraScore),
              maxScore: 30,
              recordingId: latestRecording.id,
            });

            // Set encouragement message if available
            if (analysis.encouragement) {
              setEncouragementMessage(analysis.encouragement);
            }
          }
        } catch (err) {
          // Analysis might not be ready yet, that's okay
          console.log('Could not load yesterday\'s analysis:', err);
        }
      }
    } catch (error) {
      console.log('Failed to load yesterday\'s report:', error);
    }
  };

  /**
   * Calculate streak based on consecutive days with BOTH a completed lesson AND a recording
   */
  const calculateCombinedStreak = (recordings: any[], lessonCompletionDates: Date[]): number => {
    if (recordings.length === 0 || lessonCompletionDates.length === 0) return 0;

    // Get unique recording dates
    const recordingDateStrings = new Set(
      recordings
        .map((r) => new Date(r.createdAt))
        .filter((date) => !isNaN(date.getTime()))
        .map((date) => date.toDateString())
    );

    // Get unique lesson completion dates
    const lessonDateStrings = new Set(
      lessonCompletionDates.map((date) => date.toDateString())
    );

    // Find days that have BOTH a recording AND a completed lesson
    const completeDays = Array.from(recordingDateStrings)
      .filter((dateStr) => lessonDateStrings.has(dateStr))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    if (completeDays.length === 0) return 0;

    let streak = 0;
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    // Streak must start from today or yesterday
    if (completeDays[0] === today || completeDays[0] === yesterday) {
      streak = 1;
      let currentDate = new Date(completeDays[0]);

      // Count consecutive days backwards
      for (let i = 1; i < completeDays.length; i++) {
        const expectedDate = new Date(currentDate.getTime() - 86400000).toDateString();
        if (completeDays[i] === expectedDate) {
          streak++;
          currentDate = new Date(completeDays[i]);
        } else {
          break;
        }
      }
    }

    return streak;
  };

  /**
   * Load today's state (L/S/R) to determine which card to show
   */
  const loadTodayState = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Check if lesson completed today
      const { lessons } = await lessonService.getLessons().catch(() => ({ lessons: [], userProgress: {} }));
      const todayCompletedLesson = lessons.find((lesson: any) => {
        if (lesson.progress?.status === 'COMPLETED' && lesson.progress?.completedAt) {
          const completedDate = new Date(lesson.progress.completedAt);
          return completedDate >= today && completedDate < tomorrow;
        }
        return false;
      });

      const lessonCompleted = !!todayCompletedLesson;
      setIsLessonCompleted(lessonCompleted);
      if (todayCompletedLesson) {
        setTodayLessonId(todayCompletedLesson.id);
      }

      // Check if recorded session today
      const { recordings } = await recordingService.getRecordings().catch(() => ({ recordings: [] }));

      // Check if user has ANY recordings ever (for showing LessonCard vs NextActionCard)
      setHasAnyRecordingsEver(recordings.length > 0);

      const todayRecordings = recordings.filter((r: any) => {
        const recordingDate = new Date(r.createdAt);
        return recordingDate >= today && recordingDate < tomorrow;
      });

      const hasRecording = todayRecordings.length > 0;
      setHasRecordedSession(hasRecording);
      if (hasRecording) {
        // Get the most recent recording
        const latestRecording = todayRecordings.sort(
          (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        setLatestRecordingId(latestRecording.id);
      }

      // Check if report was read today (using AsyncStorage or similar)
      // For now, we'll check if the user has viewed the report screen today
      // This could be tracked via AsyncStorage
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const reportReadKey = `report_read_${today.toDateString()}`;
      const reportReadValue = await AsyncStorage.getItem(reportReadKey);
      setIsReportRead(reportReadValue === 'true');

    } catch (error) {
      console.log('Failed to load today\'s state:', error);
    }
  };

  /**
   * Determine which card type to show based on L/S/R state
   * Returns: 'lesson' | 'record' | 'readReport' | 'recordAgain'
   */
  const getCardType = (): 'lesson' | 'record' | 'readReport' | 'recordAgain' => {
    // State 1: L=F, S=F, R=F → Show Lesson
    if (!isLessonCompleted && !hasRecordedSession && !isReportRead) {
      return 'lesson';
    }

    // State 2: L=T, S=F, R=F → Show Record Session
    if (isLessonCompleted && !hasRecordedSession && !isReportRead) {
      return 'record';
    }

    // State 3 & 5: L=T, S=T, R=F → Show Read Report
    if (isLessonCompleted && hasRecordedSession && !isReportRead) {
      return 'readReport';
    }

    // State 4 & 6: L=T, S=T, R=T → Show Record Again
    if (isLessonCompleted && hasRecordedSession && isReportRead) {
      return 'recordAgain';
    }

    // Default to lesson
    return 'lesson';
  };

  // Prefetch and cache today's and next day's lessons
  useEffect(() => {
    if (lessons.length > 0) {
      const unlockedLessons = lessons.filter(l => !l.isLocked);

      // Get the first 2 unlocked lessons (today + next)
      // This ensures we always cache the next incomplete lesson
      const lessonsToCache = unlockedLessons.slice(0, 2);

      // Prefetch and cache in background
      lessonsToCache.forEach((lesson, index) => {
        lessonService.getLessonDetail(lesson.id)
          .then(data => LessonCache.set(lesson.id, data))
          .catch(err => {
            console.log(`Prefetch failed for lesson ${index + 1}:`, err);
          });
      });
    }
  }, [lessons]);

  const loadLessons = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      // Try to load from cache first for instant display
      const cachedLessons = await LessonCache.getLessonsList();
      if (cachedLessons && cachedLessons.length > 0) {
        console.log('⚡ Displaying cached lessons list');
        setLessons(cachedLessons);
        setLoading(false);
      }

      // Fetch fresh data from API
      const response = await lessonService.getLessons();

      // Extract lessons array from response
      const apiLessons = response.lessons || [];

      // If API returns empty, use mock data for development
      if (apiLessons.length === 0) {
        console.log('No lessons in database, using mock data for development');
        if (lessons.length === 0) {
          setLessons(MOCK_HOME_LESSONS);
        }
        return;
      }

      // Map API lessons to LessonCardProps
      const mappedLessons: LessonCardProps[] = apiLessons.map((lesson) => ({
        id: lesson.id,
        phase: 'PHASE',
        phaseName: lesson.phase,
        title: lesson.title,
        subtitle: lesson.subtitle || '',
        description: lesson.description,
        // Use dino image for Discipline phase, dragon for others
        dragonImageUrl: lesson.phase === 'DISCIPLINE'
          ? require('../../assets/images/dino_image2.png')
          : (lesson.dragonImageUrl || DRAGON_PURPLE),
        // Remove backgroundColor, ellipse colors - let LessonCard determine based on phase
        isLocked: lesson.isLocked,
      }));

      setLessons(mappedLessons);

      // Cache the lessons list for next time
      await LessonCache.setLessonsList(mappedLessons);

      // Refresh streak data when lessons are refreshed (in case a lesson was just completed)
      if (!showLoadingSpinner) {
        loadStreakData();
      }
    } catch (err) {
      console.error('Failed to load lessons:', err);

      // Only show error if we don't have any lessons to display
      if (lessons.length === 0) {
        setError('Failed to load lessons. Using offline data.');
        setLessons(MOCK_HOME_LESSONS);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleLessonPress = (lessonId: string) => {
    navigation.push('LessonViewer', {
      lessonId,
    });
    // Note: isLessonCompleted will be updated when we return from LessonViewer
    // via the loadTodayState function in useEffect with focus listener
  };

  const handleProfilePress = () => {
    navigation.push('Profile');
  };

  const handleReadYesterdayReport = () => {
    if (yesterdayScore?.recordingId) {
      navigation.push('Report', { recordingId: yesterdayScore.recordingId });
    }
  };

  const handleRecordSession = () => {
    // Navigate to recording tab
    navigation.navigate('MainTabs', { screen: 'Record' });
    // Note: hasRecordedSession will be updated when we return from Record screen
  };

  const handleReadTodayReport = async () => {
    if (latestRecordingId) {
      // Mark report as read
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const reportReadKey = `report_read_${today.toDateString()}`;
      await AsyncStorage.setItem(reportReadKey, 'true');
      setIsReportRead(true);

      // Navigate to report
      navigation.push('Report', { recordingId: latestRecordingId });
    }
  };

  const handleRecordAgain = async () => {
    // Reset report read state (since we're recording again, we'll have a new report to read)
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reportReadKey = `report_read_${today.toDateString()}`;
    await AsyncStorage.setItem(reportReadKey, 'false');
    setIsReportRead(false);

    // Navigate to recording tab
    navigation.navigate('MainTabs', { screen: 'Record' });
  };

  const handleNextAction = () => {
    const cardType = getCardType();

    switch (cardType) {
      case 'lesson':
        // Find the first unlocked lesson
        const todayLesson = lessons.find(l => !l.isLocked);
        if (todayLesson) {
          handleLessonPress(todayLesson.id);
        }
        break;
      case 'record':
        handleRecordSession();
        break;
      case 'readReport':
        handleReadTodayReport();
        break;
      case 'recordAgain':
        handleRecordAgain();
        break;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8C49D5" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadLessons(false)}
            tintColor="#8C49D5"
          />
        }
      >
        {/* Error Message */}
        {error && (
          <View className="mb-4 p-4 bg-yellow-100 rounded-lg">
            <Text className="text-sm text-yellow-800">{error}</Text>
          </View>
        )}

        {/* Profile Circle and Streak Widget */}
        <View style={styles.streakContainer}>
          <ProfileCircle
            size={60}
            imageUrl={profileImageUrl}
            relationshipToChild={relationshipToChild}
            onPress={handleProfilePress}
          />
          <StreakWidget
            streak={currentStreak}
            completedDays={completedDaysThisWeek}
          />
        </View>

        {/* Today's Deck Heading */}
        {/* {lessons.length > 0 && (
          <Text style={styles.heading}>Today's deck</Text>
        )} */}

        {/* Show LessonCard for new users with no recordings, NextActionCard for experienced users */}
        {lessons.length > 0 && (() => {
          // Find the first unlocked lesson
          const todayLesson = lessons.find(l => !l.isLocked);
          const displayLesson = todayLesson || lessons[0];

          // If user has no recordings ever, show simple LessonCard
          if (!hasAnyRecordingsEver) {
            return (
              <>
                {/* Connect Phase Card */}
                <View style={{ marginBottom: 16 }}>
                  <LessonCard
                    {...displayLesson}
                    onPress={() => handleLessonPress(displayLesson.id)}
                  />
                </View>

                {/* Discipline Phase Card (Locked) */}
                {(() => {
                  // Find the first Discipline phase lesson
                  const disciplineLesson = lessons.find(l => l.phaseName === 'DISCIPLINE');
                  if (disciplineLesson) {
                    return (
                      <View style={{ marginBottom: 8 }}>
                        <LessonCard
                          {...disciplineLesson}
                          isLocked={true}
                          onPress={() => {}} // No action when locked
                        />
                      </View>
                    );
                  }
                  return null;
                })()}
              </>
            );
          }

          // Otherwise, show NextActionCard with dynamic state
          const cardType = getCardType();

          return (
            <View style={{ marginBottom: 8 }}>
              <NextActionCard
                type={cardType}
                // Lesson-specific props (only used when type='lesson')
                phase={displayLesson.phase}
                phaseName={displayLesson.phaseName}
                title={displayLesson.title}
                description={displayLesson.description}
                // Action handler
                onPress={handleNextAction}
                // Yesterday's score section (optional)
                yesterdayScore={yesterdayScore || undefined}
                encouragementMessage={yesterdayScore ? encouragementMessage : undefined}
                onReadReport={yesterdayScore ? handleReadYesterdayReport : undefined}
              />
            </View>
          );
        })()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 16,
    marginLeft: 20,
  },
  heading: {
    fontFamily: FONTS.bold,
    fontSize: 25,
    lineHeight: 38,
    letterSpacing: -0.2,
    color: COLORS.textDark,
    marginBottom: 16,
    marginTop: 8,
    marginLeft: 20,
  },
});
