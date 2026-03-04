/**
 * Phase Celebration Modal
 * Displays when user first achieves 80+ score in a Special Time (CDI) session,
 * unlocking the Discipline phase.
 */

import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, COLORS } from '../constants/assets';

interface PhaseCelebrationModalProps {
  visible: boolean;
  onClose: () => void;
  childName?: string;
}

export const PhaseCelebrationModal: React.FC<PhaseCelebrationModalProps> = ({
  visible,
  onClose,
  childName = 'your child',
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
          <Text style={styles.title}>You've Mastered Special Play Time!</Text>

          {/* Message */}
          <Text style={styles.message}>
            Incredible work. Scoring 80+ shows you've built a strong, connected foundation with {childName}.
          </Text>

          {/* Unlock Banner */}
          <View style={styles.unlockBox}>
            <View style={styles.unlockTitleRow}>
              <Ionicons name="lock-open" size={18} color={COLORS.mainPurple} />
              <Text style={styles.unlockTitle}>Discipline Mode Unlocked</Text>
            </View>
            <Text style={styles.unlockDescription}>
              You can now record Discipline sessions. Go to the{' '}
              <Text style={styles.bold}>Record</Text> tab and select the{' '}
              <Text style={styles.bold}>Discipline (10m)</Text> option.
            </Text>
          </View>

          {/* Suggestion */}
          <View style={styles.suggestionBox}>
            <View style={styles.suggestionTitleRow}>
              <Ionicons name="bulb-outline" size={16} color="#92400E" />
              <Text style={styles.suggestionTitle}>Before You Begin</Text>
            </View>
            <Text style={styles.suggestionText}>
              We recommend completing the{' '}
              <Text style={styles.bold}>Not Listening &amp; Arguing</Text> lessons first — they'll give you the framework to make your Discipline sessions most effective.{'\n\n'}
              In the meantime, keep doing Special Time sessions to deposit into {childName}'s emotional bank account.
            </Text>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={styles.continueButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Got it!</Text>
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
    padding: 28,
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
    fontSize: 64,
    marginBottom: 12,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    lineHeight: 30,
    color: COLORS.mainPurple,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 23,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 20,
  },
  unlockBox: {
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    marginBottom: 12,
  },
  unlockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  unlockTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.mainPurple,
  },
  unlockDescription: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textDark,
  },
  suggestionBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  suggestionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  suggestionTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#92400E',
  },
  suggestionText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: '#78350F',
  },
  bold: {
    fontFamily: FONTS.semiBold,
  },
  continueButton: {
    backgroundColor: COLORS.mainPurple,
    borderRadius: 100,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  continueButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
  },
});
