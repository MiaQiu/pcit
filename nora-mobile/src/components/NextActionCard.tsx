/**
 * NextActionCard Component
 * Card shown after lesson completion suggesting next action
 * Based on Figma design with decorative background and CTA button
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS, COLORS } from '../constants/assets';
import { Badge } from './Badge';

interface NextActionCardProps {
  phase?: string;
  phaseName?: string;
  title: string;
  description: string;
  buttonText?: string;
  onPress?: () => void;
}

export const NextActionCard: React.FC<NextActionCardProps> = ({
  phase = 'PHASE',
  phaseName = '',
  title,
  description,
  buttonText,
  onPress,
}) => {
  return (
    <View style={styles.container}>
      {/* Decorative Background with Ellipse Images */}
      <View style={styles.decorativeBackground}>
        <Image
          source={require('../../assets/images/ellipse-77.png')}
          style={styles.ellipse77}
          resizeMode="cover"
        />
        <Image
          source={require('../../assets/images/ellipse-78.png')}
          style={styles.ellipse78}
          resizeMode="cover"
        />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Phase Badge */}
        <View style={styles.badgeContainer}>
          <Badge label={phase} subtitle={phaseName} />
        </View>

        {/* Up next label */}
        <Text style={styles.upNextLabel}>Up next</Text>

        {/* Title */}
        <Text style={styles.title}>{title}</Text>

        {/* Description */}
        <Text style={styles.description}>{description}</Text>

        {/* CTA Button - Only show if onPress is provided */}
        {onPress && buttonText && (
          <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
            <Text style={styles.buttonText}>{buttonText}</Text>
            <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#E4E4FF',
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
    bottom: 0,
  },
  // Ellipse 78: x=-45, y=-88, w=473, h=259 (Figma image asset)
  ellipse78: {
    position: 'absolute',
    left: '50%',
    marginLeft: -236.5, // Half of 473 to center
    top: -120,
    width: 473,
    height: 259,
  },
  // Ellipse 77: x=-45, y=153, w=473, h=175 (Figma image asset)
  ellipse77: {
    position: 'absolute',
    left: '50%',
    marginLeft: -236.5, // Half of 473 to center
    top: -40,
    width: 473,
    height: 259,
  },
  content: {
    position: 'relative',
    zIndex: 10,
    paddingHorizontal: 24,
    paddingTop: 200,
    paddingBottom: 24,
  },
  badgeContainer: {
    alignItems: 'center',
    marginBottom: 26,
    marginTop:-10
  },
  upNextLabel: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#1E2939',
    lineHeight: 24,
    textAlign: 'left',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 32,
    color: '#1E2939',
    lineHeight: 38,
    letterSpacing: -0.2,
    textAlign: 'left',
    marginBottom: 16,
  },
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#1E2939',
    lineHeight: 22,
    letterSpacing: -0.31,
    textAlign: 'left',
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
    marginTop: 18,
  },
  buttonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
});
