import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

interface HapticEngineNativeModule {
  supportsHaptics(): boolean;
  playRamp(
    durationMs: number,
    startIntensity: number,
    endIntensity: number,
    startSharpness: number,
    endSharpness: number
  ): Promise<void>;
  stop(): Promise<void>;
}

// iOS-only native module (Core Haptics). `requireNativeModule` throws
// synchronously if the native side isn't linked into the currently-running
// binary yet (e.g. a dev-client build from before this module existed) —
// since this runs at JS-bundle-evaluation time, an unguarded throw here
// crashes the whole app before React even mounts. Swallow it so a stale
// binary just falls back to `null` (supportsHaptics() -> false) until a
// fresh native build picks up the module.
function resolveNativeModule(): HapticEngineNativeModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    return requireNativeModule<HapticEngineNativeModule>('HapticEngine');
  } catch {
    return null;
  }
}

const nativeModule: HapticEngineNativeModule | null = resolveNativeModule();

export function supportsHaptics(): boolean {
  try {
    return nativeModule?.supportsHaptics() ?? false;
  } catch {
    return false;
  }
}

// Plays one continuous, amplitude-and-sharpness-ramped buzz over `durationMs`
// via iOS Core Haptics — a genuinely continuous vibration, not a train of
// discrete taps (see modules/haptic-engine/ios/HapticEngineModule.swift for
// why expo-haptics alone can't do this). No-ops (resolves immediately) if
// unsupported; callers wanting a fallback should check `supportsHaptics()`.
export async function playRamp(
  durationMs: number,
  startIntensity: number,
  endIntensity: number,
  startSharpness: number,
  endSharpness: number
): Promise<void> {
  if (!nativeModule) return;
  await nativeModule.playRamp(durationMs, startIntensity, endIntensity, startSharpness, endSharpness);
}

export async function stop(): Promise<void> {
  if (!nativeModule) return;
  await nativeModule.stop();
}
