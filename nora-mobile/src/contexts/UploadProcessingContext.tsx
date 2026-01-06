/**
 * Upload Processing Context
 * Manages background upload and processing state that persists across navigation
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRecordingService, useAuthService } from './AppContext';
import { sendNewReportNotification } from '../utils/notifications';
import { handleApiError, ApiError } from '../utils/NetworkMonitor';
import { ErrorMessages } from '../utils/errorMessages';

/**
 * Map technical backend error messages to user-friendly messages
 */
const getUserFriendlyErrorMessage = (technicalError: string): string => {
  const errorLower = technicalError.toLowerCase();

  // No speech detected / silent audio
  if (errorLower.includes('no utterances parsed') ||
      errorLower.includes('no speech detected') ||
      errorLower.includes('silent') ||
      errorLower.includes('unintelligible')) {
    return "We couldn't detect any speech in your recording. Please make sure you and your child are speaking during the session and try again.";
  }

  // No adult speaker identified
  if (errorLower.includes('no adult') ||
      errorLower.includes('no parent') ||
      errorLower.includes('adult speaker') ||
      errorLower.includes('identify adult') ||
      errorLower.includes('identify parent')) {
    return "We had trouble identifying the adult speaker in your recording. Please make sure you're speaking clearly during the play session and try again.";
  }

  // Transcription service errors
  if (errorLower.includes('elevenlabs') || errorLower.includes('deepgram')) {
    return "We had trouble processing your audio. Please try recording again.";
  }

  // Network/timeout errors
  if (errorLower.includes('timeout') || errorLower.includes('network')) {
    return "The upload took too long. Please check your internet connection and try recording again.";
  }

  // Audio quality issues
  if (errorLower.includes('audio quality') || errorLower.includes('corrupted')) {
    return "There was an issue with the audio quality. Please try recording again.";
  }

  // Generic fallback
  return "We had trouble analyzing your recording. Please try recording another session.";
};

type ProcessingState = 'idle' | 'uploading' | 'processing';

interface UploadProcessingData {
  state: ProcessingState;
  recordingId: string | null;
  uploadProgress: number;
  recordingUri?: string;
  durationSeconds?: number;
}

interface UploadProcessingContextType {
  state: ProcessingState;
  recordingId: string | null;
  uploadProgress: number;
  startUpload: (uri: string, durationSeconds: number) => Promise<void>;
  reset: () => void;
  isProcessing: boolean;
  reportCompletedTimestamp: number | null;
}

const UploadProcessingContext = createContext<UploadProcessingContextType | null>(null);

const STORAGE_KEY = '@upload_processing_state';

// Get API URL from environment
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface UploadProcessingProviderProps {
  children: ReactNode;
  onNavigateToHome?: () => void;
}

