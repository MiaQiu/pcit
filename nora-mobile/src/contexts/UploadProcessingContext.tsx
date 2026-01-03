/**
 * Upload Processing Context
 * Manages background upload and processing state that persists across navigation
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
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

    // Cleanup on unmount
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
      if (uploadXhrRef.current) {
        uploadXhrRef.current.abort();
      }
    };
  }, []);

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
              // Still processing - resume polling
              console.log('[UploadProcessing] Recording still processing, resuming polling');
              pollForAnalysisCompletion(data.recordingId);
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
      console.log('[UploadProcessing] Uploading...', { uri, durationSeconds, isRetry });

      // Verify we have an access token before attempting upload
      const accessToken = authService.getAccessToken();
      if (!accessToken) {
        console.error('[UploadProcessing] No access token available - session may have expired');
        await reset();
        // Don't throw error - if tokens were cleared, session expired callback already triggered
        // If user was never authenticated, they shouldn't have reached this screen
        return;
      }

      // Log token info for debugging (mask token for security)
      const tokenPreview = accessToken ? `${accessToken.substring(0, 20)}...${accessToken.substring(accessToken.length - 10)}` : 'null';
      console.log('[UploadProcessing] Access token verified, proceeding with upload');
      console.log('[UploadProcessing] Token preview:', tokenPreview);
      console.log('[UploadProcessing] Token length:', accessToken?.length);

      // Create FormData
      const formData = new FormData();

      // Add audio file
      const filename = uri.split('/').pop() || 'recording.m4a';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `audio/${match[1]}` : 'audio/m4a';

      formData.append('audio', {
        uri: uri,
        name: filename,
        type: type,
      } as any);

      formData.append('durationSeconds', durationSeconds.toString());

      // Upload with progress tracking using XMLHttpRequest
      const uploadPromise = new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        uploadXhrRef.current = xhr;
        let uploadCompleted = false; // ✅ Track if upload already succeeded

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
            console.log('[UploadProcessing] Upload progress:', progress + '%');

            // Save progress to storage
            saveState({
              state: 'uploading',
              recordingId: null,
              uploadProgress: progress,
              recordingUri: uri,
              durationSeconds,
            });
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 201) {
            try {
              const response = JSON.parse(xhr.responseText);
              console.log('[UploadProcessing] Upload successful:', response);
              uploadCompleted = true; // ✅ Mark as completed
              resolve(response.recordingId);
            } catch (error) {
              reject(new ApiError('Invalid response from server', 500, 'Internal Server Error'));
            }
          } else if (xhr.status === 401) {
            // Token expired or invalid - log details for debugging
            console.error('[UploadProcessing] 401 Unauthorized received');
            console.error('[UploadProcessing] Response:', xhr.responseText);
            console.error('[UploadProcessing] Token was sent:', !!accessToken);
            console.error('[UploadProcessing] Is retry:', isRetry);
            reject(new ApiError('Unauthorized', 401, 'Unauthorized', 'UNAUTHORIZED'));
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              reject(new ApiError(
                errorResponse.details || errorResponse.error || 'Upload failed',
                xhr.status,
                xhr.statusText,
                errorResponse.code
              ));
            } catch {
              reject(new ApiError(`Upload failed with status ${xhr.status}`, xhr.status, xhr.statusText));
            }
          }
        });

        xhr.addEventListener('error', () => {
          // ✅ Only reject if upload hasn't completed yet
          if (!uploadCompleted) {
            console.error('[UploadProcessing] Network error during upload');
            // Network errors don't have HTTP status, use TypeError name for detection
            const networkError = new Error('Network error during upload');
            networkError.name = 'TypeError';
            reject(networkError);
          } else {
            console.log('[UploadProcessing] Ignoring error event - upload already completed successfully');
          }
        });

        xhr.addEventListener('abort', () => {
          // ✅ Only reject if upload hasn't completed yet
          if (!uploadCompleted) {
            reject(new Error('Upload cancelled'));
          } else {
            console.log('[UploadProcessing] Ignoring abort event - upload already completed successfully');
          }
        });

        // Open connection
        xhr.open('POST', `${API_URL}/api/recordings/upload`);

        // Add Authorization header (token already verified at function start)
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

        xhr.send(formData);
      });

      const uploadedRecordingId = await uploadPromise;
      setRecordingId(uploadedRecordingId);
      uploadXhrRef.current = null;

      console.log('[UploadProcessing] Upload complete, recording ID:', uploadedRecordingId);

      // Show processing state and poll for analysis completion
      setState('processing');
      await saveState({
        state: 'processing',
        recordingId: uploadedRecordingId,
        uploadProgress: 100,
      });

      // Poll for analysis completion
      pollForAnalysisCompletion(uploadedRecordingId);

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
          // Retry upload with refreshed token
          return uploadRecording(uri, durationSeconds, true);
        } else {
          // Refresh failed - session expired callback already triggered by authService
          console.log('[UploadProcessing] Token refresh failed - resetting upload state');
          await reset();
          // Don't throw error - session expired callback already handles user notification
          return;
        }
      } else if (error.status === 401) {
        // 401 error but condition didn't match - log why
        console.error('[UploadProcessing] 401 error but token refresh not triggered:');
        console.error('[UploadProcessing] - error.code:', error.code, '(expected: UNAUTHORIZED)');
        console.error('[UploadProcessing] - isRetry:', isRetry, '(expected: false)');
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
