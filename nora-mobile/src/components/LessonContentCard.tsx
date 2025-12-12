/**
 * LessonContentCard Component
 * Card container for lesson body content with decorative ellipse on top
 * Used in the lesson viewer to wrap lesson text content
 */

import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/assets';

interface LessonContentCardProps {
  children: React.ReactNode;
  backgroundColor?: string;
  ellipseColor?: string;
  style?: ViewStyle;
  onShare?: () => void;
  title?: string;
}

export const LessonContentCard: React.FC<LessonContentCardProps> = ({
  children,
  backgroundColor = '#F8F8FF',
  ellipseColor = COLORS.mainPurple,
  style,
  onShare,
  title,
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

      {/* Title - positioned on top of ellipse, aligned with share button */}
      {title && (
        <Text style={styles.titleText}>{title}</Text>
      )}

      {/* Share Button - positioned outside card to avoid being covered by ellipse */}
      {onShare && (
        <TouchableOpacity
          style={styles.shareButton}
          onPress={onShare}
          activeOpacity={0.7}
        >
          <Ionicons name="share-outline" size={24} color={COLORS.mainPurple} />
        </TouchableOpacity>
      )}

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
    position: 'relative',
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
    position: 'relative',
  },
  titleText: {
    position: 'absolute',
    top: 22,
    left: 20,
    right: 70, // Leave space for share button
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 18,
    lineHeight: 26,
    color: COLORS.textDark,
    zIndex: 100,
  },
  shareButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 10,
    zIndex: 100,
  },
});
