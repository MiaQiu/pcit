/**
 * LessonCompleteScreen
 * Shown after completing a lesson - displays streak and suggests next action
 * Based on Figma Frame 2005
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { LessonCard } from '../components/LessonCard';
import { StreakWidget } from '../components/StreakWidget';
import { DRAGON_PURPLE } from '../constants/assets';
import { RootStackParamList, RootStackNavigationProp } from '../navigation/types';

type LessonCompleteScreenRouteProp = RouteProp<RootStackParamList, 'LessonComplete'>;

export const LessonCompleteScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<LessonCompleteScreenRouteProp>();

  // Mock streak data - will be replaced with real user data
  const completedDays = [true, true, true, true, true, true, false];
  const dragonImageUrl = 'https://www.figma.com/api/mcp/asset/fb9ddced-cfdb-4414-a8e4-d1dcfb1b40d7';

  // Mock "up next" lesson data - will be replaced with API call
  const upNextLesson = {
    id: 'record-session',
    phase: 'PHASE',
    phaseName: 'Connect',
    title: 'Record your play session',
    subtitle: 'Up next',
    description: 'Learning is 2x faster when put into practice. Practice your new skills by recording the session with Zoey.',
    dragonImageUrl: DRAGON_PURPLE,
    backgroundColor: '#E4E4FF',
    ellipse77Color: '#9BD4DF',
    ellipse78Color: '#A6E0CB',
    isLocked: false,
  };

  const handleContinue = () => {
    // Navigate to Record tab
    navigation.navigate('MainTabs', { screen: 'Record' });
  };

  const handleGoHome = () => {
    // Navigate back to Home tab
    navigation.navigate('MainTabs', { screen: 'Home' });
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      <ScrollView
        className="flex-1 px-6"
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Streak Widget */}
        <View style={{ marginBottom: 16 }}>
          <StreakWidget
            streak={6}
            completedDays={completedDays}
            dragonImageUrl={dragonImageUrl}
          />
        </View>

        {/* Empty Card Area - just decorative background */}
        <View style={styles.emptyCardContainer}>
          <View style={styles.emptyCard} />
        </View>

        {/* Up Next Section */}
        <View style={{ marginTop: 16 }}>
          <LessonCard
            {...upNextLesson}
            onPress={handleContinue}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  emptyCardContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyCard: {
    width: '90%',
    height: 200,
    backgroundColor: '#D5F5E3', // Light green/cyan from Figma
    borderRadius: 24,
    // Could add decorative elements here if needed
  },
});
