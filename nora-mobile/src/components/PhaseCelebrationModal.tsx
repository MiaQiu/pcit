/**
 * Phase Celebration Modal
 * Displays when user advances from CONNECT to DISCIPLINE phase
 */

import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { FONTS, COLORS } from '../constants/assets';

interface PhaseCelebrationModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PhaseCelebrationModal: React.FC<PhaseCelebrationModalProps> = ({
  visible,
  onClose
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Celebration Icon */}
          <Text style={styles.celebrationEmoji}>🎉</Text>

          {/* Title */}
          <Text style={styles.title}>Congratulations!</Text>

          {/* Message */}
          <Text style={styles.message}>
            You've completed the <Text style={styles.phaseName}>Connect Phase</Text> and achieved mastery!
          </Text>

          <Text style={styles.message}>
            You're now ready to advance to the{' '}
            <Text style={styles.phaseName}>Discipline Phase</Text>, where you'll learn to set
            clear boundaries with confidence and care.
          </Text>

          {/* Unlock Info */}
          <View style={styles.unlockBox}>
            <Text style={styles.unlockTitle}>✨ What's Unlocked:</Text>
            <Text style={styles.unlockItem}>• All Connect lessons (for review)</Text>
            <Text style={styles.unlockItem}>• New Discipline Phase lessons</Text>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={styles.continueButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Continue to Discipline Phase</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    width: width - 40,
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  celebrationEmoji: {
    fontSize: 72,
    marginBottom: 16,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    lineHeight: 36,
    color: COLORS.mainPurple,
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 12,
  },
  phaseName: {
    fontFamily: FONTS.bold,
    color: COLORS.mainPurple,
  },
  unlockBox: {
    backgroundColor: '#F5F3FF',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginTop: 20,
    marginBottom: 24,
  },
  unlockTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.mainPurple,
    marginBottom: 12,
  },
  unlockItem: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  continueButton: {
    backgroundColor: COLORS.mainPurple,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    shadowColor: COLORS.mainPurple,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  continueButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
