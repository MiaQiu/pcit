/**
 * QuizFeedback Component
 * Shows feedback after quiz submission with explanation
 * Celebrates correct answers, encourages for incorrect
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../constants/assets';

interface QuizFeedbackProps {
  isCorrect: boolean;
  explanation: string;
}

export const QuizFeedback: React.FC<QuizFeedbackProps> = ({
  isCorrect,
  explanation,
}) => {
  return (
    <View style={[styles.container, isCorrect ? styles.correctContainer : styles.incorrectContainer]}>
      {/* Emoji Icon */}
      <Text style={styles.emoji}>
        {isCorrect ? '🎉' : '💡'}
      </Text>

      {/* Heading */}
      <Text style={[styles.heading, isCorrect ? styles.correctHeading : styles.incorrectHeading]}>
        {isCorrect ? 'Correct!' : 'Not quite!'}
      </Text>

      {/* Explanation */}
      <Text style={styles.explanation}>
        {explanation}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
  },
  correctContainer: {
    backgroundColor: '#F0FFF4',
    borderWidth: 1,
    borderColor: '#48BB78',
  },
  incorrectContainer: {
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#F56565',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  heading: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  correctHeading: {
    color: '#22543D',
  },
  incorrectHeading: {
    color: '#742A2A',
  },
  explanation: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textDark,
    textAlign: 'center',
  },
});