export const UploadProcessingProvider: React.FC<UploadProcessingProviderProps> = ({
  children,
  onNavigateToHome
}) => {
  const recordingService = useRecordingService();
  const authService = useAuthService();
  const [state, setState] = useState<ProcessingState>('idle');
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [reportCompletedTimestamp, setReportCompletedTimestamp] = useState<number | null>(null);

  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const uploadXhrRef = useRef<XMLHttpRequest | null>(null);

  // Load saved state on mount
  useEffect(() => {
    loadState();

    // Add AppState listener to immediately check for completion when app comes to foreground
    const appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      console.log('[UploadProcessing] AppState changed to:', nextAppState);

      // When app comes to foreground and we're processing, immediately check for completion
      if (nextAppState === 'active' && state === 'processing' && recordingId) {
        console.log('[UploadProcessing] App returned to foreground while processing, checking for completion...');

        // Cancel any pending poll timeout and check immediately
        if (pollTimeoutRef.current) {
          clearTimeout(pollTimeoutRef.current);
          pollTimeoutRef.current = null;
        }

        // Immediately poll for completion (with attempt=0 to restart backoff)
        pollForAnalysisCompletion(recordingId, 0);
      }
    });

    // Cleanup on unmount
    return () => {
      appStateSubscription.remove();
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
      if (uploadXhrRef.current) {
        uploadXhrRef.current.abort();
      }
    };
  }, [state, recordingId]);

  const loadState = async () => {
    try {
      const savedState = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedState) {
        const data: UploadProcessingData = JSON.parse(savedState);
        console.log('[UploadProcessing] Restored state:', data);

        setState(data.state);
        setRecordingId(data.recordingId);
        setUploadProgress(data.uploadProgress);

        // Resume processing if needed
        if (data.state === 'uploading' && data.recordingUri && data.durationSeconds !== undefined) {
          // Resume upload
          uploadRecording(data.recordingUri, data.durationSeconds);
        } else if (data.state === 'processing' && data.recordingId) {
          // Before resuming polling, check if recording has permanently failed
          try {
            const analysis = await recordingService.getAnalysis(data.recordingId);
            // If we got analysis successfully, no need to poll - already complete
            console.log('[UploadProcessing] Recording already completed, clearing state');
            await reset();
          } catch (error: any) {
            // Check if it's a permanent failure
            const isFailed = error.status === 'failed' ||
                           error.message?.toLowerCase().includes('report generation failed') ||
                           error.message?.toLowerCase().includes('analysis failed');

            if (isFailed) {
              // Recording has permanently failed - clear state instead of polling
              console.log('[UploadProcessing] Recording permanently failed, clearing state:', error.message);
              await reset();
            } else {
              // Still processing - resume polling immediately (attempt=0 to start fresh)
              console.log('[UploadProcessing] Recording still processing, resuming polling immediately');
              pollForAnalysisCompletion(data.recordingId, 0);
            }
          }
        }
      }
    } catch (error) {
      console.error('[UploadProcessing] Failed to load state:', error);
    }
  };

  const saveState = async (data: UploadProcessingData) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('[UploadProcessing] Failed to save state:', error);
    }
  };

  const startUpload = async (uri: string, durationSeconds: number) => {
    console.log('[UploadProcessing] Starting upload...', { uri, durationSeconds });
    setState('uploading');
    setUploadProgress(0);

    await saveState({
      state: 'uploading',
      recordingId: null,
      uploadProgress: 0,
      recordingUri: uri,
      durationSeconds,
    });

    await uploadRecording(uri, durationSeconds);
  };

  const uploadRecording = async (uri: string, durationSeconds: number, isRetry: boolean = false) => {
    try {
      console.log('[UploadProcessing] Starting presigned URL upload...', { uri, durationSeconds, isRetry });

      // Verify we have an access token before attempting upload
      const accessToken = authService.getAccessToken();
      if (!accessToken) {
        console.error('[UploadProcessing] No access token available - session may have expired');
        await reset();
        return;
      }

      // Extract file extension for MIME type
      const filename = uri.split('/').pop() || 'recording.m4a';
      const match = /\.(\w+)$/.exec(filename);
      const extension = match ? match[1] : 'm4a';
      const mimeType = `audio/${extension}`;

      // STEP 1: Initialize upload and get presigned URL
      console.log('[UploadProcessing] Step 1: Getting presigned URL...');
      let sessionId: string;
      let uploadUrl: string;
      let uploadKey: string;

      try {
        const initResponse = await fetch(`${API_URL}/api/recordings/upload/init`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            durationSeconds,
            mimeType
          })
        });

        if (!initResponse.ok) {
          const errorData = await initResponse.json().catch(() => ({}));
          if (initResponse.status === 401) {
            throw new ApiError('Unauthorized', 401, 'Unauthorized', 'UNAUTHORIZED');
          }
          throw new ApiError(
            errorData.details || errorData.error || 'Failed to initialize upload',
            initResponse.status,
            initResponse.statusText
          );
        }

        const initData = await initResponse.json();
        sessionId = initData.sessionId;
        uploadUrl = initData.uploadUrl;
        uploadKey = initData.uploadKey;

        console.log('[UploadProcessing] Presigned URL obtained for session:', sessionId.substring(0, 8));
        setRecordingId(sessionId);
      } catch (initError: any) {
        console.error('[UploadProcessing] Failed to get presigned URL:', initError);
        throw initError;
      }

      // STEP 2: Upload directly to S3 using presigned URL
      console.log('[UploadProcessing] Step 2: Uploading to S3...');
      const s3UploadPromise = new Promise<void>(async (resolve, reject) => {
        const xhr = new XMLHttpRequest();
        uploadXhrRef.current = xhr;
        let uploadCompleted = false;

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
            console.log('[UploadProcessing] S3 upload progress:', progress + '%');

            // Save progress to storage
            saveState({
              state: 'uploading',
              recordingId: sessionId,
              uploadProgress: progress,
              recordingUri: uri,
              durationSeconds,
            });
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            console.log('[UploadProcessing] S3 upload successful');
            uploadCompleted = true;
            resolve();
          } else {
            console.error('[UploadProcessing] S3 upload failed with status:', xhr.status);
            reject(new ApiError(
              `S3 upload failed with status ${xhr.status}`,
              xhr.status,
              xhr.statusText
            ));
          }
        });

        xhr.addEventListener('error', () => {
          if (!uploadCompleted) {
            console.error('[UploadProcessing] Network error during S3 upload');
            const networkError = new Error('Network error during S3 upload');
            networkError.name = 'TypeError';
            reject(networkError);
          }
        });

        xhr.addEventListener('abort', () => {
          if (!uploadCompleted) {
            reject(new Error('S3 upload cancelled'));
          }
        });

        // Prepare file for upload
        try {
          // Fetch the file as a blob
          const fileResponse = await fetch(uri);
          const fileBlob = await fileResponse.blob();

          // Upload to S3
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', mimeType);
          xhr.send(fileBlob);
        } catch (fileError: any) {
          reject(new Error(`Failed to read audio file: ${fileError.message}`));
        }
      });

      await s3UploadPromise;
      uploadXhrRef.current = null;
      setUploadProgress(100);

      // STEP 3: Notify backend that upload is complete
      console.log('[UploadProcessing] Step 3: Notifying backend of upload completion...');
      try {
        const completeResponse = await fetch(`${API_URL}/api/recordings/upload/complete`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            uploadKey
          })
        });

        if (!completeResponse.ok) {
          const errorData = await completeResponse.json().catch(() => ({}));
          if (completeResponse.status === 401) {
            throw new ApiError('Unauthorized', 401, 'Unauthorized', 'UNAUTHORIZED');
          }
          throw new ApiError(
            errorData.details || errorData.error || 'Failed to confirm upload',
            completeResponse.status,
            completeResponse.statusText
          );
        }

        console.log('[UploadProcessing] Upload confirmed, processing started');
      } catch (completeError: any) {
        console.error('[UploadProcessing] Failed to confirm upload:', completeError);
        throw completeError;
      }

      // Show processing state and poll for analysis completion
      setState('processing');
      await saveState({
        state: 'processing',
        recordingId: sessionId,
        uploadProgress: 100,
      });

      // Poll for analysis completion
      pollForAnalysisCompletion(sessionId);

    } catch (error: any) {
      console.error('[UploadProcessing] Upload failed:', error);
      console.error('[UploadProcessing] Error details:', {
        message: error.message,
        code: error.code,
        status: error.status,
        name: error.name
      });
      uploadXhrRef.current = null;

      // If unauthorized and not already a retry, refresh token and retry once
      if (error.code === 'UNAUTHORIZED' && !isRetry) {
        console.log('[UploadProcessing] Received 401, attempting token refresh...');
        const refreshed = await authService.refreshAccessToken();
        if (refreshed) {
          console.log('[UploadProcessing] Token refreshed successfully, retrying upload');
          return uploadRecording(uri, durationSeconds, true);
        } else {
          console.log('[UploadProcessing] Token refresh failed - resetting upload state');
          await reset();
          return;
        }
      }

      // Reset state
      await reset();

      // Notify user of error
      throw error;
    }
  };

  // Helper: Calculate exponential backoff delay
  const getBackoffDelay = (attempt: number): number => {
    // Start at 1s, increase by 1.5x each attempt, max 10s
    return Math.min(1000 * Math.pow(1.5, attempt), 10000);
  };

  const pollForAnalysisCompletion = async (recordingId: string, attempt: number = 0) => {
    console.log(`[UploadProcessing] Polling attempt ${attempt + 1}/40 for recording ${recordingId}`);
    const maxAttempts = 40;

    if (attempt >= maxAttempts) {
      console.log('[UploadProcessing] Polling timeout - still processing');
      await reset();
      const Alert = require('react-native').Alert;
      Alert.alert(
        'Still Processing',
        ErrorMessages.PROCESSING.TIMEOUT,
        [{ text: 'OK', onPress: () => onNavigateToHome?.() }]
      );
      return;
    }

    try {
      // Check if analysis is complete
      console.log('[UploadProcessing] Calling getAnalysis...');
      const analysis = await recordingService.getAnalysis(recordingId);

      // If we got the analysis successfully, send notification if enabled
      console.log('[UploadProcessing] Analysis complete!');

      // Update timestamp to notify subscribers (e.g., HomeScreen) that a new report is ready
      setReportCompletedTimestamp(Date.now());

      // Check if new report notifications are enabled
      try {
        console.log('[UploadProcessing] Checking notification preferences...');
        const prefsJson = await AsyncStorage.getItem('@notification_preferences');
        console.log('[UploadProcessing] Notification preferences:', prefsJson);

        if (prefsJson) {
          const prefs = JSON.parse(prefsJson);
          console.log('[UploadProcessing] Parsed preferences:', prefs);
          console.log('[UploadProcessing] newReportNotification setting:', prefs.newReportNotification);

          if (prefs.newReportNotification !== false) {
            console.log('[UploadProcessing] Sending new report notification...');
            await sendNewReportNotification('play session', recordingId);
            console.log('[UploadProcessing] New report notification sent successfully');
          } else {
            console.log('[UploadProcessing] New report notifications are disabled in preferences');
          }
        } else {
          console.log('[UploadProcessing] No notification preferences found, sending notification by default');
          await sendNewReportNotification('play session', recordingId);
          console.log('[UploadProcessing] New report notification sent successfully');
        }
      } catch (notifError) {
        console.error('[UploadProcessing] Failed to send notification:', notifError);
        // Don't block navigation if notification fails
      }

      // Clear state and navigate
      await reset();
      if (onNavigateToHome) {
        onNavigateToHome();
      }
    } catch (error: any) {
      // Better error logging - Error objects don't serialize well with JSON.stringify
      console.log(`[UploadProcessing] Caught error:`, {
        status: error.status,
        message: error.message,
        userMessage: error.userMessage,
        failedAt: error.failedAt,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n'), // First 3 lines of stack
      });

      // Check if analysis failed permanently (check both error.status and message)
      const isFailed = error.status === 'failed' ||
                       error.message?.toLowerCase().includes('report generation failed') ||
                       error.message?.toLowerCase().includes('analysis failed');

      if (isFailed) {
        console.error('[UploadProcessing] Analysis failed permanently:', error.message);
        await reset();
        // Show error alert to user with user-friendly message
        const Alert = require('react-native').Alert;
        const userFriendlyMessage = getUserFriendlyErrorMessage(
          error.userMessage || error.message || 'Unknown error'
        );
        Alert.alert(
          'Unable to Generate Report',
          userFriendlyMessage,
          [{ text: 'OK', onPress: () => onNavigateToHome?.() }]
        );
        return;
      }

      // If still processing or transcribing, wait and try again
      const errorMsg = (error.message || '').toLowerCase();
      if (errorMsg.includes('processing') || errorMsg.includes('transcription') || errorMsg.includes('in progress')) {
        const delay = getBackoffDelay(attempt);
        console.log(`[UploadProcessing] Still processing, will retry in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`);
        const timeout = setTimeout(() => {
          pollForAnalysisCompletion(recordingId, attempt + 1);
        }, delay);
        pollTimeoutRef.current = timeout;
      } else {
        // Permanent failure - show apology (system already auto-retried on backend)
        console.error('[UploadProcessing] Analysis failed permanently after auto-retries:', error);
        await reset();
        const Alert = require('react-native').Alert;
        const userFriendlyMessage = getUserFriendlyErrorMessage(
          error.userMessage || error.message || ErrorMessages.PROCESSING.FAILED
        );
        Alert.alert(
          'We Apologize',
          userFriendlyMessage,
          [{ text: 'OK', onPress: () => onNavigateToHome?.() }]
        );
      }
    }
  };

  const reset = async () => {
    console.log('[UploadProcessing] Resetting state');

    // Clear any pending timeouts
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }

    // Abort any ongoing upload
    if (uploadXhrRef.current) {
      uploadXhrRef.current.abort();
      uploadXhrRef.current = null;
    }

    setState('idle');
    setRecordingId(null);
    setUploadProgress(0);

    // Clear storage
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('[UploadProcessing] Failed to clear storage:', error);
    }
  };

  const value: UploadProcessingContextType = {
    state,
    recordingId,
    uploadProgress,
    startUpload,
    reset,
    isProcessing: state === 'uploading' || state === 'processing',
    reportCompletedTimestamp,
  };

  return (
    <UploadProcessingContext.Provider value={value}>
      {children}
    </UploadProcessingContext.Provider>
  );
};

export const useUploadProcessing = (): UploadProcessingContextType => {
  const context = useContext(UploadProcessingContext);
  if (!context) {
    throw new Error('useUploadProcessing must be used within UploadProcessingProvider');
  }
  return context;
};
