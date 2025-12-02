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
import { useLessonService } from '../contexts/AppContext';
import { MOCK_HOME_LESSONS } from '../data/mockLessons';
import { LessonCache } from '../lib/LessonCache';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const lessonService = useLessonService();

  const [lessons, setLessons] = useState<LessonCardProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Clean up completed lessons from cache on app open
    LessonCache.cleanupCompletedLessons();

    loadLessons();
  }, []);

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
          <ProfileCircle size={60} />
          <StreakWidget
            streak={6}
            completedDays={[true, true, true, true, true, true, false]}
          />
        </View>

        {/* Today's Deck Heading */}
        {lessons.length > 0 && (
          <Text style={styles.heading}>Today's deck</Text>
        )}

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
