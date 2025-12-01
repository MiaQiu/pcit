/**
 * Home Screen
 * Main home/learn screen with lesson cards
 */

import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LessonCard, LessonCardProps } from '../components/LessonCard';
import { DRAGON_PURPLE } from '../constants/assets';
import { RootStackNavigationProp } from '../navigation/types';
// import { StreakWidget } from '../components/StreakWidget';

// Mock data - will be replaced with API calls later
const MOCK_LESSONS: LessonCardProps[] = [
  {
    id: '1',
    phase: 'PHASE',
    phaseName: 'Connect',
    title: 'Read your first 2-minute Lesson',
    subtitle: 'Start your journey',
    description: 'Lessons are short 2 min reads about how important connection is during playtime.',
    dragonImageUrl: DRAGON_PURPLE,
    backgroundColor: '#E4E4FF',
    ellipse77Color: '#9BD4DF', // Bottom ellipse - cyan
    ellipse78Color: '#A6E0CB', // Top ellipse - light green
    isLocked: false,
  },
  {
    id: '2',
    phase: 'PHASE',
    phaseName: 'Discipline',
    title: 'Read your first 2-minute Lesson',
    subtitle: 'Start your journey',
    description: 'Lessons are short 2 min reads about how important connection is during playtime.',
    dragonImageUrl: DRAGON_PURPLE,
    backgroundColor: '#FFE4C0',
    ellipse77Color: '#FFB380', // Bottom ellipse - orange
    ellipse78Color: '#A6E0CB', // Top ellipse - light green
    isLocked: true,
  },
];

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();

  // Mock streak data - will be replaced with real user data
  const completedDays = [true, true, true, true, true, true, false];
  const dragonImageUrl = 'https://www.figma.com/api/mcp/asset/fb9ddced-cfdb-4414-a8e4-d1dcfb1b40d7';

  const handleLessonPress = (lessonId: string) => {
    // Navigate to lesson viewer with lessonId
    navigation.navigate('LessonViewer', {
      lessonId,
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Streak Widget */}
        {/* <View style={{ marginBottom: 16 }}>
          <StreakWidget
            streak={6}
            completedDays={completedDays}
            dragonImageUrl={dragonImageUrl}
          />
        </View> */}

        {/* Lesson Cards */}
        {MOCK_LESSONS.map((lesson, index) => (
          <View key={lesson.id} style={{ marginBottom: index < MOCK_LESSONS.length - 1 ? 8 : 0 }}>
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
