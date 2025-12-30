/**
 * AudioWaveform Component
 * Real-time audio waveform visualization during recording
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, AppState, AppStateStatus } from 'react-native';
import { COLORS } from '../constants/assets';

interface AudioWaveformProps {
  isRecording: boolean;
  levels?: number[]; // Audio levels for each bar (0-1)
}

const BAR_COUNT = 40;
const BAR_WIDTH = 4;
const BAR_GAP = 4;
const MAX_HEIGHT = 40; // Reduced from 80
const MIN_HEIGHT = 8;
const LOUDNESS_THRESHOLD = 0.1; // Only animate if audio level > 10%

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  isRecording,
  levels,
}) => {
  // Create animated values for each bar
  const animatedHeights = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(MIN_HEIGHT))
  ).current;

  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  // Monitor app state to pause animations when backgrounded
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // CRITICAL: Only animate when recording AND app is in foreground
    // This prevents 400 animations/sec from running when screen is locked
    const shouldAnimate = isRecording && appState === 'active';

    if (shouldAnimate && levels) {
      // Check if any level exceeds the threshold
      const hasLoudSound = levels.some(level => level > LOUDNESS_THRESHOLD);

      if (hasLoudSound) {
        // Animate bars with actual audio levels
        const interval = setInterval(() => {
          animatedHeights.forEach((height, index) => {
            const level = levels[index] || 0;
            const targetHeight = level > LOUDNESS_THRESHOLD
              ? MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * level
              : MIN_HEIGHT;

            Animated.timing(height, {
              toValue: targetHeight,
              duration: 100,
              useNativeDriver: false,
            }).start();
          });
        }, 100);

        return () => clearInterval(interval);
      } else {
        // Sound too quiet - keep at min height
        animatedHeights.forEach((height) => {
          Animated.timing(height, {
            toValue: MIN_HEIGHT,
            duration: 100,
            useNativeDriver: false,
          }).start();
        });
      }
    } else if (!isRecording) {
      // Reset to min height when not recording
      animatedHeights.forEach((height) => {
        Animated.timing(height, {
          toValue: MIN_HEIGHT,
          duration: 200,
          useNativeDriver: false,
        }).start();
      });
    } else if (shouldAnimate && !levels) {
      // No audio levels provided - keep at min height
      animatedHeights.forEach((height) => {
        Animated.timing(height, {
          toValue: MIN_HEIGHT,
          duration: 100,
          useNativeDriver: false,
        }).start();
      });
    }
    // When backgrounded, simply stop animating (heights stay where they are)
  }, [isRecording, levels, appState]);

  return (
    <View style={styles.container}>
      <View style={styles.waveform}>
        {animatedHeights.map((height, index) => (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                height,
                width: BAR_WIDTH,
                marginHorizontal: BAR_GAP / 2,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: MAX_HEIGHT + 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: MAX_HEIGHT,
  },
  bar: {
    backgroundColor: COLORS.mainPurple,
    borderRadius: BAR_WIDTH / 2,
  },
});
