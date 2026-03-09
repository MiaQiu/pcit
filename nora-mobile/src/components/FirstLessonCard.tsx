/**
 * FirstLessonCard Component
 * Shown on HomeScreen for first-time users who have never completed a lesson or recording.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaskedDinoImage } from './MaskedDinoImage';
import { Badge } from './Badge';
import { FONTS } from '../constants/assets';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.9;
const HERO_HEIGHT = CARD_WIDTH * 0.75;

interface FirstLessonCardProps {
  phaseName?: string;
  onPress?: () => void;
}

export const FirstLessonCard: React.FC<FirstLessonCardProps> = ({
  phaseName = '',
  onPress,
}) => {
  return (
    <View style={styles.container}>
      {/* Teal hero with dragon */}
      <View style={styles.hero}>
        <MaskedDinoImage style={styles.dinoImage} maskColor="#E8E8FF" />
      </View>

      {/* Badge overlapping the hero/content boundary */}
      <View style={styles.badgeContainer}>
        <Badge label="Module" subtitle={phaseName} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.label}>Start your journey</Text>
        <Text style={styles.title}>Read your first 2-minute Lesson</Text>
        <Text style={styles.description}>
          Lessons are short 2 min reads about how important connection is during playtime.
        </Text>

        {onPress && (
          <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Start Reading 📖</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '90%',
    alignSelf: 'center',
    backgroundColor: '#E8E8FF',
    borderRadius: 24,
    overflow: 'hidden',
  },
  hero: {
    width: '100%',
    height: HERO_HEIGHT,
    backgroundColor: '#8ECECE',
  },
  dinoImage: {
    width: '100%',
    height: '100%',
  },
  badgeContainer: {
    alignItems: 'center',
    marginTop: -24,
    marginBottom: 20,
    zIndex: 10,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  label: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#1E2939',
    marginBottom: 8,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    color: '#1E2939',
    lineHeight: 38,
    letterSpacing: -0.2,
    marginBottom: 16,
  },
  description: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#1E2939',
    lineHeight: 22,
    letterSpacing: -0.31,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#1E2939',
    borderRadius: 100,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
});
