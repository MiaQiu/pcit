import { NativeModules, Platform } from 'react-native';

const { AudioSessionManager } = NativeModules;

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

export const startRecording = async (): Promise<{ uri: string; status: string }> => {
  if (Platform.OS !== 'ios') {
    throw new Error('Native recording only supported on iOS');
  }

  try {
    const result = await AudioSessionManager.startRecording();
    console.log('[AudioSessionManager] Recording started:', result.uri);
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
