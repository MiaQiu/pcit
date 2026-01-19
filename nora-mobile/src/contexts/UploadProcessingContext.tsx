/**
 * Upload Processing Context
 * Manages background upload and processing state that persists across navigation
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AppState, Alert } from 'react-native';
import { useRecordingService, useAuthService } from './AppContext';
import { handleApiError, ApiError } from '../utils/NetworkMonitor';
import { ErrorMessages } from '../utils/errorMessages';
import amplitudeService from '../services/amplitudeService';

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
  onNavigateToReport?: (recordingId: string) => void;
}

export const UploadProcessingProvider: React.FC<UploadProcessingProviderProps> = ({
  children,
  onNavigateToHome,
  onNavigateToReport
}) => {
  const recordingService = useRecordingService();
  const authService = useAuthService();
  const [state, setState] = useState<ProcessingState>('idle');
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [reportCompletedTimestamp, setReportCompletedTimestamp] = useState<number | null>(null);

  const uploadXhrRef = useRef<XMLHttpRequest | null>(null);
  const recordingIdRef = useRef(recordingId);

  // Update ref when recordingId changes (to avoid stale closures)
  useEffect(() => {
    recordingIdRef.current = recordingId;
  }, [recordingId]);

  // Load saved state on mount
  useEffect(() => {
    loadState();

    // Cleanup on unmount
    return () => {
      if (uploadXhrRef.current) {
        uploadXhrRef.current.abort();
      }
    };
  }, []);

  // Handle push notifications (works in both foreground and background)
  useEffect(() => {
    console.log('[UploadProcessing] Setting up push notification listener');

    const subscription = Notifications.addNotificationReceivedListener(async (notification) => {
      console.log('[UploadProcessing] Notification received:', notification);

      try {
        const notificationData = notification.request.content.data || {};
        const { type, recordingId: notificationRecordingId, error } = notificationData;
        const errorMessage = typeof error === 'string' ? error : 'Unknown error';

        // Check if this notification is for our current recording
        if (notificationRecordingId === recordingIdRef.current) {
          if (type === 'new_report') {
            // Success: Report ready
            console.log('[UploadProcessing] Report ready notification received for current recording');

            // Update timestamp to notify subscribers (e.g., HomeScreen)
            setReportCompletedTimestamp(Date.now());

            // Clear processing state
            await reset();
            console.log('[UploadProcessing] State reset completed after new_report notification');
          } else if (type === 'report_failed') {
            // Failure: Report generation failed
            console.log('[UploadProcessing] Report failed notification received for current recording');

            // Clear processing state
            await reset();
            console.log('[UploadProcessing] State reset completed after report_failed notification');

            // Show error alert to user
            const Alert = require('react-native').Alert;
            const userFriendlyMessage = getUserFriendlyErrorMessage(errorMessage);
            Alert.alert(
              'Unable to Generate Report',
              userFriendlyMessage,
              [{ text: 'OK', onPress: () => onNavigateToHome?.() }]
            );
          }
        }
      } catch (error) {
        console.error('[UploadProcessing] Error handling notification:', error);
        // Even if there's an error, try to reset state to prevent getting stuck
        try {
          await reset();
        } catch (resetError) {
          console.error('[UploadProcessing] Error during reset in notification handler:', resetError);
        }
      }
    });

    return () => {
      console.log('[UploadProcessing] Removing push notification listener');
      subscription.remove();
    };
  }, []); // Only run once on mount

  // Handle app state changes - check processing status when app comes to foreground
  useEffect(() => {
    console.log('[UploadProcessing] Setting up AppState listener');

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      console.log('[UploadProcessing] AppState changed to:', nextAppState);

      // When app comes to foreground and we're processing, check if report is ready
      if (nextAppState === 'active' && state === 'processing' && recordingIdRef.current) {
        console.log('[UploadProcessing] App came to foreground while processing, checking report status...');

        try {
          // Try to get the analysis - if successful, report is ready
          const analysis = await recordingService.getAnalysis(recordingIdRef.current);
          console.log('[UploadProcessing] Report is ready! Updating state...');

          // Update timestamp to notify subscribers (e.g., HomeScreen)
          setReportCompletedTimestamp(Date.now());

          // Clear processing state
          await reset();
        } catch (error: any) {
          // Check if it's a permanent failure
          const isFailed = error.status === 'failed' ||
                         error.message?.toLowerCase().includes('report generation failed') ||
                         error.message?.toLowerCase().includes('analysis failed');

          if (isFailed) {
            // Recording has permanently failed - show error to user
            console.log('[UploadProcessing] Recording permanently failed:', error.message);
            await reset();

            // Show error alert with user-friendly message
            const Alert = require('react-native').Alert;
            const userFriendlyMessage = getUserFriendlyErrorMessage(
              error.userMessage || error.message || 'Unknown error'
            );
            Alert.alert(
              'Unable to Generate Report',
              userFriendlyMessage,
              [{ text: 'OK', onPress: () => onNavigateToHome?.() }]
            );
          } else {
            // Still processing - continue waiting for push notification
            console.log('[UploadProcessing] Report still processing, will wait for notification');
          }
        }
      }
    });

    return () => {
      console.log('[UploadProcessing] Removing AppState listener');
      subscription.remove();
    };
  }, [state]); // Re-run when state changes

  // Polling fallback for users without push notifications
  // This ensures the UI updates even if push notifications aren't delivered
  useEffect(() => {
    if (state !== 'processing' || !recordingIdRef.current) {
      return;
    }

    console.log('[UploadProcessing] Starting polling fallback for processing state');

    const pollForStatus = async () => {
      if (!recordingIdRef.current) return;

      try {
        console.log('[UploadProcessing] Polling for report status...');
        const analysis = await recordingService.getAnalysis(recordingIdRef.current);

        // Success - report is ready
        console.log('[UploadProcessing] Polling: Report is ready!');
        const completedRecordingId = recordingIdRef.current;
        setReportCompletedTimestamp(Date.now());
        await reset();

        // Show alert only if app is in the foreground
        if (AppState.currentState === 'active' && completedRecordingId) {
          Alert.alert(
            'Report Ready!',
            'Your play session report is ready to view.',
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Read Report',
                onPress: () => onNavigateToReport?.(completedRecordingId)
              }
            ]
          );
        }
      } catch (error: any) {
        // Check if it's a permanent failure
        const isFailed = error.status === 'failed' ||
                        error.message?.toLowerCase().includes('report generation failed') ||
                        error.message?.toLowerCase().includes('analysis failed');

        if (isFailed) {
          // Recording has permanently failed - show error to user
          console.log('[UploadProcessing] Polling: Recording permanently failed:', error.message);
          await reset();

          // Show error alert with user-friendly message
          const Alert = require('react-native').Alert;
          const userFriendlyMessage = getUserFriendlyErrorMessage(
            error.userMessage || error.message || 'Unknown error'
          );
          Alert.alert(
            'Unable to Generate Report',
            userFriendlyMessage,
            [{ text: 'OK', onPress: () => onNavigateToHome?.() }]
          );
        } else {
          // Still processing - continue polling
          console.log('[UploadProcessing] Polling: Still processing, will check again...');
        }
      }
    };

    // Poll every 10 seconds
    const pollInterval = setInterval(pollForStatus, 10000);

    // Also poll immediately on mount (in case report finished between state changes)
    pollForStatus();

    return () => {
      console.log('[UploadProcessing] Stopping polling fallback');
      clearInterval(pollInterval);
    };
  }, [state]);

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
          // Check if recording has completed or permanently failed
          try {
            const analysis = await recordingService.getAnalysis(data.recordingId);
            // If we got analysis successfully, recording already complete
            console.log('[UploadProcessing] Recording already completed, clearing state');
            setReportCompletedTimestamp(Date.now());
            await reset();
          } catch (error: any) {
            // Check if it's a permanent failure
            const isFailed = error.status === 'failed' ||
                           error.message?.toLowerCase().includes('report generation failed') ||
                           error.message?.toLowerCase().includes('analysis failed');

            if (isFailed) {
              // Recording has permanently failed - show error to user
              console.log('[UploadProcessing] Recording permanently failed, showing error:', error.message);
              await reset();

              // Show error alert with user-friendly message
              const Alert = require('react-native').Alert;
              const userFriendlyMessage = getUserFriendlyErrorMessage(
                error.userMessage || error.message || 'Unknown error'
              );
              Alert.alert(
                'Unable to Generate Report',
                userFriendlyMessage,
                [{ text: 'OK', onPress: () => onNavigateToHome?.() }]
              );
            } else {
              // Still processing - keep processing state, will be notified via push
              console.log('[UploadProcessing] Recording still processing, waiting for push notification');
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
    // Prevent duplicate uploads - if already uploading or processing, ignore this call
    if (state === 'uploading' || state === 'processing') {
      console.log('[UploadProcessing] Upload already in progress, ignoring duplicate call', { currentState: state });
      return;
    }

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

        // Track recording uploaded
        amplitudeService.trackRecordingUploaded(sessionId, durationSeconds, {
          source: 'record_tab',
        });
      } catch (completeError: any) {
        console.error('[UploadProcessing] Failed to confirm upload:', completeError);
        throw completeError;
      }

      // Show processing state - will be notified via push when complete
      setState('processing');
      await saveState({
        state: 'processing',
        recordingId: sessionId,
        uploadProgress: 100,
      });

      console.log('[UploadProcessing] Waiting for push notification when analysis completes...');

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

  const reset = async () => {
    console.log('[UploadProcessing] Resetting state - clearing processing state and storage');

    // Abort any ongoing upload
    if (uploadXhrRef.current) {
      uploadXhrRef.current.abort();
      uploadXhrRef.current = null;
    }

    setState('idle');
    setRecordingId(null);
    setUploadProgress(0);
    console.log('[UploadProcessing] State set to idle, recordingId and progress cleared');

    // Clear storage
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      console.log('[UploadProcessing] AsyncStorage cleared successfully');
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
