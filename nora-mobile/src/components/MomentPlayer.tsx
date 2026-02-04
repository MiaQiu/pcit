/**
 * MomentPlayer Component
 * Audio player for playing a specific moment/segment from a recording
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';

interface MomentPlayerProps {
  audioUrl: string;
  startTime: number;  // in seconds
  endTime: number;    // in seconds
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Generate static waveform bars for visual representation
const WAVEFORM_BARS = [
  0.3, 0.5, 0.7, 0.9, 0.6, 0.8, 1.0, 0.7, 0.5, 0.8,
  0.9, 0.6, 0.4, 0.7, 0.5, 0.3, 0.6, 0.8, 0.5, 0.4
];

export const MomentPlayer: React.FC<MomentPlayerProps> = ({
  audioUrl,
  startTime,
  endTime,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const duration = endTime - startTime;

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  const handlePlayPause = async () => {
    try {
      if (isPlaying && soundRef.current) {
        // Pause
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }
        return;
      }

      // Start playing
      setIsLoading(true);

      // Configure audio mode
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // If we already have a sound loaded, just play from start position
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(startTime * 1000);
        await soundRef.current.playAsync();
      } else {
        // Load new sound
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { positionMillis: startTime * 1000, shouldPlay: true }
        );
        soundRef.current = sound;
      }

      setIsLoading(false);
      setIsPlaying(true);

      // Monitor playback to stop at end time
      checkIntervalRef.current = setInterval(async () => {
        if (!soundRef.current) return;

        const status = await soundRef.current.getStatusAsync();
        if (!status.isLoaded) return;

        const currentTime = status.positionMillis / 1000;
        const elapsed = currentTime - startTime;
        setProgress(Math.min(elapsed / duration, 1));

        // Stop at end time
        if (currentTime >= endTime || status.didJustFinish) {
          await soundRef.current.pauseAsync();
          await soundRef.current.setPositionAsync(startTime * 1000);
          setIsPlaying(false);
          setProgress(0);
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
          }
        }
      }, 100);

    } catch (error) {
      console.error('MomentPlayer error:', error);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.timestamp}>at {formatTime(startTime)}</Text>
      <View style={styles.playerRow}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayPause}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={COLORS.textDark} />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={20}
              color={COLORS.textDark}
            />
          )}
        </TouchableOpacity>

        <View style={styles.waveformContainer}>
          {WAVEFORM_BARS.map((height, index) => {
            const barProgress = index / WAVEFORM_BARS.length;
            const isActive = barProgress <= progress;
            return (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  {
                    height: 4 + height * 20,
                    backgroundColor: isActive ? COLORS.mainPurple : '#D1D5DB',
                  },
                ]}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 8,
  },
  timestamp: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 28,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
  },
});
