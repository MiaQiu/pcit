/**
 * AudioPlayBar
 * Presentational playback control bar for LessonViewerScreen_v2 — no expo-av
 * here, all state/handlers come from useLessonAudioPlayer via props so the
 * screen can share position/duration with LiveScriptCard.
 *
 * Row 1: skip -15s, scrubber + elapsed/duration, skip +30s.
 * Row 2: previous lesson, play/pause, next lesson, playback speed.
 */

import React, { useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { LESSON_TEXT_DARK } from '../constants/lessonViewerColors';

interface AudioPlayBarProps {
  isLoading: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  rate: number;
  onPlayPause: () => void;
  onSeekTo: (millis: number) => void;
  onSeekBy: (deltaMillis: number) => void;
  onCycleRate: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const AudioPlayBar: React.FC<AudioPlayBarProps> = ({
  isLoading,
  isPlaying,
  positionMillis,
  durationMillis,
  rate,
  onPlayPause,
  onSeekTo,
  onSeekBy,
  onCycleRate,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}) => {
  const trackWidthRef = useRef(0);

  const handleSeek = (e: GestureResponderEvent) => {
    if (!durationMillis || !trackWidthRef.current) return;
    const ratio = Math.min(Math.max(e.nativeEvent.locationX / trackWidthRef.current, 0), 1);
    onSeekTo(ratio * durationMillis);
  };

  const progress = durationMillis > 0 ? positionMillis / durationMillis : 0;

  return (
    <View style={styles.container}>
      <View style={styles.scrubberRow}>
        <TouchableOpacity style={styles.skipButton} onPress={() => onSeekBy(-15000)} disabled={isLoading}>
          <Ionicons name="play-back" size={14} color={LESSON_TEXT_DARK} />
          <Text style={styles.skipLabel}>15</Text>
        </TouchableOpacity>

        <View style={styles.progressColumn}>
          <TouchableOpacity
            style={styles.track}
            onLayout={(e) => { trackWidthRef.current = e.nativeEvent.layout.width; }}
            onPress={handleSeek}
          >
            <View style={styles.trackBackground} />
            <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
          </TouchableOpacity>
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(positionMillis / 1000)}</Text>
            <Text style={styles.timeText}>{formatTime(durationMillis / 1000)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.skipButton} onPress={() => onSeekBy(30000)} disabled={isLoading}>
          <Ionicons name="play-forward" size={14} color={LESSON_TEXT_DARK} />
          <Text style={styles.skipLabel}>30</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controlsRow}>
        <View style={styles.controlButton} />

        <TouchableOpacity style={styles.controlButton} onPress={onPrev} disabled={!hasPrev}>
          <Ionicons name="play-skip-back" size={22} color={hasPrev ? LESSON_TEXT_DARK : '#D1D5DB'} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.playButton} onPress={onPlayPause} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color="#FFFFFF" />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={onNext} disabled={!hasNext}>
          <Ionicons name="play-skip-forward" size={22} color={hasNext ? LESSON_TEXT_DARK : '#D1D5DB'} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={onCycleRate}>
          <Text style={styles.controlLabel}>{rate.toFixed(2).replace(/\.?0+$/, '') || '1'}x</Text>
          <Text style={styles.speedText}>Speed</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skipButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: LESSON_TEXT_DARK,
    marginTop: 1,
  },
  progressColumn: {
    flex: 1,
  },
  track: {
    height: 16,
    justifyContent: 'center',
  },
  trackBackground: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.mainPurple,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  timeText: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: LESSON_TEXT_DARK,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
  },
  controlButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: LESSON_TEXT_DARK,
    marginTop: 2,
  },
  speedText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    fontWeight: '600',
    color: LESSON_TEXT_DARK,
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 32,
    backgroundColor: COLORS.mainPurple,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
