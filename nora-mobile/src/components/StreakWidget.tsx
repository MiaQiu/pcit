/**
 * StreakWidget Component
 * Displays weekly streak with checkmarks for completed days
 * Based on Figma streak design
 */

import React from 'react';
import { View, Text, Image } from 'react-native';

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
  return (
    <View className="flex-row items-end" style={{ gap: 8 }}>
      {/* Dragon Avatar */}
      {dragonImageUrl && (
        <View className="w-20 h-20 rounded-full bg-gray-300 overflow-hidden">
          <Image
            source={{ uri: dragonImageUrl }}
            className="w-full h-full"
            resizeMode="cover"
          />
        </View>
      )}

      {/* Streak Info */}
      <View className="flex-1">
        <View className="flex-row items-center justify-between px-1 mb-1">
          <Text
            style={{ fontFamily: 'PlusJakartaSans_700Bold' }}
            className="text-base text-[#364153] tracking-tight"
          >
            Streak
          </Text>
        </View>

        {/* Days Grid */}
        <View className="flex-row px-1" style={{ gap: 8 }}>
          {DAYS.map((day, index) => {
            const isCompleted = completedDays[index];
            return (
              <View key={day} className="items-center" style={{ gap: 0 }}>
                <Text
                  style={{ fontFamily: 'PlusJakartaSans_400Regular' }}
                  className="text-xs text-[#1E2939] text-center tracking-tight"
                >
                  {day}
                </Text>
                <View className="w-[30px] h-[30px] items-center justify-center">
                  {/* Circle */}
                  <View
                    className={`absolute w-[30px] h-[30px] rounded-full ${
                      isCompleted ? 'bg-[#8C49D5]' : 'bg-gray-200'
                    }`}
                  />
                  {/* Checkmark */}
                  {isCompleted && (
                    <Text className="text-white text-sm font-bold">✓</Text>
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
