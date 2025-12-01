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
      {/* Heading - left aligned */}
      <Text style={[styles.heading, isCorrect ? styles.correctHeading : styles.incorrectHeading]}>
        {isCorrect ? 'Correct!' : 'Not quite!'}
      </Text>

      {/* Explanation - left aligned */}
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
  },
  correctContainer: {
    backgroundColor: '#E6F9F0',
  },
  incorrectContainer: {
    backgroundColor: '#FFF5F5',
  },
  heading: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    marginBottom: 8,
    textAlign: 'left',
  },
  correctHeading: {
    color: '#047857',
  },
  incorrectHeading: {
    color: '#742A2A',
  },
  explanation: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textDark,
    textAlign: 'left',
  },
});
