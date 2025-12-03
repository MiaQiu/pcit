/**
 * Record Screen
 * Audio recording screen for play sessions with PCIT skills tracking
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { RecordButton } from '../components/RecordButton';
import { AudioWaveform } from '../components/AudioWaveform';
import { RecordingTimer } from '../components/RecordingTimer';
import { ProfileCircle } from '../components/ProfileCircle';
//import { StreakWidget } from '../components/StreakWidget';
import { RecordingGuideCard } from '../components/RecordingGuideCard';
import { HowToRecordCard } from '../components/HowToRecordCard';
import { RecordingCard } from '../components/RecordingCard';
import { FONTS, COLORS, DRAGON_PURPLE } from '../constants/assets';

type RecordingState = 'idle' | 'ready' | 'recording' | 'paused' | 'completed';

export const RecordScreen: React.FC = () => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    requestPermissions();
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync().catch(console.error);
      }
    };
  }, []);

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

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      setRecording(null);
      setRecordingState('completed');

      console.log('Recording saved to:', uri);

      // TODO: Upload to backend for analysis
      Alert.alert(
        'Recording Complete!',
        'Your play session has been recorded. Analysis coming soon!',
        [{ text: 'OK', onPress: resetRecording }]
      );
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording.');
    }
  };

  const resetRecording = () => {
    setRecordingState('idle');
    setRecordingDuration(0);
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
              onRecordPress={handleRecordButtonPress}
              canRecord={canRecord}
            />
          </View>
        )}

        {/* Spacer */}
        <View style={{ flex: 1, minHeight: 40 }} />

        {!permissionGranted && recordingState === 'idle' && (
          <Text style={styles.permissionText}>
            Microphone permission required to record
          </Text>
        )}
      </ScrollView>

      {/* Fixed Start Session Button at Bottom */}
      {recordingState === 'idle' && (
        <View style={styles.fixedButtonContainer}>
          <TouchableOpacity
            style={styles.recordButton}
            onPress={handleStartSession}
            disabled={!canStartSession}
            activeOpacity={0.8}
          >
            <Text style={styles.recordButtonText}>Start Session</Text>
            <Ionicons name="play" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexGrow: 1,
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
    width: '100%',
    height: '100%',
  },
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
    marginBottom: 24,
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
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.textDark,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 100,
    gap: 8,
  },
  recordButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  permissionText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#E74C3C',
    textAlign: 'center',
    marginTop: 12,
  },
});
