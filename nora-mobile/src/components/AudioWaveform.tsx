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
const MAX_HEIGHT = 80;
const MIN_HEIGHT = 8;

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

    if (shouldAnimate) {
      // Animate bars with random heights to simulate live audio
      const interval = setInterval(() => {
        animatedHeights.forEach((height, index) => {
          const targetHeight = levels
            ? MIN_HEIGHT + (MAX_HEIGHT - MIN_HEIGHT) * (levels[index] || 0)
            : MIN_HEIGHT + Math.random() * (MAX_HEIGHT - MIN_HEIGHT);

          Animated.timing(height, {
            toValue: targetHeight,
            duration: 100,
            useNativeDriver: false,
          }).start();
        });
      }, 100);

      return () => clearInterval(interval);
    } else if (!isRecording) {
      // Reset to min height when not recording
      animatedHeights.forEach((height) => {
        Animated.timing(height, {
          toValue: MIN_HEIGHT,
          duration: 200,
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
    height: MAX_HEIGHT + 40,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
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
