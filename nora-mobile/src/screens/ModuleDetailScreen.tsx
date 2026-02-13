/**
 * ModuleDetailScreen
 * Shows module info and its lessons with user progress
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, Text, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LessonListItem } from '../components/LessonListItem';
import { FONTS, COLORS } from '../constants/assets';
import { RootStackNavigationProp } from '../navigation/types';
import { useLessonService } from '../contexts/AppContext';
import { useToast } from '../components/ToastManager';
import type { ModuleDetailResponse } from '@nora/core';

export const ModuleDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<any>();
  const { moduleKey } = route.params;
  const lessonService = useLessonService();
  const { showToast } = useToast();

  const [data, setData] = useState<ModuleDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    loadModuleDetail();
  }, [moduleKey]);

  // Refresh when coming back from a lesson
  useFocusEffect(
    useCallback(() => {
      if (data) {
        loadModuleDetail(false);
      }
    }, [data?.module?.key])
  );

  const loadModuleDetail = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      else setIsRefreshing(true);

      const response = await lessonService.getModuleDetail(moduleKey);
      setData(response);
      setIsLocked(false);
    } catch (error: any) {
      console.error('Failed to load module detail:', error);
      // Handle locked module (403 from backend)
      if (error?.status === 403 || error?.statusCode === 403) {
        setIsLocked(true);
        showToast('Complete the Foundation module first', 'info');
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleLessonPress = (lessonId: string) => {
    navigation.push('LessonViewer', { lessonId });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.mainPurple} />
        </View>
      </SafeAreaView>
    );
  }

  if (isLocked) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>
        <View style={styles.lockedContainer}>
          <Ionicons name="lock-closed" size={48} color="#CCCCCC" />
          <Text style={styles.lockedTitle}>Module Locked</Text>
          <Text style={styles.lockedMessage}>
            Complete the Foundation module first to unlock this module.
          </Text>
          <TouchableOpacity
            style={styles.goToFoundationBtn}
            onPress={() => {
              navigation.goBack();
              setTimeout(() => navigation.push('ModuleDetail', { moduleKey: 'FOUNDATION' }), 100);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.goToFoundationText}>Go to Foundation</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!data) return null;

  const { module: mod, lessons } = data;
  const completedCount = lessons.filter(l => l.progress?.status === 'COMPLETED').length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => loadModuleDetail(false)}
            tintColor={COLORS.mainPurple}
          />
        }
      >
        {/* Back button + Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>

        {/* Module info */}
        <View style={styles.moduleInfo}>
          <View style={[styles.tag, { backgroundColor: mod.backgroundColor }]}>
            <Text style={styles.tagText}>{mod.shortName}</Text>
          </View>
          <Text style={styles.title}>{mod.title}</Text>
          <Text style={styles.description}>{mod.description}</Text>
          <Text style={styles.progressSummary}>
            {completedCount}/{lessons.length} lessons completed
          </Text>
        </View>

        {/* Lessons list */}
        <View style={styles.lessonsList}>
          {lessons.map((lesson, index) => (
            <LessonListItem
              key={lesson.id}
              id={lesson.id}
              dayNumber={lesson.dayNumber}
              title={lesson.title}
              isCompleted={lesson.progress?.status === 'COMPLETED'}
              onPress={() => handleLessonPress(lesson.id)}
            />
          ))}
        </View>
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
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moduleInfo: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  tagText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textDark,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    lineHeight: 34,
    color: COLORS.textDark,
    marginBottom: 8,
  },
  description: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: '#666666',
    marginBottom: 12,
  },
  progressSummary: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.mainPurple,
  },
  lessonsList: {
    paddingHorizontal: 24,
  },
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  lockedTitle: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textDark,
    marginTop: 16,
    marginBottom: 8,
  },
  lockedMessage: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  goToFoundationBtn: {
    backgroundColor: COLORS.mainPurple,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  goToFoundationText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
