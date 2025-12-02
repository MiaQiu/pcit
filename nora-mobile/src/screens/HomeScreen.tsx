/**
 * Home Screen
 * Main home/learn screen with lesson cards
 */

import React, { useState, useEffect } from 'react';
import { View, ScrollView, ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LessonCard, LessonCardProps } from '../components/LessonCard';
import { DRAGON_PURPLE } from '../constants/assets';
import { RootStackNavigationProp } from '../navigation/types';
import { useLessonService } from '../contexts/AppContext';
import { MOCK_HOME_LESSONS } from '../data/mockLessons';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const lessonService = useLessonService();

  const [lessons, setLessons] = useState<LessonCardProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to fetch from API
      const response = await lessonService.getLessons();

      // Extract lessons array from response
      const apiLessons = response.lessons || [];

      // If API returns empty, use mock data for development
      if (apiLessons.length === 0) {
        console.log('No lessons in database, using mock data for development');
        setLessons(MOCK_HOME_LESSONS);
        return;
      }

      // Map API lessons to LessonCardProps
      const mappedLessons: LessonCardProps[] = apiLessons.map((lesson) => ({
        id: lesson.id,
        phase: 'PHASE',
        phaseName: lesson.phase,
        title: lesson.title,
        subtitle: lesson.subtitle,
        description: lesson.shortDescription,
        dragonImageUrl: lesson.dragonImageUrl || DRAGON_PURPLE,
        backgroundColor: lesson.backgroundColor,
        ellipse77Color: lesson.ellipse77Color,
        ellipse78Color: lesson.ellipse78Color,
        isLocked: false, // TODO: Implement prerequisite checking
      }));

      setLessons(mappedLessons);
    } catch (err) {
      console.error('Failed to load lessons:', err);
      setError('Failed to load lessons. Using offline data.');

      // Fallback to mock data
      setLessons(MOCK_HOME_LESSONS);
    } finally {
      setLoading(false);
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
      >
        {/* Error Message */}
        {error && (
          <View className="mb-4 p-4 bg-yellow-100 rounded-lg">
            <Text className="text-sm text-yellow-800">{error}</Text>
          </View>
        )}

        {/* Streak Widget */}
        {/* <View style={{ marginBottom: 16 }}>
          <StreakWidget
            streak={6}
            completedDays={completedDays}
            dragonImageUrl={dragonImageUrl}
          />
        </View> */}

        {/* Lesson Cards */}
        {lessons.map((lesson, index) => (
          <View key={lesson.id} style={{ marginBottom: index < lessons.length - 1 ? 8 : 0 }}>
            <LessonCard
              {...lesson}
              onPress={() => handleLessonPress(lesson.id)}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};
