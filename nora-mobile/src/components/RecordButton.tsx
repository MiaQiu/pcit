/**
 * RecordButton Component
 * Large record button with microphone icon for starting/stopping recording
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, COLORS } from '../constants/assets';

interface RecordButtonProps {
  isRecording: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export const RecordButton: React.FC<RecordButtonProps> = ({
  isRecording,
  onPress,
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        isRecording && styles.buttonRecording,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        <Ionicons
          name={isRecording ? 'stop' : 'mic'}
          size={28}
          color="#FFFFFF"
          style={styles.icon}
        />
        <Text style={styles.text}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: 64,
    backgroundColor: COLORS.mainPurple,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonRecording: {
    backgroundColor: '#E74C3C', // Red for stop
  },
  buttonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    marginTop: 2,
  },
  text: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
});
