/**
 * LessonPlayerContext
 * App-wide "now playing" lesson narration player. Shared between the
 * LearnScreen_v3 mini-player and LessonViewerScreen_v2's full player so a
 * lesson started in one surface keeps its exact play/pause state and
 * position when the other surface mounts, instead of each owning an
 * independent expo-av Sound instance for the same audio.
 *
 * Also drives the app-wide GlobalLessonAudioBar (rendered in App.tsx), which
 * gives play/pause + stop for the active track on every other screen — so a
 * lesson opened from a coaching report's "Learn more" link can still be
 * stopped after navigating away from the viewer.
 */

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';

const RATE_STEPS = [1.0, 1.25, 1.5, 2.0];

/** Default playback speed when a lesson loads, before any manual cycling.
 * Chinese narration reads noticeably slower than English at 1.0x, so it
 * defaults faster; English still gets a slight boost over "natural" pace. */
function defaultRateForLocale(locale: string | null | undefined): number {
  if (locale === 'zh-CN' || locale === 'zh-TW') return 1.25;
  return 1.1;
}

interface LessonPlayerContextValue {
  activeLessonId: string | null;
  /** Display title of the active track — surfaced by the app-wide audio bar
   * (GlobalLessonAudioBar) on screens that don't have their own player UI. */
  activeLessonTitle: string | null;
  isLoading: boolean;
  isPlaying: boolean;
  positionMillis: number;
  durationMillis: number;
  rate: number;
  /** Switch the active track. No-ops if `lessonId` is already the active
   * track, so mounting a screen for the lesson that's already playing
   * elsewhere just attaches to the existing state instead of restarting it. */
  loadLesson: (lessonId: string, audioUrl: string | null | undefined, locale?: string | null, title?: string | null) => void;
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
  /** True while a focused screen has its own player controls for the active
   * track (LearnScreen_v3 / LessonViewerScreen_v2). The app-wide
   * GlobalLessonAudioBar hides itself in that case so controls never double
   * up. Screens toggle it via `setScreenOwnsPlayer` from a useFocusEffect. */
  screenOwnsPlayer: boolean;
  setScreenOwnsPlayer: (owns: boolean) => void;
}

const LessonPlayerContext = createContext<LessonPlayerContextValue | null>(null);

export const LessonPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [activeLessonTitle, setActiveLessonTitle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const [rate, setRateState] = useState(1.0);
  const [screenOwnsPlayer, setScreenOwnsPlayerState] = useState(false);
  // Ref-counted so a brief overlap during a screen transition (old screen's
  // cleanup runs after the new screen's setup) can't wrongly reveal the bar.
  const ownerCountRef = useRef(0);

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

  const loadLesson = useCallback((lessonId: string, audioUrl: string | null | undefined, locale?: string | null, title?: string | null) => {
    if (activeLessonIdRef.current === lessonId) return;
    activeLessonIdRef.current = lessonId;
    setActiveLessonId(lessonId);
    setActiveLessonTitle(title ?? null);

    const token = ++loadTokenRef.current;
    const initialRate = defaultRateForLocale(locale);
    setIsPlaying(false);
    positionRef.current = 0;
    setPositionMillis(0);
    durationRef.current = 0;
    setDurationMillis(0);
    setRateState(initialRate);

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
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: false },
          onPlaybackStatusUpdate
        );
        if (token !== loadTokenRef.current) {
          sound.unloadAsync();
          return;
        }
        soundRef.current = sound;
        // Setting a non-1.0 rate in the initial createAsync status plays back
        // garbled on iOS (pitch correction isn't wired up yet at creation
        // time) — set it explicitly after load, then start playback.
        if (initialRate !== 1.0) {
          await sound.setRateAsync(initialRate, true);
        }
        await sound.playAsync();
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
    setActiveLessonTitle(null);
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

  const setScreenOwnsPlayer = useCallback((owns: boolean) => {
    ownerCountRef.current = Math.max(0, ownerCountRef.current + (owns ? 1 : -1));
    setScreenOwnsPlayerState(ownerCountRef.current > 0);
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
        activeLessonTitle,
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
        screenOwnsPlayer,
        setScreenOwnsPlayer,
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
