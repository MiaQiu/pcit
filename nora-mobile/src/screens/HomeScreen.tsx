/**
 * Home Screen
 * Main home/learn screen with lesson cards
 */

import React, { useState, useEffect } from 'react';
import { View, ScrollView, ActivityIndicator, Text, RefreshControl, StyleSheet, TouchableOpacity, Alert } from 'react-native';
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
  const [failedRecordings, setFailedRecordings] = useState<any[]>([]);

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
    loadStreakData();
    loadLatestReport();
    loadTodayState();
  }, []);

  // Reload state when screen comes into focus (after completing lesson/recording/reading report)
  // useFocusEffect is more reliable for tab navigation than addListener
  useFocusEffect(
    React.useCallback(() => {
      // Reload lessons, today's state and streak when tab comes into focus
      // This ensures NextActionCard shows the correct lesson (not stale cached data)
      // Note: loadLatestReport() is NOT called here to avoid unnecessary API calls
      // Latest report is cached and only refreshed when:
      // 1. Initial mount (useEffect on line 106)
      // 2. New report completes (uploadProcessing.reportCompletedTimestamp watcher)
      // 3. Manual pull-to-refresh
      loadLessons(false); // Refresh lessons without showing loading spinner
      loadTodayState();
      loadStreakData();
    }, [])
  );

  // Watch for report completion and refresh data automatically
  useEffect(() => {
    if (uploadProcessing.reportCompletedTimestamp) {
      console.log('[HomeScreen] New report completed, refreshing data...');
      // Refresh all data to show the new report and updated score
      loadTodayState();
      loadStreakData();
      loadLatestReport();
    }
  }, [uploadProcessing.reportCompletedTimestamp]);

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

  const loadStreakData = async () => {
    try {
      // Fetch recordings and lessons in parallel
      const [recordingsResponse, lessonsResponse] = await Promise.all([
        recordingService.getRecordings(),
        lessonService.getLessons()
      ]);
      handleApiSuccess(); // Mark server as up

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
   * Get an array of booleans representing which days this week (Mon-Sun) had a recording completed
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

    // Check each day of the week (Mon-Sun)
    const weekDays: boolean[] = [];
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(monday);
      checkDate.setDate(monday.getDate() + i);
      const dateStr = checkDate.toDateString();

      // Day is completed if it has a recording
      const hasRecording = recordingDateStrings.has(dateStr);
      weekDays.push(hasRecording);
    }

    return weekDays;
  };

  const loadLatestReport = async () => {
    try {
      const { recordings } = await recordingService.getRecordings();
      handleApiSuccess(); // Mark server as up

      if (recordings.length > 0) {
        // Sort recordings by most recent first
        const sortedRecordings = recordings.sort(
          (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Loop through recordings until we find one with a successful analysis
        for (const recording of sortedRecordings) {
          try {
            const analysis = await recordingService.getAnalysis(recording.id);
            handleApiSuccess(); // Mark server as up
            if (analysis && analysis.noraScore !== undefined) {
              setLatestScore({
                score: Math.round(analysis.noraScore),
                maxScore: 100,
                recordingId: recording.id,
              });

              // Set encouragement message if available
              if (analysis.encouragement) {
                setEncouragementMessage(analysis.encouragement);
              }

              // Found a successful analysis, stop looking
              return;
            }
          } catch (err) {
            // This recording doesn't have analysis yet or failed, try the next one
            console.log(`Could not load analysis for recording ${recording.id}:`, err);
            continue;
          }
        }

        // If we get here, none of the recordings have a successful analysis
        console.log('No recordings with completed analysis found');
      }
    } catch (error) {
      console.log('Failed to load latest report:', error);
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
      const { lessons } = await lessonService.getLessons();
      handleApiSuccess(); // Mark server as up
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

      // Mark user as experienced if they completed a lesson (proactive caching)
      if (lessons.some((lesson: any) => lesson.progress?.status === 'COMPLETED')) {
        markAsExperiencedUser();
      }

      // Check if recorded session today
      const { recordings } = await recordingService.getRecordings();
      handleApiSuccess(); // Mark server as up

      // Mark user as experienced if they have recordings (proactive caching)
      if (recordings.length > 0) {
        markAsExperiencedUser();
      }

      // Check for permanently failed recordings
      const failed = recordings.filter((r: any) => r.analysisStatus === 'FAILED' && r.permanentFailure === true);
      setFailedRecordings(failed);

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

      // Refresh streak and latest report when manually refreshing (pull-to-refresh)
      if (!showLoadingSpinner) {
        loadStreakData();
        loadLatestReport();
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
      navigation.push('Report', { recordingId: latestScore.recordingId });
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

  const handleDeleteRecording = async (recordingId: string) => {
    const { Alert } = require('react-native');
    Alert.alert(
      'Delete Recording',
      'Are you sure you want to delete this failed recording?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await recordingService.deleteRecording(recordingId);
              handleApiSuccess(); // Mark server as up
              // Refresh the recordings list
              await loadTodayState();
            } catch (error) {
              console.error('Failed to delete recording:', error);
              Alert.alert('Error', 'Failed to delete recording. Please try again.');
            }
          }
        }
      ]
    );
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

          // DEBUG: Log lesson data to understand the issue
          console.log('[HomeScreen] All lessons:', lessons.map(l => ({
            id: l.id,
            title: l.title,
            isLocked: l.isLocked,
            status: l.progress?.status,
            completedAt: l.progress?.completedAt
          })));
          console.log('[HomeScreen] Selected lesson:', {
            id: displayLesson.id,
            title: displayLesson.title,
            isLocked: displayLesson.isLocked,
            status: displayLesson.progress?.status
          });

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
                onReadReport={latestScore ? handleReadLatestReport : undefined}
                // Network status
                isOnline={isOnline}
              />
            </View>
          );
        })()}

        {/* Failed Recordings Section */}
        {failedRecordings.length > 0 && failedRecordings.map((recording) => (
          <View key={recording.id} style={styles.failedCard}>
            <View style={styles.failedHeader}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.failedTitle}>Processing Failed</Text>
            </View>

            <Text style={styles.failedDate}>
              {new Date(recording.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}
            </Text>

            <Text style={styles.apologyText}>
              We apologize for the inconvenience. Our team has been automatically
              notified and will investigate this issue.
            </Text>

            {recording.retryCount > 0 && (
              <Text style={styles.retryInfo}>
                Attempted {recording.retryCount + 1} time(s)
              </Text>
            )}

            <TouchableOpacity
              style={[styles.deleteButton, !isOnline && styles.deleteButtonDisabled]}
              onPress={() => handleDeleteRecording(recording.id)}
              disabled={!isOnline}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        ))}
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
  failedCard: {
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    marginBottom: 12,
    marginHorizontal: 20,
  },
  failedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  failedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
    fontFamily: FONTS.semiBold,
  },
  failedDate: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    fontFamily: FONTS.regular,
  },
  apologyText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
    fontFamily: FONTS.regular,
  },
  retryInfo: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
    fontFamily: FONTS.regular,
  },
  deleteButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  deleteButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
  },
});
