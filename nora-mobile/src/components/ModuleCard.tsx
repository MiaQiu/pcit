/**
 * ModuleCard Component
 * Displays a module with progress bar, lesson count, and completion fraction
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, COLORS } from '../constants/assets';
import type { ModuleWithProgress } from '@nora/core';

interface ModuleCardProps {
  module: ModuleWithProgress;
  onPress: () => void;
}

export const ModuleCard: React.FC<ModuleCardProps> = ({ module, onPress }) => {
  const progress = module.lessonCount > 0
    ? module.completedLessons / module.lessonCount
    : 0;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.topRow}>
        {/* Lesson count */}
        <Text style={styles.lessonCount}>
          {module.lessonCount} {module.lessonCount === 1 ? 'lesson' : 'lessons'}
        </Text>
      </View>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {module.title}
      </Text>

      {/* Progress bar */}
      <View style={styles.progressRow}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.round(progress * 100)}%` }
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {module.completedLessons}/{module.lessonCount}
        </Text>
        <Ionicons name="chevron-forward" size={18} color="#CCCCCC" />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderColor: '#F0F0F0',
    borderWidth:2,
    // shadowColor: '#000',
    // shadowOffset: { width: 0, height: 1 },
    // shadowOpacity: 0.06,
    // shadowRadius: 4,
    // elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  lessonCount: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#999999',
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    lineHeight: 22,
    color: COLORS.textDark,
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.mainPurple,
    borderRadius: 3,
  },
  progressText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.mainPurple,
    minWidth: 30,
  },
});
