/**
 * Learn Screen
 * Shows all lessons organized by phases with completion status
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Text, StyleSheet, ActivityIndicator, RefreshControl, Alert, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { LessonListItem, LessonListItemProps } from '../components/LessonListItem';
import { StreakWidget } from '../components/StreakWidget';
import { ProfileCircle } from '../components/ProfileCircle';
import { FONTS, COLORS } from '../constants/assets';
import { RootStackNavigationProp } from '../navigation/types';
import { useLessonService } from '../contexts/AppContext';
import { LessonCache } from '../lib/LessonCache';
import { handleApiError, handleApiSuccess } from '../utils/NetworkMonitor';
import { ErrorMessages } from '../utils/errorMessages';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

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
  const { isOnline } = useNetworkStatus();

  const [phases, setPhases] = useState<Phase[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLockedModal, setShowLockedModal] = useState(false);

  useEffect(() => {
    loadLessons();
  }, []);

  // Refresh lessons when screen comes into focus (e.g., after completing a lesson)
  useFocusEffect(
    useCallback(() => {
      // Only reload if we already have data (skip initial mount, which is handled by useEffect)
      if (phases.length > 0) {
        loadLessons(false);
      }
    }, [phases.length])
  );

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
      handleApiSuccess(); // Mark server as up after successful API call
      const apiLessons = response.lessons || [];

      // Check content version and clear cache if it changed
      if (response.contentVersion) {
        const cacheCleared = await LessonCache.checkAndUpdateVersion(response.contentVersion);
        if (cacheCleared) {
          console.log('Cache cleared due to content update');
        }
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
            l => l.progress?.status === 'COMPLETED'
          ).length;

          const lessonItems: LessonListItemProps[] = sortedLessons.map((lesson, index) => ({
            id: lesson.id,
            dayNumber: globalDayCounter++,
            title: lesson.title,
            isCompleted: lesson.progress?.status === 'COMPLETED',
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

      // Store error message for empty state display
      const errorMessage = handleApiError(err);
      setError(errorMessage);
      // NetworkStatusBar already shows if it's a network issue
      // Empty state will display the error message
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
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
            enabled={isOnline}
            tintColor={COLORS.mainPurple}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.mainTitle}>All Lessons</Text>
        </View>

        {/* Empty state when error and no lessons loaded */}
        {error && !loading && phases.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Couldn't Load Lessons</Text>
            <Text style={styles.emptyMessage}>{error}</Text>
            {/* <TouchableOpacity
              style={[styles.retryButton, !isOnline && styles.retryButtonDisabled]}
              onPress={() => loadLessons()}
              disabled={!isOnline}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity> */}
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.textDark,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyMessage: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: COLORS.mainPurple,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  retryButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  retryButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
