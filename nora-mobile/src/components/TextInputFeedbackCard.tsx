/**
 * TextInputFeedbackCard Component
 * Displays AI evaluation feedback for text input responses
 * Shows score, feedback message, suggestions, and ideal answer
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../constants/assets';

interface TextInputFeedbackCardProps {
  isCorrect: boolean;
  score: number;
  feedback: string;
  suggestions: string[];
  idealAnswer: string;
}

export const TextInputFeedbackCard: React.FC<TextInputFeedbackCardProps> = ({
  isCorrect,
  score,
  feedback,
  suggestions,
  idealAnswer,
}) => {
  // Determine score color based on value
  const getScoreColor = () => {
    if (score >= 80) return '#047857'; // Green
    if (score >= 60) return '#D97706'; // Orange
    return '#742A2A'; // Red
  };

  return (
    <View style={[styles.container, isCorrect ? styles.correctContainer : styles.incorrectContainer]}>
      {/* Score Badge */}
      <View style={styles.scoreRow}>
        <View style={[styles.scoreBadge, { backgroundColor: getScoreColor() }]}>
          <Text style={styles.scoreText}>{score}%</Text>
        </View>
        <Text style={[styles.heading, isCorrect ? styles.correctHeading : styles.incorrectHeading]}>
          {isCorrect ? 'Great job!' : 'Keep practicing!'}
        </Text>
      </View>

      {/* Feedback Message */}
      <Text style={styles.feedback}>
        {feedback}
      </Text>

      {/* Suggestions (if any) */}
      {suggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text style={styles.suggestionsTitle}>Tips for improvement:</Text>
          {suggestions.map((suggestion, index) => (
            <View key={index} style={styles.suggestionRow}>
              <Text style={styles.bulletPoint}>•</Text>
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Ideal Answer */}
      <View style={styles.idealAnswerContainer}>
        <Text style={styles.idealAnswerTitle}>Ideal answer:</Text>
        <Text style={styles.idealAnswerText}>"{idealAnswer}"</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  correctContainer: {
    backgroundColor: '#E6F9F0',
  },
  incorrectContainer: {
    backgroundColor: '#FFF8E6',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  scoreBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 12,
  },
  scoreText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  heading: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    flex: 1,
  },
  correctHeading: {
    color: '#047857',
  },
  incorrectHeading: {
    color: '#92400E',
  },
  feedback: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textDark,
    marginBottom: 16,
  },
  suggestionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textDark,
    marginBottom: 8,
  },
  suggestionRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  bulletPoint: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.mainPurple,
    marginRight: 8,
    marginTop: 2,
  },
  suggestionText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textDark,
    flex: 1,
  },
  idealAnswerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.mainPurple,
  },
  idealAnswerTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  idealAnswerText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textDark,
    fontStyle: 'italic',
  },
});
