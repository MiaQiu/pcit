/**
 * LessonContentCard Component
 * Card container for lesson body content with decorative ellipse on top
 * Used in the lesson viewer to wrap lesson text content
 */

import React from 'react';
import { View, Image, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '../constants/assets';

interface LessonContentCardProps {
  children: React.ReactNode;
  backgroundColor?: string;
  ellipseColor?: string;
  style?: ViewStyle;
}

export const LessonContentCard: React.FC<LessonContentCardProps> = ({
  children,
  backgroundColor = '#F8F8FF',
  ellipseColor = COLORS.mainPurple,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Decorative Ellipse Images */}
      <View style={styles.ellipseContainer}>
        <View style={styles.ellipseWrapper}>
          {/* Ellipse 78 - Bottom layer */}
          {/* <Image
            source={require('../../assets/images/ellipse-78.png')}
            style={styles.ellipseImage78}
            resizeMode="cover"
          /> */}
          {/* Ellipse 77 - Top layer */}
          <Image
            source={require('../../assets/images/ellipse-77.png')}
            style={styles.ellipseImage77}
            resizeMode="cover"
          />
        </View>
      </View>

      {/* Card Content */}
      <View style={[styles.card, { backgroundColor }]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  ellipseContainer: {
    alignItems: 'center',
    zIndex: 1,
    marginBottom: -130, // Overlap with card
  },
  ellipseWrapper: {
    width: 342,
    height: 160,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  ellipseImage78: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    marginTop: -90,
    zIndex: 2,
  },
  ellipseImage77: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    marginTop: -70,
    zIndex: 1,
  },
  //
  card: {
    borderRadius: 24,
    height: 550, // Fixed height for consistency
    paddingTop: 100, // Push text below ellipse (adjusted for -110 overlap)
    paddingHorizontal: 16,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    },
});
