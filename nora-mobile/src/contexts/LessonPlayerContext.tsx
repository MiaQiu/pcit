/**
 * LessonPlayerContext
 * App-wide "now playing" lesson narration player. Shared between the
 * LearnScreen_v3 mini-player and LessonViewerScreen_v2's full player so a
 * lesson started in one surface keeps its exact play/pause state and
 * position when the other surface mounts, instead of each owning an
 * independent expo-av Sound instance for the same audio.
 */

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';

const RATE_STEPS = [1.0, 1.25, 1.5, 2.0];

interface LessonPlayerContextValue {
  activeLessonId: string | null;
  isLoading: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  rate: number;
  /** Switch the active track. No-ops if `lessonId` is already the active
   * track, so mounting a screen for the lesson that's already playing
   * elsewhere just attaches to the existing state instead of restarting it. */
  loadLesson: (lessonId: string, audioUrl: string | null | undefined) => void;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seekTo: (millis: number) => Promise<void>;
  seekBy: (deltaMillis: number) => Promise<void>;
  cycleRate: () => Promise<void>;
  clear: () => void;
  /** Whichever screen currently "owns" advancing to the next lesson
   * (typically the focused screen) registers its handler here; it's called
   * with the id of the lesson that just finished. */
  setOnFinish: (cb: ((lessonId: string) => void) | null) => void;
}

const LessonPlayerContext = createContext<LessonPlayerContextValue | null>(null);

export const LessonPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [rate, setRateState] = useState(1.0);

  const soundRef = useRef<Audio.Sound | null>(null);
  const activeLessonIdRef = useRef<string | null>(null);
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const onFinishRef = useRef<((lessonId: string) => void) | null>(null);
  const loadTokenRef = useRef(0);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    positionRef.current = status.positionMillis;
    setPositionMillis(status.positionMillis);
    durationRef.current = status.durationMillis ?? 0;
    setDurationMillis(status.durationMillis ?? 0);
    if (status.didJustFinish) {
      setIsPlaying(false);
      positionRef.current = 0;
      setPositionMillis(0);
      soundRef.current?.setPositionAsync(0);
      const finishedId = activeLessonIdRef.current;
      if (finishedId) onFinishRef.current?.(finishedId);
    }
  }, []);

  const loadLesson = useCallback((lessonId: string, audioUrl: string | null | undefined) => {
    if (activeLessonIdRef.current === lessonId) return;
    activeLessonIdRef.current = lessonId;
    setActiveLessonId(lessonId);

    const token = ++loadTokenRef.current;
    setIsPlaying(false);
    positionRef.current = 0;
    setPositionMillis(0);
    durationRef.current = 0;
    setDurationMillis(0);
    setRateState(1.0);

    (async () => {
      const prevSound = soundRef.current;
      soundRef.current = null;
      if (prevSound) await prevSound.unloadAsync().catch(() => {});

      if (!audioUrl) {
        if (token === loadTokenRef.current) setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        if (token !== loadTokenRef.current) {
          sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
        setIsPlaying(true);
      } catch (error) {
        console.error('LessonPlayerContext load error:', error);
      } finally {
        if (token === loadTokenRef.current) setIsLoading(false);
      }
    })();
  }, [onPlaybackStatusUpdate]);

  const clear = useCallback(() => {
    loadTokenRef.current += 1;
    activeLessonIdRef.current = null;
    setActiveLessonId(null);
    setIsPlaying(false);
    positionRef.current = 0;
    setPositionMillis(0);
    durationRef.current = 0;
    setDurationMillis(0);
    setIsLoading(false);
    const prevSound = soundRef.current;
    soundRef.current = null;
    prevSound?.unloadAsync().catch(() => {});
  }, []);

  const play = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.playAsync();
      setIsPlaying(true);
    } catch (error) {
      console.error('LessonPlayerContext play error:', error);
    }
  }, []);

  const pause = useCallback(async () => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
    } catch (error) {
      console.error('LessonPlayerContext pause error:', error);
    }
  }, []);

  const seekTo = useCallback(async (millis: number) => {
    if (!soundRef.current || !durationRef.current) return;
    const clamped = Math.min(Math.max(millis, 0), durationRef.current);
    positionRef.current = clamped;
    setPositionMillis(clamped);
    await soundRef.current.setPositionAsync(clamped);
  }, []);

  const seekBy = useCallback(async (deltaMillis: number) => {
    if (!soundRef.current || !durationRef.current) return;
    const clamped = Math.min(Math.max(positionRef.current + deltaMillis, 0), durationRef.current);
    positionRef.current = clamped;
    setPositionMillis(clamped);
    await soundRef.current.setPositionAsync(clamped);
  }, []);

  const cycleRate = useCallback(async () => {
    if (!soundRef.current) return;
    setRateState((current) => {
      const idx = RATE_STEPS.indexOf(current);
      const nextRate = RATE_STEPS[(idx + 1) % RATE_STEPS.length];
      soundRef.current
        ?.setRateAsync(nextRate, true)
        .catch((error) => console.error('LessonPlayerContext setRate error:', error));
      return nextRate;
    });
  }, []);

  const setOnFinish = useCallback((cb: ((lessonId: string) => void) | null) => {
    onFinishRef.current = cb;
  }, []);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  return (
    <LessonPlayerContext.Provider
      value={{
        activeLessonId,
        isLoading,
        isPlaying,
        positionMillis,
        durationMillis,
        rate,
        loadLesson,
        play,
        pause,
        seekTo,
        seekBy,
        cycleRate,
        clear,
        setOnFinish,
      }}
    >
      {children}
    </LessonPlayerContext.Provider>
  );
};

export function useLessonPlayer(): LessonPlayerContextValue {
  const ctx = useContext(LessonPlayerContext);
  if (!ctx) throw new Error('useLessonPlayer must be used within a LessonPlayerProvider');
  return ctx;
}
