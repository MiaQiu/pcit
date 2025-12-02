/**
 * NextActionCard Component
 * Card shown after lesson completion suggesting next action
 * Based on Figma design with decorative background and CTA button
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, COLORS } from '../constants/assets';

interface NextActionCardProps {
  badge?: string;
  title: string;
  description: string;
  buttonText: string;
  onPress: () => void;
}

export const NextActionCard: React.FC<NextActionCardProps> = ({
  badge = 'Up next',
  title,
  description,
  buttonText,
  onPress,
}) => {
  return (
    <View style={styles.container}>
      {/* Decorative Background Waves */}
      <View style={styles.decorativeBackground}>
        <View style={styles.waveGreen} />
        <View style={styles.waveCyan} />
        <View style={styles.wavePurple} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Badge */}
        {badge && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}

        {/* Title */}
        <Text style={styles.title}>{title}</Text>

        {/* Description */}
        <Text style={styles.description}>{description}</Text>

        {/* CTA Button */}
        <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{buttonText}</Text>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    minHeight: 380,
    position: 'relative',
  },
  decorativeBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  waveGreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: '#B4E0CB', // Light mint green
    borderBottomLeftRadius: 100,
    borderBottomRightRadius: 100,
  },
  waveCyan: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: '#9BD4DF', // Light cyan
    borderBottomLeftRadius: 120,
    borderBottomRightRadius: 120,
    opacity: 0.8,
  },
  wavePurple: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: '#E4E4FF', // Light purple
    borderBottomLeftRadius: 140,
    borderBottomRightRadius: 140,
  },
  content: {
    position: 'relative',
    zIndex: 10,
    paddingHorizontal: 24,
    paddingTop: 180,
    paddingBottom: 24,
  },
  badgeContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 100,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.mainPurple,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    lineHeight: 34,
    color: COLORS.textDark,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  description: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#666666',
    marginBottom: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C3E50', // Dark blue-gray from design
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 100,
    gap: 8,
  },
  buttonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
});
