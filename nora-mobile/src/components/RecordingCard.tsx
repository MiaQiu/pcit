/**
 * RecordingCard Component
 * Card for displaying recording in progress with waveform
 * Based on LessonCard design
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { MaskedDinoImage } from './MaskedDinoImage';
import { RecordingTimer } from './RecordingTimer';
import { FONTS, COLORS } from '../constants/assets';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RecordingCardProps {
  isRecording: boolean;
  durationMillis: number;
  targetMinutes?: number;
  onRecordPress?: () => void;
  canRecord?: boolean;
  backgroundColor?: string;
}

export const RecordingCard: React.FC<RecordingCardProps> = ({
  isRecording,
  durationMillis,
  targetMinutes = 5,
  onRecordPress,
  canRecord,
  backgroundColor = '#E4E4FF',
}) => {
  return (
    <Card
      backgroundColor={backgroundColor}
      variant="default"
      style={styles.card}
    >
      <View style={styles.container}>
        {/* Dragon Image with masked background */}
        <View style={styles.dinoSection}>
          <MaskedDinoImage style={styles.dinoImage} maskColor={backgroundColor} />
        </View>

        {/* Recording Timer - Top */}
        <View style={styles.timerContainer}>
          <RecordingTimer
            isRecording={isRecording}
            durationMillis={durationMillis}
          />
        </View>

        {/* Hint Text - Bottom */}
        <View style={styles.hintContainer}>
          <Text style={styles.hintText}>
            {isRecording
              ? `Recording in progress...\nSpeak naturally during play time! The recording will stop automatically at ${targetMinutes} minutes`
              : 'Start recording your play session'}
          </Text>
        </View>

        {/* Record Button - Only show if onRecordPress is provided */}
        {!isRecording && onRecordPress && (
          <View style={styles.recordButtonContainer}>
            <TouchableOpacity
              style={[styles.recordButton, !canRecord && styles.recordButtonDisabled]}
              onPress={onRecordPress}
              disabled={!canRecord}
              activeOpacity={0.8}
            >
              <Text style={styles.recordButtonText}>Record</Text>
              <Ionicons name="mic" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Stop Button - Only show if onRecordPress is provided */}
        {isRecording && onRecordPress && (
          <View style={styles.recordButtonContainer}>
            <TouchableOpacity
              style={styles.stopButton}
              onPress={onRecordPress}
              activeOpacity={0.8}
            >
              <Text style={styles.stopButtonText}>Stop</Text>
              <Ionicons name="stop" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '95%',
    height: 560,
    alignSelf: 'center',
  },
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dinoSection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_WIDTH * 0.9,
    maxHeight: 350,
    overflow: 'visible',
  },
  dinoImage: {
    width: '100%',
    height: '100%',
  },
  timerContainer: {
    position: 'absolute',
    top: 300,
    alignItems: 'center',
    zIndex: 10,
  },
  hintContainer: {
    position: 'absolute',
    bottom: 90,
    paddingHorizontal: 24,
    alignItems: 'center',
    zIndex: 10,
  },
  hintText: {
    fontFamily: FONTS.regular,
    fontSize: 18,
    color: COLORS.textDark,
    textAlign: 'center',
    lineHeight: 24,
  },
  recordButtonContainer: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    zIndex: 10,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.textDark,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 100,
    gap: 8,
    minWidth: 160,
  },
  recordButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  recordButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E74C3C',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 100,
    gap: 8,
    minWidth: 160,
  },
  stopButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
});
