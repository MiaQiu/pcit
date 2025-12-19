/**
 * Upload Processing Context
 * Manages background upload and processing state that persists across navigation
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRecordingService, useAuthService } from './AppContext';
import { sendNewReportNotification } from '../utils/notifications';

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
          // Resume polling
          pollForAnalysisCompletion(data.recordingId);
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

      // Proactively refresh token before upload to avoid expiration issues
      if (!isRetry) {
        console.log('[UploadProcessing] Refreshing access token before upload...');
        await authService.refreshAccessToken();
      }

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
              resolve(response.recordingId);
            } catch (error) {
              reject(new Error('Invalid response from server'));
            }
          } else if (xhr.status === 401) {
            // Token expired or invalid
            reject(new Error('UNAUTHORIZED'));
          } else {
            try {
              const error = JSON.parse(xhr.responseText);
              reject(new Error(error.details || error.error || 'Upload failed'));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        // Open connection
        xhr.open('POST', `${API_URL}/api/recordings/upload`);

        // Add Authorization header
        const token = authService.getAccessToken();
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        } else {
          reject(new Error('No authentication token available'));
          return;
        }

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
      uploadXhrRef.current = null;

      // If unauthorized and not already a retry, refresh token and retry once
      if (error.message === 'UNAUTHORIZED' && !isRetry) {
        console.log('[UploadProcessing] Token expired, refreshing and retrying...');
        const refreshed = await authService.refreshAccessToken();
        if (refreshed) {
          // Retry upload with refreshed token
          return uploadRecording(uri, durationSeconds, true);
        } else {
          // Reset state
          await reset();
          throw new Error('Session expired. Please log in again.');
        }
      }

      // Reset state
      await reset();

      // Notify user of error
      throw error;
    }
  };

  const pollForAnalysisCompletion = async (recordingId: string, attempt: number = 0) => {
    console.log(`[UploadProcessing] Polling attempt ${attempt + 1}/40 for recording ${recordingId}`);
    const maxAttempts = 40; // 40 attempts * 3 seconds = 2 minutes max

    if (attempt >= maxAttempts) {
      console.log('[UploadProcessing] Timeout - completing process');
      await reset();
      if (onNavigateToHome) {
        onNavigateToHome();
      }
      return;
    }

    try {
      // Check if analysis is complete
      console.log('[UploadProcessing] Calling getAnalysis...');
      const analysis = await recordingService.getAnalysis(recordingId);

      // If we got the analysis successfully, send notification if enabled
      console.log('[UploadProcessing] Analysis complete!');

      // Check if new report notifications are enabled
      try {
        const prefsJson = await AsyncStorage.getItem('@notification_preferences');
        if (prefsJson) {
          const prefs = JSON.parse(prefsJson);
          if (prefs.newReportNotification !== false) {
            // Send notification
            await sendNewReportNotification('play session');
            console.log('[UploadProcessing] New report notification sent');
          }
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
      // If still processing or transcribing, wait and try again
      const errorMsg = error.message.toLowerCase();
      console.log(`[UploadProcessing] Error: ${error.message}`);
      if (errorMsg.includes('processing') || errorMsg.includes('transcription') || errorMsg.includes('in progress')) {
        console.log(`[UploadProcessing] Still processing, will retry in 3s (attempt ${attempt + 1}/${maxAttempts})`);
        const timeout = setTimeout(() => {
          pollForAnalysisCompletion(recordingId, attempt + 1);
        }, 3000);
        pollTimeoutRef.current = timeout;
      } else {
        // Other error - reset and navigate anyway
        console.error('[UploadProcessing] Unexpected error - completing process:', error);
        await reset();
        if (onNavigateToHome) {
          onNavigateToHome();
        }
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
