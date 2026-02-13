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
  const isLocked = module.isLocked;

  return (
    <TouchableOpacity
      style={[styles.container, isLocked && styles.containerLocked]}
      onPress={isLocked ? undefined : onPress}
      activeOpacity={isLocked ? 1 : 0.7}
      disabled={isLocked}
    >
      <View style={styles.topRow}>
        {/* Lesson count */}
        <Text style={[styles.lessonCount, isLocked && styles.textLocked]}>
          {module.lessonCount} {module.lessonCount === 1 ? 'lesson' : 'lessons'}
        </Text>
        {isLocked && (
          <Ionicons name="lock-closed" size={16} color="#BBBBBB" />
        )}
      </View>

      {/* Title */}
      <Text style={[styles.title, isLocked && styles.textLocked]} numberOfLines={2}>
        {module.title}
      </Text>

      {/* Progress bar */}
      <View style={styles.progressRow}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              isLocked && styles.progressBarFillLocked,
              { width: `${Math.round(progress * 100)}%` }
            ]}
          />
        </View>
        <Text style={[styles.progressText, isLocked && styles.textLocked]}>
          {module.completedLessons}/{module.lessonCount}
        </Text>
        <Ionicons name={isLocked ? "lock-closed" : "chevron-forward"} size={18} color={isLocked ? "#CCCCCC" : "#CCCCCC"} />
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
  },
  containerLocked: {
    opacity: 0.5,
    backgroundColor: '#FAFAFA',
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
  textLocked: {
    color: '#BBBBBB',
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
  progressBarFillLocked: {
    backgroundColor: '#DDDDDD',
  },
  progressText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.mainPurple,
    minWidth: 30,
  },
});
