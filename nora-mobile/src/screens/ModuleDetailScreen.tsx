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
import type { ModuleDetailResponse } from '@nora/core';

export const ModuleDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<any>();
  const { moduleKey } = route.params;
  const lessonService = useLessonService();

  const [data, setData] = useState<ModuleDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
    } catch (error) {
      console.error('Failed to load module detail:', error);
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
});
