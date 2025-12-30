/**
 * Record Screen
 * Audio recording screen for play sessions with PCIT skills tracking
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image, TouchableOpacity, ActivityIndicator, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { RootStackNavigationProp } from '../navigation/types';
import { RecordButton } from '../components/RecordButton';
import { RecordingTimer } from '../components/RecordingTimer';
import { ProfileCircle } from '../components/ProfileCircle';
//import { StreakWidget } from '../components/StreakWidget';
import { RecordingGuideCard } from '../components/RecordingGuideCard';
import { HowToRecordCard } from '../components/HowToRecordCard';
import { RecordingCard } from '../components/RecordingCard';
import { FONTS, COLORS, DRAGON_PURPLE, SOUNDS } from '../constants/assets';
import { useRecordingService, useAuthService } from '../contexts/AppContext';
import { useUploadProcessing } from '../contexts/UploadProcessingContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendNewReportNotification } from '../utils/notifications';
import { startRecording as startNativeRecording, stopRecording as stopNativeRecording, getRecordingStatus, addAutoStopListener, removeAutoStopListener, getPendingRecording, endBackgroundTask } from '../utils/AudioSessionManager';
import type { EmitterSubscription } from 'react-native';

type RecordingState = 'idle' | 'ready' | 'recording' | 'paused' | 'completed';

// Get API URL from environment
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export const RecordScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const recordingService = useRecordingService();
  const authService = useAuthService();
  const uploadProcessing = useUploadProcessing();
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [navigationTimeout, setNavigationTimeout] = useState<NodeJS.Timeout | null>(null);
  const [childName, setChildName] = useState<string>('your child');
  const [completionSound, setCompletionSound] = useState<string>('Win');

  // Use ref to track current recording for cleanup
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const autoStopListenerRef = useRef<EmitterSubscription | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    requestPermissions();
    loadUserData();
    loadSoundPreference();
    checkPendingRecording(); // Check for auto-stopped recordings on mount

    // Monitor app state changes for debugging and background task management
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      console.log('[AppState] Changed to:', nextAppState);

      // Check native recording status when app state changes
      try {
        const status = await getRecordingStatus();
        console.log('[AppState] Native recording status:', status);

        // CRITICAL: Stop duration polling when backgrounded to prevent CPU resource fatal
        if (nextAppState === 'background' && status.isRecording) {
          console.log('[AppState] App backgrounded while recording - STOPPING duration polling to save CPU');
          // Clear the duration interval to prevent excessive bridge calls
          if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
          }
        }

        // CRITICAL: Resume duration polling when returning to foreground
        if (nextAppState === 'active' && status.isRecording) {
          console.log('[AppState] App foregrounded while recording - RESUMING duration polling');
          // Restart the duration interval for UI updates
          startDurationPolling();
        }
      } catch (error) {
        console.log('[AppState] Could not get native recording status:', error);
      }

      // When app comes back to foreground, check for pending recordings
      if (nextAppState === 'active') {
        checkPendingRecording();
      }
    });

    // Cleanup on unmount only
    return () => {
      subscription.remove();
      // Clean up recording if component unmounts
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {
          // Ignore errors - recording may already be stopped
        });
      }
      // Clean up navigation timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Clean up auto-stop listener
      if (autoStopListenerRef.current) {
        removeAutoStopListener(autoStopListenerRef.current);
      }
      // Clean up duration interval
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      // Clean up sound
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {
          // Ignore errors
        });
      }
    };
  }, []);

  const loadUserData = async () => {
    try {
      const user = await authService.getCurrentUser();
      if (user.childName) {
        setChildName(user.childName);
      }
    } catch (error) {
      console.error('Failed to load user data:', error);
      // Keep default fallback value
    }
  };

  const loadSoundPreference = async () => {
    try {
      const prefsJson = await AsyncStorage.getItem('@notification_preferences');
      if (prefsJson) {
        const prefs = JSON.parse(prefsJson);
        if (prefs.cdiCompleteSound) {
          setCompletionSound(prefs.cdiCompleteSound);
        }
      }
    } catch (error) {
      console.error('Failed to load sound preference:', error);
      // Keep default 'Win' sound
    }
  };

  const playCompletionSound = async () => {
    try {
      console.log('[Sound] Playing completion sound:', completionSound);

      // Stop and unload previous sound if any
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // Map sound ID to actual sound file
      let soundSource;
      switch (completionSound) {
        case 'Win':
          soundSource = SOUNDS.Win;
          break;
        case 'Bell':
          soundSource = SOUNDS.Bell;
          break;
        default:
          soundSource = SOUNDS.Win;
      }

      // Create and play sound (audio session already configured by native module)
      const { sound } = await Audio.Sound.createAsync(
        soundSource,
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;

      console.log('[Sound] Completion sound playing');

      // Wait for sound to finish playing
      await new Promise<void>((resolve) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            console.log('[Sound] Completion sound finished');
            sound.unloadAsync();
            if (soundRef.current === sound) {
              soundRef.current = null;
            }
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('[Sound] Error playing completion sound:', error);
      // Don't block the upload if sound fails
    }
  };

  // When screen comes back into focus, check if we need to reset
  useFocusEffect(
    React.useCallback(() => {
      // Only reset if not currently uploading/processing in background
      if (!uploadProcessing.isProcessing && recordingState !== 'recording') {
        resetRecording();
      }
    }, [uploadProcessing.isProcessing, recordingState])
  );

  const requestPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      setPermissionGranted(status === 'granted');
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant microphone permission to record audio sessions.'
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  // Helper function to start duration polling (only runs in foreground)
  const startDurationPolling = () => {
    // Clear any existing interval first
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    // Start polling - ONLY when app is in foreground
    // This will be stopped when app backgrounds to prevent CPU resource fatal
    const durationInterval = setInterval(async () => {
      try {
        const status = await getRecordingStatus();
        if (status.isRecording) {
          setRecordingDuration(status.durationMillis);
        } else {
          if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
          }
        }
      } catch (error) {
        console.error('[RecordScreen] Error getting recording status:', error);
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
      }
    }, 500);

    durationIntervalRef.current = durationInterval as any;
    console.log('[RecordScreen] Started duration polling (foreground only)');
  };

  const startRecording = async () => {
    try {
      if (!permissionGranted) {
        await requestPermissions();
        return;
      }

      console.log('[RecordScreen] Starting native recording with 5-minute auto-stop...');

      // Set up auto-stop listener before starting recording
      if (autoStopListenerRef.current) {
        removeAutoStopListener(autoStopListenerRef.current);
      }
      autoStopListenerRef.current = addAutoStopListener((event) => {
        console.log('[RecordScreen] Auto-stop triggered by native module');
        handleAutoStop(event.uri, event.durationMillis);
      });

      // Start native recording with 5-minute (300 second) auto-stop
      const result = await startNativeRecording(300);
      console.log('[RecordScreen] Native recording started:', result.uri);

      setRecordingState('recording');

      // Start duration polling (will auto-stop when app backgrounds)
      startDurationPolling();
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const checkPendingRecording = async () => {
    try {
      const pendingRecording = await getPendingRecording();
      if (pendingRecording) {
        console.log('[RecordScreen] Found pending auto-stopped recording, processing...');
        await handleAutoStop(pendingRecording.uri, pendingRecording.durationMillis);
      }
    } catch (error) {
      console.error('[RecordScreen] Error checking pending recording:', error);
    }
  };

  const handleAutoStop = async (uri: string, durationMillis: number) => {
    try {
      // Clear duration update interval
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current as any);
        timeoutRef.current = null;
      }

      // Remove auto-stop listener
      if (autoStopListenerRef.current) {
        removeAutoStopListener(autoStopListenerRef.current);
        autoStopListenerRef.current = null;
      }

      const durationSeconds = Math.floor(durationMillis / 1000);

      console.log('[RecordScreen] Processing auto-stopped recording:', uri);
      console.log('[RecordScreen] Duration:', durationSeconds, 'seconds');

      // Reset local recording state
      setRecordingState('completed');

      // Play completion sound (don't await - let it play in background)
      playCompletionSound();

      // Upload to backend using the context (will run in background)
      if (uri) {
        try {
          await uploadProcessing.startUpload(uri, durationSeconds);
          // Upload completed successfully - end background task
          await endBackgroundTask();
        } catch (error) {
          console.error('Upload failed:', error);
          // End background task even on failure
          await endBackgroundTask();
          Alert.alert(
            'Upload Failed',
            error instanceof Error ? error.message : 'Failed to upload recording. Please try again.',
            [
              { text: 'Cancel', onPress: resetRecording, style: 'cancel' },
              {
                text: 'Retry',
                onPress: () => uploadProcessing.startUpload(uri, durationSeconds)
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('[RecordScreen] Error handling auto-stop:', error);
      // End background task on error
      await endBackgroundTask();
      Alert.alert('Error', 'Failed to process auto-stopped recording.');
      setRecordingState('completed');
    }
  };

  const stopRecording = async () => {
    try {
      // Clear duration update interval
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current as any);
        timeoutRef.current = null;
      }

      // Remove auto-stop listener
      if (autoStopListenerRef.current) {
        removeAutoStopListener(autoStopListenerRef.current);
        autoStopListenerRef.current = null;
      }

      // Stop native recording
      const result = await stopNativeRecording();
      const uri = result.uri;
      const durationSeconds = Math.floor(result.durationMillis / 1000);

      console.log('Recording saved to:', uri);
      console.log('Duration:', durationSeconds, 'seconds');

      // Reset local recording state
      setRecordingState('completed');

      // Play completion sound (don't await - let it play in background)
      playCompletionSound();

      // Upload to backend using the context (will run in background)
      if (uri) {
        try {
          await uploadProcessing.startUpload(uri, durationSeconds);
        } catch (error) {
          console.error('Upload failed:', error);
          Alert.alert(
            'Upload Failed',
            error instanceof Error ? error.message : 'Failed to upload recording. Please try again.',
            [
              { text: 'Cancel', onPress: resetRecording, style: 'cancel' },
              {
                text: 'Retry',
                onPress: () => uploadProcessing.startUpload(uri, durationSeconds)
              }
            ]
          );
        }
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording.');
      setRecordingState('completed');
    }
  };


  const resetRecording = () => {
    setRecordingState('idle');
    setRecordingDuration(0);
    // Clear any pending timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // Remove auto-stop listener
    if (autoStopListenerRef.current) {
      removeAutoStopListener(autoStopListenerRef.current);
      autoStopListenerRef.current = null;
    }
  };

  // handleViewReport removed - now navigates directly to home after recording

  const handleStartSession = async () => {
    // Start recording immediately
    await startRecording();
  };

  const handleStopRecording = async () => {
    await stopRecording();
  };

  const canStartSession = permissionGranted;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Recording Guide Card */}
        {recordingState === 'idle' && (
          <>
            {/* Header with Dragon Icon and Text */}
            <View style={styles.headerSection}>
              <View style={styles.dragonIconContainer}>
                <Image
                  source={require('../../assets/images/dragon_image.png')}
                  style={styles.dragonIcon}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.headerTextBox}>
                <Text style={styles.headerText}>Ready for a 5-minute play session with {childName}?</Text>
              </View>
            </View>

            <View style={styles.guideCardContainer}>
              <RecordingGuideCard />
            </View>

            {/* How to Record Card */}
            <View style={styles.howToCardContainer}>
              <HowToRecordCard />
            </View>
          </>
        )}

        {/* Recording Card - Show when recording */}
        {recordingState === 'recording' && (
          <View style={styles.recordingCardContainer}>
            <RecordingCard
              isRecording={true}
              durationMillis={recordingDuration}
            />
          </View>
        )}

        {/* Upload Progress */}
        {uploadProcessing.state === 'uploading' && (
          <View style={styles.uploadContainer}>
            <ActivityIndicator size="large" color={COLORS.textDark} />
            <Text style={styles.uploadText}>Uploading recording...</Text>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${uploadProcessing.uploadProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>{uploadProcessing.uploadProgress}%</Text>
          </View>
        )}

        {/* Processing State */}
        {uploadProcessing.state === 'processing' && (
          <View style={styles.processingContainer}>
            <View style={styles.dragonIconContainer}>
              <Image
                source={require('../../assets/images/dragon_image.png')}
                style={styles.dragonIcon}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.processingTitle}>Analyzing your play time…
This takes a few minutes.


</Text>
            <Text style={styles.processingSubtitle}>
               Nora is listening for patterns in praise, tone, and turn-taking to personalize your tips.
            </Text>
            <Text style={styles.processingSubtitle}>
             You can leave this screen — we’ll notify you when it’s ready.
            </Text>
            <ActivityIndicator size="large" color={COLORS.mainPurple} style={styles.processingSpinner} />
          </View>
        )}

        {/* Success State - Now navigates directly to home */}

        {!permissionGranted && recordingState === 'idle' && (
          <Text style={styles.permissionText}>
            Microphone permission required to record
          </Text>
        )}
      </ScrollView>

      {/* Fixed Bottom Action Buttons */}
      {recordingState === 'idle' && !uploadProcessing.isProcessing && (
        <View style={styles.fixedButtonContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleStartSession}
            disabled={!canStartSession}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>Start Session</Text>
            <Ionicons name="play" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {recordingState === 'recording' && !uploadProcessing.isProcessing && (
        <View style={styles.fixedButtonContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.stopButton]}
            onPress={handleStopRecording}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>Stop Recording</Text>
            <Ionicons name="stop" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
  },
  contentFillHeight: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  headerSection: {
    paddingTop: 24,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dragonIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#F5F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 26,
  },
  dragonIcon: {
    // width: '100%',
    // height: '100%',
    width: 90,
    height: 90,
    marginLeft: 25,
  },
  // itemIconContainer: {
  //   width: 50,
  //   height: 50,
  //   borderRadius: 25,
  //   overflow: 'hidden',
  //   backgroundColor: '#F5F0FF',
  //   justifyContent: 'center',
  //   alignItems: 'center',
  // },
  // itemIcon: {
  //   width: 90,
  //   height: 90,
  //   marginLeft: 25,
  // },

  
  headerTextBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 24,
    minHeight: 80,
  },
  headerText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#364153',
    lineHeight: 24,
  },
  guideCardContainer: {
    marginBottom: 24,
  },
  howToCardContainer: {
    marginBottom: 24,
  },
  recordingCardContainer: {
    marginTop: 24,
    marginBottom: 120,
  },
  buttonContainer: {
    marginTop: 'auto',
    paddingTop: 24,
  },
  fixedButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.textDark,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 100,
    gap: 8,
  },
  actionButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  stopButton: {
    backgroundColor: '#E74C3C',
  },
  permissionText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#E74C3C',
    textAlign: 'center',
    marginTop: 12,
  },
  uploadContainer: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  uploadText: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: COLORS.textDark,
    marginTop: 16,
    marginBottom: 24,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: COLORS.textDark,
    borderRadius: 4,
  },
  progressText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textDark,
    marginTop: 12,
  },
  processingContainer: {
    marginTop: 60,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  processingTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: COLORS.textDark,
    marginTop: 32,
    marginBottom: 16,
    textAlign: 'center',
  },
  processingSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  processingSpinner: {
    marginTop: 16,
  },
  successContainer: {
    marginTop: 40,
    paddingHorizontal: 0,
    marginBottom: 66,
  },
  // guideCardContainer: {
  //   marginBottom: 24,
  // },
  successHeaderSection: {
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  successHeaderTextBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: 'rgba(140, 73, 213, 0.1)',
    borderWidth: 2,
    borderColor: '#8C49D5',
    borderRadius: 24,
    minHeight: 80,
  },
  successHeaderText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#8C49D5',
    lineHeight: 24,
  },
});
