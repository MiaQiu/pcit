/**
 * Learn Screen
 * Shows all lessons organized by phases with completion status
 */

import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LessonListItem, LessonListItemProps } from '../components/LessonListItem';
import { StreakWidget } from '../components/StreakWidget';
import { ProfileCircle } from '../components/ProfileCircle';
import { FONTS, COLORS } from '../constants/assets';
import { RootStackNavigationProp } from '../navigation/types';
import { useLessonService } from '../contexts/AppContext';
import { LessonCache } from '../lib/LessonCache';

interface Phase {
  phaseNumber: number;
  phaseName: string;
  totalLessons: number;
  completedLessons: number;
  lessons: LessonListItemProps[];
}

export const LearnScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const lessonService = useLessonService();

  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLockedModal, setShowLockedModal] = useState(false);

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async (showLoadingSpinner = true) => {
    try {
      if (showLoadingSpinner) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      // Fetch all lessons from API
      const response = await lessonService.getLessons();
      const apiLessons = response.lessons || [];

      // Check content version and clear cache if it changed
      if (response.contentVersion) {
        const cacheCleared = await LessonCache.checkAndUpdateVersion(response.contentVersion);
        if (cacheCleared) {
          console.log('Cache cleared due to content update');
        }
      }

      // If no lessons in API, show mock data structure
      if (apiLessons.length === 0) {
        setPhases(getMockPhases());
        return;
      }

      // Group lessons by phase
      const phaseMap = new Map<string, any[]>();
      apiLessons.forEach(lesson => {
        const phase = lesson.phase || 'Phase 1';
        if (!phaseMap.has(phase)) {
          phaseMap.set(phase, []);
        }
        phaseMap.get(phase)!.push(lesson);
      });

      // Convert to Phase objects
      const phasesData: Phase[] = [];
      let globalDayCounter = 1;

      Array.from(phaseMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([phaseName, lessons], phaseIndex) => {
          const sortedLessons = lessons.sort((a, b) => {
            const aOrder = a.orderInPhase || 0;
            const bOrder = b.orderInPhase || 0;
            return aOrder - bOrder;
          });

          const completedCount = sortedLessons.filter(
            l => l.status === 'COMPLETED'
          ).length;

          const lessonItems: LessonListItemProps[] = sortedLessons.map((lesson, index) => ({
            id: lesson.id,
            dayNumber: globalDayCounter++,
            title: lesson.title,
            isCompleted: lesson.status === 'COMPLETED',
            isLocked: lesson.isLocked || false,
          }));

          phasesData.push({
            phaseNumber: phaseIndex + 1,
            phaseName,
            totalLessons: lessons.length,
            completedLessons: completedCount,
            lessons: lessonItems,
          });
        });

      setPhases(phasesData);
    } catch (err) {
      console.error('Failed to load lessons:', err);
      setError('Failed to load lessons');
      // Fallback to mock data
      setPhases(getMockPhases());
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const getMockPhases = (): Phase[] => {
    return [
      {
        phaseNumber: 1,
        phaseName: 'CONNECT',
        totalLessons: 15,
        completedLessons: 15,
        lessons: [
          { id: '1', dayNumber: 1, title: 'Introduction to Special Play Time', isCompleted: true, isLocked: false },
          { id: '2', dayNumber: 2, title: 'The Power of Narration (PEN Skills - Part 1)', isCompleted: true, isLocked: false },
          { id: '3', dayNumber: 3, title: 'Echoing Your Child\'s Words (PEN Skills - Part 2)', isCompleted: true, isLocked: false },
          { id: '4', dayNumber: 4, title: 'Labeled Praise (PEN Skills - Part 3)', isCompleted: true, isLocked: false },
          { id: '5', dayNumber: 5, title: 'What NOT to Do During Special Time', isCompleted: true, isLocked: false },
          { id: '6', dayNumber: 6, title: 'Handling Chaos and Destruction in Special Time', isCompleted: true, isLocked: false },
          { id: '7', dayNumber: 7, title: 'The Parent is the Most Important Ingredient', isCompleted: true, isLocked: false },
          { id: '8', dayNumber: 8, title: 'Dealing with Whining and Tantrums During Special Time', isCompleted: true, isLocked: false },
          { id: '9', dayNumber: 9, title: 'Building Trust Through Consistency', isCompleted: true, isLocked: false },
          { id: '10', dayNumber: 10, title: 'When Siblings Want In', isCompleted: true, isLocked: false },
          { id: '11', dayNumber: 11, title: 'What If My Child Ignores Me During Special Time?', isCompleted: true, isLocked: false },
          { id: '12', dayNumber: 12, title: 'Special Time for Different Ages', isCompleted: true, isLocked: false },
          { id: '13', dayNumber: 13, title: 'When You\'re Touched Out and Exhausted', isCompleted: true, isLocked: false },
          { id: '14', dayNumber: 14, title: 'Celebrating Progress - You\'ve Built the Foundation', isCompleted: true, isLocked: false },
          { id: '15', dayNumber: 15, title: 'Preparing for Phase 2 - What to Expect', isCompleted: true, isLocked: false },
        ],
      },
      {
        phaseNumber: 2,
        phaseName: 'DISCIPLINE',
        totalLessons: 26,
        completedLessons: 0,
        lessons: [
          { id: '16', dayNumber: 16, title: 'The Foundation of Effective Commands', isCompleted: false, isLocked: false },
          { id: '17', dayNumber: 17, title: 'The 5-Second Rule', isCompleted: false, isLocked: true },
          { id: '18', dayNumber: 18, title: 'When Compliance Happens - Label It!', isCompleted: false, isLocked: true },
          { id: '19', dayNumber: 19, title: 'Natural vs. Logical Consequences', isCompleted: false, isLocked: true },
          { id: '20', dayNumber: 20, title: 'The "When/Then" Framework', isCompleted: false, isLocked: true },
          { id: '21', dayNumber: 21, title: 'Time-Outs That Actually Work', isCompleted: false, isLocked: true },
          { id: '22', dayNumber: 22, title: 'The Warning System', isCompleted: false, isLocked: true },
          { id: '23', dayNumber: 23, title: 'Following Through Every Time', isCompleted: false, isLocked: true },
          { id: '24', dayNumber: 24, title: 'Handling Public Meltdowns', isCompleted: false, isLocked: true },
          { id: '25', dayNumber: 25, title: 'When Your Child Hits or Bites', isCompleted: false, isLocked: true },
          { id: '26', dayNumber: 26, title: 'Dealing with Defiance', isCompleted: false, isLocked: true },
          { id: '27', dayNumber: 27, title: 'The Power of Routines', isCompleted: false, isLocked: true },
          { id: '28', dayNumber: 28, title: 'Visual Schedules for Success', isCompleted: false, isLocked: true },
          { id: '29', dayNumber: 29, title: 'Bedtime Without Battles', isCompleted: false, isLocked: true },
          { id: '30', dayNumber: 30, title: 'Morning Routines That Work', isCompleted: false, isLocked: true },
          { id: '31', dayNumber: 31, title: 'Managing Screen Time', isCompleted: false, isLocked: true },
          { id: '32', dayNumber: 32, title: 'Sibling Conflict Resolution', isCompleted: false, isLocked: true },
          { id: '33', dayNumber: 33, title: 'Teaching Emotional Regulation', isCompleted: false, isLocked: true },
          { id: '34', dayNumber: 34, title: 'The Calm-Down Corner', isCompleted: false, isLocked: true },
          { id: '35', dayNumber: 35, title: 'Repair After Conflict', isCompleted: false, isLocked: true },
          { id: '36', dayNumber: 36, title: 'When You Lose Your Cool', isCompleted: false, isLocked: true },
          { id: '37', dayNumber: 37, title: 'Managing Your Own Triggers', isCompleted: false, isLocked: true },
          { id: '38', dayNumber: 38, title: 'Co-Parenting Consistency', isCompleted: false, isLocked: true },
          { id: '39', dayNumber: 39, title: 'Grandparents and Boundaries', isCompleted: false, isLocked: true },
          { id: '40', dayNumber: 40, title: 'Celebrating Milestones', isCompleted: false, isLocked: true },
          { id: '41', dayNumber: 41, title: 'The Road Ahead', isCompleted: false, isLocked: true },
        ],
      },
    ];
  };

  const handleLessonPress = (lessonId: string, isLocked?: boolean) => {
    // Check if lesson is locked
    if (isLocked) {
      setShowLockedModal(true);
      return;
    }

    navigation.push('LessonViewer', { lessonId });
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
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadLessons(false)}
            tintColor={COLORS.mainPurple}
          />
        }
      >
        {/* Header with Profile and Streak */}
        <View style={styles.header}>
          <View style={styles.streakContainer}>
            {/* <ProfileCircle size={60} />
            <StreakWidget
              streak={6}
              completedDays={[true, true, true, true, true, true, false]}
            /> */}
          </View>
          <Text style={styles.mainTitle}>All Lessons</Text>
        </View>

        {/* Error Message */}
        {error && (
          <View className="mx-6 mb-4 p-4 bg-yellow-100 rounded-lg">
            <Text className="text-sm text-yellow-800">{error}</Text>
          </View>
        )}

        {/* Phases and Lessons */}
        {phases.map((phase) => (
          <View key={phase.phaseNumber} style={styles.phaseSection}>
            {/* Phase Header */}
            <View style={styles.phaseHeader}>
              <Text style={styles.phaseTitle}>
                Phase {phase.phaseNumber}: {phase.phaseName}
              </Text>
              <Text style={styles.phaseProgress}>
                {phase.completedLessons}/{phase.totalLessons}
              </Text>
            </View>

            {/* Lessons List */}
            <View style={styles.lessonsList}>
              {phase.lessons.map((lesson) => (
                <LessonListItem
                  key={lesson.id}
                  {...lesson}
                  onPress={() => handleLessonPress(lesson.id, lesson.isLocked)}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Locked Lesson Modal */}
      <Modal
        visible={showLockedModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLockedModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Lesson Locked</Text>
            <Text style={styles.modalMessage}>
              This course is paced to give you the space to reflect and retain what you learn.{'\n\n'}New lesson will unlock tomorrow!
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowLockedModal(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 16,
  },
  mainTitle: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.5,
    color: COLORS.textDark,
    marginTop: 8,
  },
  phaseSection: {
    marginBottom: 24,
  },
  phaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  phaseTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    lineHeight: 28,
    color: COLORS.textDark,
    flex: 1,
  },
  phaseProgress: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.mainPurple,
  },
  lessonsList: {
    paddingHorizontal: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    lineHeight: 32,
    color: COLORS.textDark,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalMessage: {
    fontFamily: FONTS.regular,
    fontSize: 18,
    lineHeight: 28,
    color: COLORS.textDark,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: COLORS.mainPurple,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  modalButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: '#FFFFFF',
  },
});
