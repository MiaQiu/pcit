/**
 * Record Screen
 * Audio recording screen for play sessions with PCIT skills tracking
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { RootStackNavigationProp } from '../navigation/types';
import { RecordButton } from '../components/RecordButton';
import { AudioWaveform } from '../components/AudioWaveform';
import { RecordingTimer } from '../components/RecordingTimer';
import { ProfileCircle } from '../components/ProfileCircle';
//import { StreakWidget } from '../components/StreakWidget';
import { RecordingGuideCard } from '../components/RecordingGuideCard';
import { HowToRecordCard } from '../components/HowToRecordCard';
import { RecordingCard } from '../components/RecordingCard';
import { FONTS, COLORS, DRAGON_PURPLE } from '../constants/assets';
import { useRecordingService } from '../contexts/AppContext';

type RecordingState = 'idle' | 'ready' | 'recording' | 'paused' | 'completed' | 'uploading' | 'processing' | 'success';

// Get API URL from environment
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

export const RecordScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const recordingService = useRecordingService();
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [navigationTimeout, setNavigationTimeout] = useState<NodeJS.Timeout | null>(null);

  // Use ref to track current recording for cleanup
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    requestPermissions();

    // Cleanup on unmount only
    return () => {
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
    };
  }, []);

  // Reset state when screen comes back into focus
  useFocusEffect(
    React.useCallback(() => {
      // Only reset if we're in success state (user came back from report)
      if (recordingState === 'success') {
        resetRecording();
      }
    }, [recordingState])
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

  const startRecording = async () => {
    try {
      if (!permissionGranted) {
        await requestPermissions();
        return;
      }

      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create and start recording
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      recordingRef.current = newRecording; // Track in ref
      setRecordingState('recording');

      // Update duration periodically
      newRecording.setOnRecordingStatusUpdate((status) => {
        if (status.isRecording) {
          setRecordingDuration(status.durationMillis);
        }
      });
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;

      // Get URI and status before stopping
      const uri = recording.getURI();
      const status = await recording.getStatusAsync();
      const durationSeconds = status.durationMillis
        ? Math.floor(status.durationMillis / 1000)
        : Math.floor(recordingDuration / 1000);

      // Stop and unload, then clear references
      await recording.stopAndUnloadAsync();
      setRecording(null);
      recordingRef.current = null; // Clear ref
      setRecordingState('uploading');

      console.log('Recording saved to:', uri);
      console.log('Duration:', durationSeconds, 'seconds');

      // Upload to backend
      if (uri) {
        await uploadRecording(uri, durationSeconds);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording.');
      setRecordingState('completed');
    }
  };

  const uploadRecording = async (uri: string, durationSeconds: number) => {
    try {
      console.log('Starting upload...', { uri, durationSeconds });

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

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
            console.log('Upload progress:', progress + '%');
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 201) {
            try {
              const response = JSON.parse(xhr.responseText);
              console.log('Upload successful:', response);
              resolve(response.recordingId);
            } catch (error) {
              reject(new Error('Invalid response from server'));
            }
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

        // Open connection and send
        xhr.open('POST', `${API_URL}/api/recordings/upload`);

        // Note: Since auth is temporarily disabled, we don't need the Authorization header
        // When auth is re-enabled, add: xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.send(formData);
      });

      const uploadedRecordingId = await uploadPromise;
      setRecordingId(uploadedRecordingId);

      console.log('Upload complete, recording ID:', uploadedRecordingId);

      // Show processing state and poll for analysis completion
      setRecordingState('processing');

      // Poll for analysis completion
      pollForAnalysisCompletion(uploadedRecordingId);

    } catch (error) {
      console.error('Upload failed:', error);

      Alert.alert(
        'Upload Failed',
        error instanceof Error ? error.message : 'Failed to upload recording. Please try again.',
        [
          { text: 'Cancel', onPress: resetRecording, style: 'cancel' },
          {
            text: 'Retry',
            onPress: () => uploadRecording(uri, durationSeconds)
          }
        ]
      );

      setRecordingState('completed');
    }
  };

  const resetRecording = () => {
    setRecordingState('idle');
    setRecordingDuration(0);
    setUploadProgress(0);
    setRecordingId(null);
    // Clear any pending timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const pollForAnalysisCompletion = async (recordingId: string, attempt: number = 0) => {
    const maxAttempts = 40; // 40 attempts * 3 seconds = 2 minutes max

    if (attempt >= maxAttempts) {
      console.log('Polling timeout - navigating to report anyway');
      navigation.navigate('Report', { recordingId });
      return;
    }

    try {
      // Check if analysis is complete
      const analysis = await recordingService.getAnalysis(recordingId);

      // If we got the analysis successfully, navigate to report
      console.log('Analysis complete! Navigating to report...');
      setRecordingState('success');
      navigation.navigate('Report', { recordingId });
    } catch (error: any) {
      // If still processing or transcribing, wait and try again
      const errorMsg = error.message.toLowerCase();
      if (errorMsg.includes('processing') || errorMsg.includes('transcription') || errorMsg.includes('in progress')) {
        console.log(`Analysis still processing... (attempt ${attempt + 1}/${maxAttempts}): ${error.message}`);
        const timeout = setTimeout(() => {
          pollForAnalysisCompletion(recordingId, attempt + 1);
        }, 3000);
        timeoutRef.current = timeout;
      } else {
        // Other error - navigate to report screen which will show the error
        console.error('Error checking analysis status:', error);
        navigation.navigate('Report', { recordingId });
      }
    }
  };

  const handleStartSession = () => {
    // Transition to ready state without starting recording
    setRecordingState('ready');
  };

  const handleRecordButtonPress = () => {
    if (recordingState === 'ready') {
      startRecording();
    } else if (recordingState === 'recording') {
      stopRecording();
    }
  };

  const canStartSession = permissionGranted;
  const canRecord = permissionGranted && (recordingState === 'ready' || recordingState === 'recording');

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
                <Text style={styles.headerText}>Ready for a 5-minute play session with Zoey?</Text>
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

        {/* Recording Card - Show when ready or recording */}
        {(recordingState === 'ready' || recordingState === 'recording') && (
          <View style={styles.recordingCardContainer}>
            <RecordingCard
              isRecording={recordingState === 'recording'}
              durationMillis={recordingDuration}
            />
          </View>
        )}

        {/* Upload Progress */}
        {recordingState === 'uploading' && (
          <View style={styles.uploadContainer}>
            <ActivityIndicator size="large" color={COLORS.textDark} />
            <Text style={styles.uploadText}>Uploading recording...</Text>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>{uploadProgress}%</Text>
          </View>
        )}

        {/* Processing State */}
        {recordingState === 'processing' && (
          <View style={styles.processingContainer}>
            <View style={styles.dragonIconContainer}>
              <Image
                source={require('../../assets/images/dragon_image.png')}
                style={styles.dragonIcon}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.processingTitle}>Analyzing Your Session</Text>
            <Text style={styles.processingSubtitle}>
              Nora is reviewing your play session and preparing your personalized report...
            </Text>
            <ActivityIndicator size="large" color={COLORS.mainPurple} style={styles.processingSpinner} />
          </View>
        )}

        {!permissionGranted && recordingState === 'idle' && (
          <Text style={styles.permissionText}>
            Microphone permission required to record
          </Text>
        )}
      </ScrollView>

      {/* Fixed Bottom Action Buttons */}
      {recordingState === 'idle' && (
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

      {recordingState === 'ready' && (
        <View style={styles.fixedButtonContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleRecordButtonPress}
            disabled={!canRecord}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>Record</Text>
            <Ionicons name="mic" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {recordingState === 'recording' && (
        <View style={styles.fixedButtonContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.stopButton]}
            onPress={handleRecordButtonPress}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>Stop</Text>
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
