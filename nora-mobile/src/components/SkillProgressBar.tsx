/**
 * SkillProgressBar Component
 * Horizontal progress bar with label for skill tracking
 * Used in ReportScreen to show PRN skills progress
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../constants/assets';

interface SkillProgressBarProps {
  label: string;
  progress: number; // 0-100
  color?: string;
}

export const SkillProgressBar: React.FC<SkillProgressBarProps> = ({
  label,
  progress,
  color = COLORS.mainPurple,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.percentage}>{progress}%</Text>
      </View>
      <View style={styles.trackContainer}>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              {
                width: `${progress}%`,
                backgroundColor: color,
              }
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textDark,
  },
  percentage: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#666666',
  },
  trackContainer: {
    width: '100%',
  },
  track: {
    width: '100%',
    height: 8,
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
