/**
 * Home Screen
 * Main home/learn screen with lesson cards
 */

import React, { useState, useEffect } from 'react';
import { View, ScrollView, ActivityIndicator, Text, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LessonCard, LessonCardProps } from '../components/LessonCard';
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

  useEffect(() => {
    // Clean up completed lessons from cache on app open
    LessonCache.cleanupCompletedLessons();

    loadLessons();
    loadUserProfile();
    loadStreakData();
  }, []);

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
        dragonImageUrl: lesson.dragonImageUrl || DRAGON_PURPLE,
        backgroundColor: lesson.backgroundColor,
        ellipse77Color: lesson.ellipse77Color,
        ellipse78Color: lesson.ellipse78Color,
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
  };

  const handleProfilePress = () => {
    navigation.push('Profile');
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#8C49D5" />
          <Text className="mt-4 text-base text-gray-600">Loading lessons...</Text>
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

        {/* Today's Lesson Card - Show only the first incomplete lesson */}
        {lessons.length > 0 && (() => {
          // Find the first unlocked and not completed lesson
          const todayLesson = lessons.find(l => !l.isLocked);

          if (todayLesson) {
            return (
              <View style={{ marginBottom: 8 }}>
                <LessonCard
                  {...todayLesson}
                  onPress={() => handleLessonPress(todayLesson.id)}
                />
              </View>
            );
          }

          // If no unlocked lesson found, show the first one
          return (
            <View style={{ marginBottom: 8 }}>
              <LessonCard
                {...lessons[0]}
                onPress={() => handleLessonPress(lessons[0].id)}
              />
            </View>
          );
        })()}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
