/**
 * ProgressBar Component
 * Segmented progress indicator for lesson viewer
 * Based on Figma design (36:1210)
 *
 * Design specs:
 * - Height: 8px
 * - Gap between segments: 4px
 * - Active color: #8C49D5 (mainPurple)
 * - Inactive color: #E0E0E0 (light gray)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

export interface ProgressBarProps {
  totalSegments: number;
  currentSegment: number;
  activeColor?: string;
  inactiveColor?: string;
  height?: number;
  gap?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  totalSegments,
  currentSegment,
  activeColor = '#8C49D5',
  inactiveColor = '#E0E0E0',
  height = 8,
  gap = 4,
}) => {
  return (
    <View style={[styles.container, { gap }]}>
      {Array.from({ length: totalSegments }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.segment,
            {
              height,
              backgroundColor: index < currentSegment ? activeColor : inactiveColor,
            },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: 16,
  },
  segment: {
    flex: 1,
    borderRadius: 4,
  },
});
