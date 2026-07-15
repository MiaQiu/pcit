/**
 * useLessonAudioPlayer
 * Owns the expo-av Sound lifecycle for a single lesson's narration audio, so
 * position/duration can be shared between the live-script view and the
 * playback control bar without either owning the Sound instance directly.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';

const RATE_STEPS = [1.0, 1.25, 1.5, 2.0];

interface UseLessonAudioPlayerOptions {
  onFinish?: () => void;
}

export function useLessonAudioPlayer(audioUrl: string | undefined, options: UseLessonAudioPlayerOptions = {}) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [rate, setRateState] = useState(1.0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const onFinishRef = useRef(options.onFinish);
  onFinishRef.current = options.onFinish;

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setPositionMillis(status.positionMillis);
    setDurationMillis(status.durationMillis ?? 0);
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMillis(0);
      soundRef.current?.setPositionAsync(0);
      onFinishRef.current?.();
    }
  }, []);

  useEffect(() => {
    if (!audioUrl) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setIsPlaying(false);
    setPositionMillis(0);
    setDurationMillis(0);
    setRateState(1.0);

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: false },
          onPlaybackStatusUpdate
        );
        if (cancelled) {
          sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
      } catch (error) {
        console.error('useLessonAudioPlayer preload error:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, [audioUrl, onPlaybackStatusUpdate]);

  const play = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.playAsync();
      setIsPlaying(true);
    } catch (error) {
      console.error('useLessonAudioPlayer play error:', error);
    }
  }, []);

  const pause = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    } catch (error) {
      console.error('useLessonAudioPlayer pause error:', error);
    }
  }, []);

  const seekTo = useCallback(async (millis: number) => {
    if (!soundRef.current || !durationMillis) return;
    const clamped = Math.min(Math.max(millis, 0), durationMillis);
    setPositionMillis(clamped);
    await soundRef.current.setPositionAsync(clamped);
  }, [durationMillis]);

  const seekBy = useCallback(async (deltaMillis: number) => {
    await seekTo(positionMillis + deltaMillis);
  }, [positionMillis, seekTo]);

  const cycleRate = useCallback(async () => {
    if (!soundRef.current) return;
    const currentIndex = RATE_STEPS.indexOf(rate);
    const nextRate = RATE_STEPS[(currentIndex + 1) % RATE_STEPS.length];
    try {
      await soundRef.current.setRateAsync(nextRate, true);
      setRateState(nextRate);
    } catch (error) {
      console.error('useLessonAudioPlayer setRate error:', error);
    }
  }, [rate]);

  return {
    isLoading,
    isPlaying,
    positionMillis,
    durationMillis,
    rate,
    play,
    pause,
    seekTo,
    seekBy,
    cycleRate,
  };
}
