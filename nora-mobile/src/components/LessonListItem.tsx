/**
 * LessonListItem Component
 * Compact lesson item for list view showing status and title
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, COLORS } from '../constants/assets';

export interface LessonListItemProps {
  id: string;
  dayNumber: number;
  title: string;
  isCompleted?: boolean;
  isLocked?: boolean;
  onPress?: () => void;
}

export const LessonListItem: React.FC<LessonListItemProps> = ({
  dayNumber,
  title,
  isCompleted = false,
  isLocked = false,
  onPress,
}) => {
  const handlePress = () => {
    if (!isLocked && onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isLocked && styles.containerLocked,
      ]}
      onPress={handlePress}
      disabled={isLocked}
      activeOpacity={0.7}
    >
      {/* Status Icon */}
      <View style={[
        styles.iconContainer,
        isCompleted && styles.iconCompleted,
        isLocked && styles.iconLocked,
      ]}>
        {isCompleted ? (
          <Ionicons name="checkmark" size={20} color="#FFFFFF" />
        ) : isLocked ? (
          <Ionicons name="lock-closed" size={16} color="#999999" />
        ) : (
          <Text style={styles.dayNumber}>{dayNumber}</Text>
        )}
      </View>

      {/* Lesson Title */}
      <Text
        style={[
          styles.title,
          isLocked && styles.titleLocked,
        ]}
        numberOfLines={2}
      >
        Day {dayNumber}: {title}
      </Text>

      {/* Arrow Icon */}
      {!isLocked && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={isCompleted ? COLORS.mainPurple : '#CCCCCC'}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  containerLocked: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCompleted: {
    backgroundColor: COLORS.mainPurple,
  },
  iconLocked: {
    backgroundColor: '#F5F5F5',
  },
  dayNumber: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
  },
  title: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.textDark,
  },
  titleLocked: {
    color: '#999999',
  },
});
