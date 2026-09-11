import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as HapticEngine from 'haptic-engine';

interface BuzzRampOptions {
  duration?: number; // Total duration in ms before resolution
  minDelay?: number;  // Starting delay between ticks (ms) — discrete fallback only
  maxDelay?: number;  // Ending delay between ticks (ms - faster) — discrete fallback only
  startIntensity?: number; // 0-1 — native continuous ramp only (iOS Core Haptics)
  endIntensity?: number;   // 0-1
  startSharpness?: number; // 0-1 ("roundness" -> "sharpness" of the buzz)
  endSharpness?: number;   // 0-1
}

// Escalating haptic buzz for a "building anticipation" moment (e.g. a spin
// winding down before a reveal).
//
// Prefers a genuinely continuous, amplitude/sharpness-ramped buzz via the
// local `haptic-engine` module (iOS Core Haptics — see
// modules/haptic-engine/ios/HapticEngineModule.swift) on hardware that
// supports it. Everywhere else (Android, older iPhones without a Taptic
// Engine capable of Core Haptics, Simulator), expo-haptics has no
// continuous/variable-intensity vibration API, so this falls back to faking
// the ramp with a self-scheduling loop of discrete pulses whose type
// escalates and whose spacing tightens as elapsed time approaches
// `duration` — recomputing the delay from actual elapsed time each tick
// (rather than a precomputed fixed schedule) keeps it self-correcting
// against setTimeout drift.
export const useAnticipationBuzz = () => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const usingNativeRef = useRef(false);

  const triggerStep = useCallback((progress: number) => {
    if (Platform.OS === 'ios') {
      // iOS: Escalating from Soft -> Light -> Medium -> Heavy
      if (progress < 0.35) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
      } else if (progress < 0.7) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (progress < 0.9) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    } else if (Platform.OS === 'android') {
      // Android: native haptic constants, avoids needing the VIBRATE permission.
      if (progress < 0.5) {
        Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Clock_Tick);
      } else if (progress < 0.85) {
        Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick);
      } else {
        Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Frequent_Tick);
      }
    }
  }, []);

  const stopBuzz = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (usingNativeRef.current) {
      usingNativeRef.current = false;
      HapticEngine.stop().catch(() => {});
    }
  }, []);

  const startDiscreteFallback = useCallback((duration: number, minDelay: number, maxDelay: number) => {
    const startTime = Date.now();

    const loop = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      triggerStep(progress);

      if (progress < 1) {
        // Linear ease-in curve to shorten delay over time
        const currentDelay = minDelay - (minDelay - maxDelay) * progress;
        timerRef.current = setTimeout(loop, currentDelay);
      }
    };

    loop();
  }, [triggerStep]);

  const startBuzz = useCallback((options: BuzzRampOptions = {}) => {
    const {
      duration = 800,
      minDelay = 70,
      maxDelay = 20,
      startIntensity = 0.25,
      endIntensity = 1,
      startSharpness = 0.25,
      endSharpness = 0.75,
    } = options;

    stopBuzz();

    if (Platform.OS === 'ios' && HapticEngine.supportsHaptics()) {
      usingNativeRef.current = true;
      HapticEngine.playRamp(duration, startIntensity, endIntensity, startSharpness, endSharpness).catch(() => {
        // Fall back to the discrete simulation if the native ramp fails to start.
        usingNativeRef.current = false;
        startDiscreteFallback(duration, minDelay, maxDelay);
      });
      return;
    }

    startDiscreteFallback(duration, minDelay, maxDelay);
  }, [stopBuzz, startDiscreteFallback]);

  useEffect(() => {
    return () => stopBuzz();
  }, [stopBuzz]);

  return { startBuzz, stopBuzz };
};
