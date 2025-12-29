/**
 * RecordingTimer Component
 * Displays elapsed recording time in MM:SS format
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, COLORS } from '../constants/assets';

interface RecordingTimerProps {
  isRecording: boolean;
  durationMillis?: number;
}

export const RecordingTimer: React.FC<RecordingTimerProps> = ({
  isRecording,
  durationMillis = 0,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  // Monitor app state to pause timer when backgrounded
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // CRITICAL: Only update timer when recording AND app is in foreground
    // This prevents 10 re-renders/sec when screen is locked
    const shouldUpdate = isRecording && appState === 'active';

    if (shouldUpdate) {
      const startTime = Date.now() - durationMillis;
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);

      return () => clearInterval(interval);
    } else {
      // When backgrounded or not recording, use the passed duration
      setElapsedTime(durationMillis);
    }
  }, [isRecording, durationMillis, appState]);

  const formatTime = (millis: number) => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {isRecording && (
        <View style={styles.recordingDot} />
      )}
      <Text style={styles.time}>{formatTime(elapsedTime)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 100,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E74C3C',
  },
  time: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.textDark,
    letterSpacing: 1,
  },
});
