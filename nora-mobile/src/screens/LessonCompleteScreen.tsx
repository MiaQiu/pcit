/**
 * LessonCompleteScreen
 * Shown after completing a lesson - displays streak and suggests next action
 * Based on Figma Frame 2005
 */

import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NextActionCard } from '../components/NextActionCard';
import { StreakWidget } from '../components/StreakWidget';
import { ProfileCircle } from '../components/ProfileCircle';
import { RootStackParamList, RootStackNavigationProp } from '../navigation/types';
import { useLessonService } from '../contexts/AppContext';
import { LessonDetailResponse } from '@nora/core';
import { COLORS, FONTS } from '../constants/assets';

type LessonCompleteScreenRouteProp = RouteProp<RootStackParamList, 'LessonComplete'>;

export const LessonCompleteScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<LessonCompleteScreenRouteProp>();
  const lessonService = useLessonService();
  const { lessonId } = route.params;

  const [loading, setLoading] = useState(true);
  const [lessonData, setLessonData] = useState<LessonDetailResponse | null>(null);

  // Mock streak data - will be replaced with real user data
  const completedDays = [true, true, true, true, true, true, false];

  useEffect(() => {
    loadLessonData();
  }, [lessonId]);

  const loadLessonData = async () => {
    try {
      setLoading(true);
      const data = await lessonService.getLessonDetail(lessonId);
      setLessonData(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load lesson data:', error);
      setLoading(false);
    }
  };

  const handleContinue = () => {
    // Navigate to Record tab to record play session
    navigation.navigate('MainTabs', { screen: 'Record' });
  };

  const handleGoHome = () => {
    // Navigate back to Home tab
    navigation.navigate('MainTabs', { screen: 'Home' });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.mainPurple} />
          <Text style={styles.loadingText}>Loading...</Text>
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
        {/* Profile Circle and Streak Widget */}
        <View style={styles.streakContainer}>
          <ProfileCircle size={60} />
          <StreakWidget
            streak={6}
            completedDays={completedDays}
          />
        </View>

        {/* Next Action Card */}
        <View style={{ marginTop: 16 }}>
          <NextActionCard
            phase="PHASE"
            phaseName={lessonData?.lesson.phase || 'Up next'}
            title="Record your play session"
            description="Learning is 2x faster when put into practice. Practice your new skills by recording the session with Zoey."
            buttonText="Continue"
            onPress={handleContinue}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 16,
    marginLeft: 20,
  },
});
