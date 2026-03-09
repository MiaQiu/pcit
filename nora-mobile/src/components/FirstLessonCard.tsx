/**
 * FirstLessonCard Component
 * Shown on HomeScreen for first-time users who have never completed a lesson or recording.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Badge } from './Badge';
import { FONTS } from '../constants/assets';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.9;
const HERO_HEIGHT = CARD_WIDTH * 0.75;
const CARD_BG = '#E8E8FF';

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
        <Image
          source={require('../../assets/images/dino_new.webp')}
          style={styles.dinoImage}
          resizeMode="cover"
        />
        {/* Smooth concave curve at the bottom of the hero */}
        <View style={styles.curveOverlay}>
          <Svg width="100%" height="100%" viewBox="0 0 400 80" preserveAspectRatio="none">
            <Path
              d="M 0 30 Q 200 80, 400 30 L 400 80 L 0 80 Z"
              fill={CARD_BG}
            />
          </Svg>
        </View>
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
    backgroundColor: CARD_BG,
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
  curveOverlay: {
    position: 'absolute',
    bottom: -30,
    left: 0,
    right: 0,
    height: 80,
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
