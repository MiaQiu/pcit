/**
 * StreakWidget Component
 * Displays weekly streak with checkmarks for completed days
 * Based on Figma streak design
 */

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

interface StreakWidgetProps {
  streak: number;
  completedDays: boolean[]; // Array of 7 booleans (M-Su)
  dragonImageUrl?: string;
}

const DAYS = ['M', 'T', 'W', 'Th', 'F', 'Sa', 'Su'];

export const StreakWidget: React.FC<StreakWidgetProps> = ({
  streak,
  completedDays,
  dragonImageUrl,
}) => {
  // Calculate today's day index (0 = Monday, 6 = Sunday)
  const getTodayIndex = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    // Convert to Monday-based index (0 = Monday, 6 = Sunday)
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  };

  const todayIndex = getTodayIndex();

  return (
    <View style={styles.container}>
      {/* Streak Info */}
      <View style={styles.streakContainer}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Streak</Text>
        </View>

        {/* Days Grid */}
        <View style={styles.daysGrid}>
          {DAYS.map((day, index) => {
            const isCompleted = completedDays[index];
            const isToday = index === todayIndex;
            return (
              <View key={day} style={styles.dayColumn}>
                <Text style={styles.dayLabel}>{day}</Text>
                <View style={styles.circleContainer}>
                  {/* Circle */}
                  <View
                    style={[
                      styles.circle,
                      isCompleted ? styles.circleCompleted : styles.circleIncomplete,
                      isToday && styles.circleTodayOutline,
                    ]}
                  />
                  {/* Checkmark */}
                  {isCompleted && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  streakContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  headerText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#364153',
    letterSpacing: -0.5,
  },
  daysGrid: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    gap: 8,
  },
  dayColumn: {
    alignItems: 'center',
    gap: 2,
  },
  dayLabel: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#1E2939',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  circleContainer: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  circleCompleted: {
    backgroundColor: '#FFA726', // Orange/yellow from Figma
  },
  circleIncomplete: {
    backgroundColor: '#E0E0E0', // Light gray
  },
  circleTodayOutline: {
    borderWidth: 2,
    borderColor: '#8C49D5', // Main purple color
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
