/**
 * AudioPlayBar
 * Presentational playback control bar for LessonViewerScreen_v2 — no expo-av
 * here, all state/handlers come from useLessonAudioPlayer via props so the
 * screen can share position/duration with LiveScriptCard.
 *
 * Row 1: skip -15s, scrubber + elapsed/duration, skip +30s.
 * Row 2: sleep timer, previous lesson, play/pause, next lesson, playback speed.
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator, GestureResponderEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';

interface AudioPlayBarProps {
  isLoading: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  rate: number;
  onPlayPause: () => void;
  onPause: () => void;
  onSeekTo: (millis: number) => void;
  onSeekBy: (deltaMillis: number) => void;
  onCycleRate: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

const SLEEP_TIMER_OPTIONS = [15, 30, 45, 60];

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
  onPause,
  onSeekTo,
  onSeekBy,
  onCycleRate,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}) => {
  const trackWidthRef = useRef(0);
  const [sleepMenuOpen, setSleepMenuOpen] = useState(false);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const sleepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    };
  }, []);

  const handleSelectSleepMinutes = (minutes: number | null) => {
    if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
    setSleepMinutes(minutes);
    setSleepMenuOpen(false);
    if (minutes !== null) {
      sleepTimeoutRef.current = setTimeout(() => {
        onPause();
        setSleepMinutes(null);
      }, minutes * 60 * 1000);
    }
  };

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
          <Ionicons name="play-back" size={14} color={COLORS.textDark} />
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
          <Ionicons name="play-forward" size={14} color={COLORS.textDark} />
          <Text style={styles.skipLabel}>30</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.controlsRow}>
        <View style={styles.sleepWrapper}>
          <TouchableOpacity style={styles.controlButton} onPress={() => setSleepMenuOpen((v) => !v)}>
            <Ionicons name="moon-outline" size={20} color={sleepMinutes ? COLORS.mainPurple : COLORS.textDark} />
            <Text style={styles.controlLabel}>{sleepMinutes ? `${sleepMinutes}m` : 'Timer'}</Text>
          </TouchableOpacity>
          {sleepMenuOpen && (
            <View style={styles.sleepMenu}>
              <TouchableOpacity style={styles.sleepMenuItem} onPress={() => handleSelectSleepMinutes(null)}>
                <Text style={styles.sleepMenuText}>Off</Text>
              </TouchableOpacity>
              {SLEEP_TIMER_OPTIONS.map((minutes) => (
                <TouchableOpacity key={minutes} style={styles.sleepMenuItem} onPress={() => handleSelectSleepMinutes(minutes)}>
                  <Text style={styles.sleepMenuText}>{minutes} min</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.controlButton} onPress={onPrev} disabled={!hasPrev}>
          <Ionicons name="play-skip-back" size={22} color={hasPrev ? COLORS.textDark : '#D1D5DB'} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.playButton} onPress={onPlayPause} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color="#FFFFFF" />
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={onNext} disabled={!hasNext}>
          <Ionicons name="play-skip-forward" size={22} color={hasNext ? COLORS.textDark : '#D1D5DB'} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={onCycleRate}>
          <Ionicons name="flash-outline" size={18} color={COLORS.textDark} />
          <Text style={styles.controlLabel}>{rate.toFixed(2).replace(/\.?0+$/, '') || '1'}x</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    color: COLORS.textDark,
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
    color: '#6B7280',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
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
    color: '#6B7280',
    marginTop: 2,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.mainPurple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sleepWrapper: {
    position: 'relative',
  },
  sleepMenu: {
    position: 'absolute',
    bottom: 50,
    left: -8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 4,
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
  sleepMenuItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sleepMenuText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textDark,
  },
});
