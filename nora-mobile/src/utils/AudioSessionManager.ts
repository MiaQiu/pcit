import { NativeModules, NativeEventEmitter, Platform, EmitterSubscription } from 'react-native';

const { AudioSessionManager } = NativeModules;

// Create event emitter for iOS
let eventEmitter: NativeEventEmitter | null = null;
if (Platform.OS === 'ios' && AudioSessionManager) {
  eventEmitter = new NativeEventEmitter(AudioSessionManager);
}

export interface RecordingResult {
  uri: string;
  durationMillis: number;
}

export interface RecordingStatus {
  isRecording: boolean;
  durationMillis: number;
}

export const configureAudioSessionForRecording = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    return true; // No-op for non-iOS platforms
  }

  try {
    await AudioSessionManager.configureAudioSessionForRecording();
    console.log('[AudioSessionManager] Successfully configured for recording');
    return true;
  } catch (error) {
    console.error('[AudioSessionManager] Failed to configure:', error);
    throw error;
  }
};

export const setCompletionSound = (soundName: string): void => {
  if (Platform.OS !== 'ios') {
    return;
  }
  AudioSessionManager.setCompletionSound(soundName);
  console.log('[AudioSessionManager] Completion sound set to:', soundName);
};

export const startRecording = async (autoStopSeconds: number = 0): Promise<{ uri: string; status: string }> => {
  if (Platform.OS !== 'ios') {
    throw new Error('Native recording only supported on iOS');
  }

  try {
    const result = await AudioSessionManager.startRecording(autoStopSeconds);
    console.log('[AudioSessionManager] Recording started:', result.uri, 'with auto-stop:', autoStopSeconds, 'seconds');
    return result;
  } catch (error) {
    console.error('[AudioSessionManager] Failed to start recording:', error);
    throw error;
  }
};

export const stopRecording = async (): Promise<RecordingResult> => {
  if (Platform.OS !== 'ios') {
    throw new Error('Native recording only supported on iOS');
  }

  try {
    const result = await AudioSessionManager.stopRecording();
    console.log('[AudioSessionManager] Recording stopped. Duration:', result.durationMillis, 'ms');
    return result;
  } catch (error) {
    console.error('[AudioSessionManager] Failed to stop recording:', error);
    throw error;
  }
};

export const getRecordingStatus = async (): Promise<RecordingStatus> => {
  if (Platform.OS !== 'ios') {
    return { isRecording: false, durationMillis: 0 };
  }

  try {
    const status = await AudioSessionManager.getRecordingStatus();
    return status;
  } catch (error) {
    console.error('[AudioSessionManager] Failed to get status:', error);
    throw error;
  }
};

export const deactivateAudioSession = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios') {
    return true; // No-op for non-iOS platforms
  }

  try {
    await AudioSessionManager.deactivateAudioSession();
    console.log('[AudioSessionManager] Successfully deactivated');
    return true;
  } catch (error) {
    console.error('[AudioSessionManager] Failed to deactivate:', error);
    throw error;
  }
};

export const addAutoStopListener = (callback: (event: RecordingResult) => void): EmitterSubscription | null => {
  if (Platform.OS !== 'ios' || !eventEmitter) {
    return null;
  }

  console.log('[AudioSessionManager] Adding auto-stop listener');
  return eventEmitter.addListener('onRecordingAutoStopped', callback);
};

export const removeAutoStopListener = (subscription: EmitterSubscription | null) => {
  if (subscription) {
    console.log('[AudioSessionManager] Removing auto-stop listener');
    subscription.remove();
  }
};

export const getPendingRecording = async (): Promise<RecordingResult | null> => {
  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    const result = await AudioSessionManager.getPendingRecording();
    if (result && result.uri) {
      console.log('[AudioSessionManager] Found pending recording:', result.uri);
      return result as RecordingResult;
    }
    return null;
  } catch (error) {
    console.error('[AudioSessionManager] Failed to get pending recording:', error);
    return null;
  }
};

export const endBackgroundTask = async (): Promise<void> => {
  if (Platform.OS !== 'ios') {
    return;
  }

  try {
    await AudioSessionManager.endBackgroundTask();
    console.log('[AudioSessionManager] Background task ended');
  } catch (error) {
    console.error('[AudioSessionManager] Failed to end background task:', error);
  }
};
