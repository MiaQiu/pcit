/**
 * Home Screen
 * Main home/learn screen with lesson cards
 */

import React, { useState, useEffect } from 'react';
import { View, ScrollView, ActivityIndicator, Text, RefreshControl, StyleSheet, TouchableOpacity, Alert, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LessonCard } from '../components/LessonCard';
import { LessonCardProps } from '../components/LessonCard'; // Import type for lesson data
import { NextActionCard } from '../components/NextActionCard';
import { StreakWidget } from '../components/StreakWidget';
import { ProfileCircle } from '../components/ProfileCircle';
import { DRAGON_PURPLE, FONTS, COLORS } from '../constants/assets';
import { RootStackNavigationProp } from '../navigation/types';
import { useLessonService, useAuthService, useRecordingService } from '../contexts/AppContext';
import { useUploadProcessing } from '../contexts/UploadProcessingContext';
import { LessonCache } from '../lib/LessonCache';
import { handleApiError, handleApiSuccess } from '../utils/NetworkMonitor';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useToast } from '../components/ToastManager';
import { toSingaporeDateString, getTodaySingapore, getYesterdaySingapore, getStartOfTodaySingapore, getEndOfTodaySingapore } from '../utils/timezone';
import amplitudeService from '../services/amplitudeService';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const lessonService = useLessonService();
  const authService = useAuthService();
  const recordingService = useRecordingService();
  const uploadProcessing = useUploadProcessing();
  const { isOnline } = useNetworkStatus();
  const { showToast } = useToast();

  const [lessons, setLessons] = useState<LessonCardProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | undefined>();
  const [relationshipToChild, setRelationshipToChild] = useState<'MOTHER' | 'FATHER' | 'GRANDMOTHER' | 'GRANDFATHER' | 'GUARDIAN' | 'OTHER' | undefined>();
  const [currentStreak, setCurrentStreak] = useState(0);
  const [completedDaysThisWeek, setCompletedDaysThisWeek] = useState<boolean[]>([false, false, false, false, false, false, false]);
  const [latestScore, setLatestScore] = useState<{ score: number; maxScore: number; recordingId: string } | null>(null);
  const [encouragementMessage, setEncouragementMessage] = useState<string>('');

  // State tracking for card display logic (L / S / R)
  const [isLessonCompleted, setIsLessonCompleted] = useState(false);
  const [hasRecordedSession, setHasRecordedSession] = useState(false);
  const [isReportRead, setIsReportRead] = useState(false);
  const [todayLessonId, setTodayLessonId] = useState<string | null>(null);
  const [latestRecordingId, setLatestRecordingId] = useState<string | null>(null);
  const [isExperiencedUser, setIsExperiencedUser] = useState(false);
  const [lastRefreshDate, setLastRefreshDate] = useState<string>(getTodaySingapore());

  /**
   * Check if user is experienced (has completed a lesson or made a recording)
   * Uses permanent AsyncStorage cache to avoid repeated API calls
   */
  const checkExperiencedUserStatus = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;

      // Check permanent cache first
      const cachedStatus = await AsyncStorage.getItem('isExperiencedUser');

      if (cachedStatus === 'true') {
        // Already marked as experienced, no need to check API
        setIsExperiencedUser(true);
        return;
      }

      // Not cached yet - do ONE-TIME check by fetching data
      const [recordingsResponse, lessonsResponse] = await Promise.all([
        recordingService.getRecordings().catch(() => ({ recordings: [] })),
        lessonService.getLessons().catch(() => ({ lessons: [] }))
      ]);

      const hasRecordings = recordingsResponse.recordings.length > 0;
      const hasCompletedLesson = lessonsResponse.lessons.some(
        (l: any) => l.progress?.status === 'COMPLETED'
      );

      if (hasRecordings || hasCompletedLesson) {
        // Mark as experienced and cache permanently
        await AsyncStorage.setItem('isExperiencedUser', 'true');
        setIsExperiencedUser(true);
      }
    } catch (error) {
      console.log('Failed to check experienced user status:', error);
    }
  };

  /**
   * Mark user as experienced and cache permanently
   * Call this when user completes first lesson or creates first recording
   */
  const markAsExperiencedUser = async () => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('isExperiencedUser', 'true');
      setIsExperiencedUser(true);
    } catch (error) {
      console.log('Failed to mark user as experienced:', error);
    }
  };

  useEffect(() => {
    // Clean up completed lessons from cache on app open
    LessonCache.cleanupCompletedLessons();

    checkExperiencedUserStatus();
    loadLessons();
    loadUserProfile();
    loadDashboardData();
  }, []);

  // Reload state when screen comes into focus (after completing lesson/recording/reading report)
  // useFocusEffect is more reliable for tab navigation than addListener
  useFocusEffect(
    React.useCallback(() => {
      // Track home screen viewed
      amplitudeService.trackScreenView('Home', {
        screen: 'home',
      });

      // Reload lessons and dashboard data when tab comes into focus
      // This ensures NextActionCard shows the correct lesson (not stale cached data)
      loadLessons(false); // Refresh lessons without showing loading spinner
      loadDashboardData();
    }, [])
  );

  // Watch for report completion and refresh data automatically
  useEffect(() => {
    if (uploadProcessing.reportCompletedTimestamp) {
      console.log('[HomeScreen] New report completed, refreshing data...');
      // Refresh all data to show the new report and updated score
      loadDashboardData();
    }
  }, [uploadProcessing.reportCompletedTimestamp]);

  // Listen for app coming to foreground and refresh if date changed
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        const today = getTodaySingapore();
        console.log('[HomeScreen] App came to foreground. Last refresh:', lastRefreshDate, 'Today:', today);

        if (today !== lastRefreshDate) {
          console.log('[HomeScreen] Date changed since last refresh - refreshing all data');
          setLastRefreshDate(today);
          loadLessons();
          loadDashboardData();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [lastRefreshDate]);

  const loadUserProfile = async () => {
    try {
      // Only try to load profile if user is authenticated
      if (!authService.isAuthenticated()) {
        return;
      }

      const user = await authService.getCurrentUser();
      handleApiSuccess(); // Mark server as up
      setProfileImageUrl(user.profileImageUrl);
      setRelationshipToChild(user.relationshipToChild);
    } catch (error) {
      // Show toast if offline
      if (!isOnline) {
        showToast('Unable to load profile while offline', 'error');
      }
      console.log('Could not load user profile:', error);
    }
  };

  /**
   * Load all dashboard data in a single optimized API call
   * Replaces separate calls to loadTodayState, loadStreakData, and loadLatestReport
   */
  const loadDashboardData = async () => {
    try {
      // Fetch dashboard data and lessons in parallel
      const [dashboardData, lessonsResponse] = await Promise.all([
        recordingService.getDashboard(),
        lessonService.getLessons()
      ]);
      handleApiSuccess(); // Mark server as up

      const { todayRecordings, thisWeekRecordings, latestWithReport } = dashboardData;
      const { lessons } = lessonsResponse;

      // === Lesson Completion (L) ===
      const today = getStartOfTodaySingapore();
      const tomorrow = getEndOfTodaySingapore();

      const todayCompletedLesson = lessons.find((lesson: any) => {
        if (lesson.progress?.status === 'COMPLETED' && lesson.progress?.completedAt) {
          const completedDate = new Date(lesson.progress.completedAt);
          return completedDate >= today && completedDate <= tomorrow;
        }
        return false;
      });

      const lessonCompleted = !!todayCompletedLesson;
      setIsLessonCompleted(lessonCompleted);
      if (todayCompletedLesson) {
        setTodayLessonId(todayCompletedLesson.id);
      }

      // Mark user as experienced if they completed a lesson (proactive caching)
      if (lessons.some((lesson: any) => lesson.progress?.status === 'COMPLETED')) {
        markAsExperiencedUser();
      }

      // === Today's Recording State (S/R) ===
      const hasRecording = todayRecordings.length > 0;
      setHasRecordedSession(hasRecording);

      // Mark user as experienced if they have recordings (proactive caching)
      if (todayRecordings.length > 0) {
        markAsExperiencedUser();
      }

      // Check if report was read today by comparing recording IDs
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const reportReadKey = `report_read_${getTodaySingapore()}`;
      const reportReadRecordingId = await AsyncStorage.getItem(reportReadKey);

      if (hasRecording) {
        // Get the most recent recording (recordings are already sorted by desc)
        const latestRecording = todayRecordings[0];
        setLatestRecordingId(latestRecording.id);

        // Report is read only if the stored recording ID matches the latest recording
        setIsReportRead(reportReadRecordingId === latestRecording.id);
      } else {
        // No recording today, report cannot be read
        setIsReportRead(false);
      }

      // === Streak Data ===
      // Extract completed lesson dates
      const completedLessons = lessons.filter(l => l.progress?.status === 'COMPLETED');
      const lessonCompletionDates = completedLessons
        .map(l => l.progress?.completedAt ? new Date(l.progress.completedAt) : null)
        .filter((date): date is Date => date !== null && !isNaN(date.getTime()));

      // Calculate streak using this week's recordings
      const streak = calculateCombinedStreak(thisWeekRecordings, lessonCompletionDates);
      setCurrentStreak(streak);

      // Calculate which days this week were completed
      const thisWeekCompleted = getCompletedDaysThisWeek(thisWeekRecordings, lessonCompletionDates);
      setCompletedDaysThisWeek(thisWeekCompleted);

      // === Latest Report ===
      if (latestWithReport && latestWithReport.overallScore !== undefined) {
        setLatestScore({
          score: Math.round(latestWithReport.overallScore),
          maxScore: 100,
          recordingId: latestWithReport.id,
        });

        // Try to fetch encouragement message from full analysis
        try {
          const analysis = await recordingService.getAnalysis(latestWithReport.id);
          if (analysis && analysis.encouragement) {
            setEncouragementMessage(analysis.encouragement);
          }
        } catch (err) {
          // Analysis might not be fully available yet
          console.log('Could not load encouragement message:', err);
        }
      }
    } catch (error) {
      console.log('Failed to load dashboard data:', error);
    }
  };

  /**
   * Get an array of booleans representing which days this week (Mon-Sun) had a recording completed
   * Uses Singapore timezone for date comparisons
   */
  const getCompletedDaysThisWeek = (recordings: any[], lessonCompletionDates: Date[]): boolean[] => {
    // Get start of current week (Monday) in Singapore timezone
    const nowSgt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const dayOfWeek = nowSgt.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondaySgt = new Date(nowSgt);
    mondaySgt.setUTCDate(nowSgt.getUTCDate() + mondayOffset);
    mondaySgt.setUTCHours(0, 0, 0, 0);

    // Get unique recording dates in Singapore timezone
    const recordingDateStrings = new Set(
      recordings
        .map((r) => new Date(r.createdAt))
        .filter((date) => !isNaN(date.getTime()))
        .map((date) => toSingaporeDateString(date))
    );

    // Check each day of the week (Mon-Sun)
    const weekDays: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(mondaySgt);
      checkDate.setUTCDate(mondaySgt.getUTCDate() + i);
      const dateStr = toSingaporeDateString(checkDate);

      // Day is completed if it has a recording
      const hasRecording = recordingDateStrings.has(dateStr);
      weekDays.push(hasRecording);
    }

    return weekDays;
  };

  /**
   * Calculate streak based on consecutive days with BOTH a completed lesson AND a recording
   * Uses Singapore timezone for date comparisons
   */
  const calculateCombinedStreak = (recordings: any[], lessonCompletionDates: Date[]): number => {
    if (recordings.length === 0 || lessonCompletionDates.length === 0) return 0;

    // Get unique recording dates in Singapore timezone
    const recordingDateStrings = new Set(
      recordings
        .map((r) => new Date(r.createdAt))
        .filter((date) => !isNaN(date.getTime()))
        .map((date) => toSingaporeDateString(date))
    );

    // Get unique lesson completion dates in Singapore timezone
    const lessonDateStrings = new Set(
      lessonCompletionDates.map((date) => toSingaporeDateString(date))
    );

    // Find days that have BOTH a recording AND a completed lesson
    const completeDays = Array.from(recordingDateStrings)
      .filter((dateStr) => lessonDateStrings.has(dateStr))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    if (completeDays.length === 0) return 0;

    let streak = 0;
    const today = getTodaySingapore();
    const yesterday = getYesterdaySingapore();

    // Streak must start from today or yesterday
    if (completeDays[0] === today || completeDays[0] === yesterday) {
      streak = 1;
      let currentDate = new Date(completeDays[0]);

      // Count consecutive days backwards
      for (let i = 1; i < completeDays.length; i++) {
        const expectedDate = toSingaporeDateString(currentDate.getTime() - 86400000);
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
   * Determine which card type to show based on L/S/R state
   * Complete state machine:
   * 1. L=F, S=F, R=F → Lesson Card
   * 2. L=T, S=F, R=F → Record Session
   * 3. L=T, S=T, R=F → Read Report
   * 4. L=T, S=T, R=T → Record Again
   * 5. L=T, S=T, R=F → Read Report (after recording again)
   * 6. L=F, S=T, R=F → Read Report (recorded without lesson)
   * 7. L=F, S=T, R=T → Lesson Card (force lesson before recording again)
   */
  const getCardType = (): 'lesson' | 'record' | 'readReport' | 'recordAgain' => {
    // State 7: L=F, S=T, R=T → Lesson Card (force lesson completion before recording again)
    if (!isLessonCompleted && hasRecordedSession && isReportRead) {
      return 'lesson';
    }

    // States 3, 5, 6: S=T, R=F → Read Report (regardless of L)
    if (hasRecordedSession && !isReportRead) {
      return 'readReport';
    }

    // State 4: L=T, S=T, R=T → Record Again
    if (isLessonCompleted && hasRecordedSession && isReportRead) {
      return 'recordAgain';
    }

    // State 2: L=T, S=F, R=F → Record Session
    if (isLessonCompleted && !hasRecordedSession) {
      return 'record';
    }

    // State 1: L=F, S=F, R=F → Lesson Card (default)
    return 'lesson';
  };

  // Prefetch and cache current lesson only
  useEffect(() => {
    if (lessons.length > 0) {
      // Get unlocked lessons that are not completed
      const unlockedLessons = lessons.filter(l => !l.isLocked && l.progress?.status !== 'COMPLETED');

      // Get only the current lesson (first unlocked and not completed)
      const currentLesson = unlockedLessons[0];

      // Prefetch and cache in background
      if (currentLesson) {
        lessonService.getLessonDetail(currentLesson.id)
          .then(data => LessonCache.set(currentLesson.id, data))
          .catch(err => {
            console.log('Prefetch failed for current lesson:', err);
          });
      }
    }
  }, [lessons]);

  const loadLessons = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      // Fetch fresh data from API
      const response = await lessonService.getLessons();
      handleApiSuccess(); // Mark server as up

      // Extract lessons array from response
      const apiLessons = response.lessons || [];

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
          ? require('../../assets/images/dino_phase2.webp')
          : (lesson.dragonImageUrl || DRAGON_PURPLE),
        // Remove backgroundColor, ellipse colors - let LessonCard determine based on phase
        isLocked: lesson.isLocked,
        progress: lesson.progress,
      }));

      setLessons(mappedLessons);

      // Update last refresh date
      setLastRefreshDate(getTodaySingapore());

      // Refresh dashboard data when manually refreshing (pull-to-refresh)
      if (!showLoadingSpinner) {
        loadDashboardData();
      }
    } catch (err) {
      console.error('Failed to load lessons:', err);
      const errorMessage = handleApiError(err);
      console.log('[HomeScreen] Error message:', errorMessage);
      console.log('[HomeScreen] Error details:', { code: err.code, message: err.message, status: err.status });
      // NetworkStatusBar already shows if it's a network issue
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleLessonPress = (lessonId: string) => {
    // Find lesson details for tracking
    const lesson = lessons.find(l => l.id === lessonId);
    if (lesson) {
      amplitudeService.trackLessonStarted(lesson.id, lesson.title, {
        source: 'home_screen',
        lessonPhase: lesson.phase,
        phaseName: lesson.phaseName,
        status: lesson.progress?.status || 'NOT_STARTED',
      });
    }

    navigation.push('LessonViewer', {
      lessonId,
    });
    // Note: isLessonCompleted will be updated when we return from LessonViewer
    // via the loadTodayState function in useEffect with focus listener
  };

  const handleProfilePress = () => {
    navigation.push('Profile');
  };

  const handleReadLatestReport = () => {
    if (latestScore?.recordingId) {
      // Track report viewed from last session card
      amplitudeService.trackReportViewed(
        latestScore.recordingId,
        latestScore.score,
        {
          source: 'home_last_session',
          maxScore: latestScore.maxScore,
        }
      );

      navigation.push('Report', { recordingId: latestScore.recordingId });
    }
  };

  const handleRecordSession = () => {
    // Navigate to recording tab
    navigation.navigate('MainTabs', { screen: 'Record' });
    // Note: hasRecordedSession will be updated when we return from Record screen
  };

  const handleReadTodayReport = async (source: 'next_action_button' | 'score_card_button' = 'next_action_button') => {
    if (latestRecordingId) {
      // Mark report as read by storing the recording ID (using Singapore timezone)
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const reportReadKey = `report_read_${getTodaySingapore()}`;
      await AsyncStorage.setItem(reportReadKey, latestRecordingId);
      setIsReportRead(true);

      // Track report viewed with specific source
      amplitudeService.trackReportViewed(
        latestRecordingId,
        latestScore?.score,
        {
          source: `home_${source}`,
          maxScore: latestScore?.maxScore,
        }
      );

      // Navigate to report
      navigation.push('Report', { recordingId: latestRecordingId });
    }
  };

  const handleRecordAgain = async () => {
    // Reset report read state (since we're recording again, we'll have a new report to read)
    // Use Singapore timezone
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const reportReadKey = `report_read_${getTodaySingapore()}`;
    await AsyncStorage.removeItem(reportReadKey);
    setIsReportRead(false);

    // Navigate to recording tab
    navigation.navigate('MainTabs', { screen: 'Record' });
  };

  const handleNextAction = () => {
    const cardType = getCardType();

    switch (cardType) {
      case 'lesson':
        // Find the first unlocked lesson that is not completed
        const todayLesson = lessons.find(l => !l.isLocked && l.progress?.status !== 'COMPLETED');
        if (todayLesson) {
          handleLessonPress(todayLesson.id);
        }
        break;
      case 'record':
        handleRecordSession();
        break;
      case 'readReport':
        handleReadTodayReport('next_action_button');
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
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 20, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadLessons(false)}
            enabled={isOnline}
            tintColor="#8C49D5"
          />
        }
      >
        {/* Profile Circle and Streak Widget - Only show for experienced users */}
        {isExperiencedUser && (
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
        )}

        {/* Today's Deck Heading */}
        {/* {lessons.length > 0 && (
          <Text style={styles.heading}>Today's deck</Text>
        )} */}

        {/* Show LessonCard for new users with no recordings/lessons, NextActionCard for experienced users */}
        {lessons.length > 0 && (() => {
          // Find the first unlocked lesson that is not completed
          const todayLesson = lessons.find(l => !l.isLocked && l.progress?.status !== 'COMPLETED');
          const displayLesson = todayLesson || lessons[0];

          // If user is not experienced (new user), show simple LessonCard
          if (!isExperiencedUser) {
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

          // Always show score section - use placeholder if no recording
          const displayScore = latestScore || { score: 0, maxScore: 100, recordingId: '' };

          // Check if report is being processed
          const displayEncouragement = uploadProcessing.isProcessing
            ? "Latest play session processing. We'll notify you when it's ready."
            : (encouragementMessage || "Complete a play session to see your score!");

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
                // Latest score section - always show
                yesterdayScore={displayScore}
                encouragementMessage={displayEncouragement}
                onReadReport={latestScore ? (cardType === 'readReport' ? () => handleReadTodayReport('score_card_button') : handleReadLatestReport) : undefined}
                // Network status
                isOnline={isOnline}
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
