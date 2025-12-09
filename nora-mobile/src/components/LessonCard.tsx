/**
 * LessonCard Component
 * Complete lesson card with dragon image, phase badge, and CTA
 * Based on Figma lesson card design
 *
 * Figma measurements (from node 35:791):
 * - Card: 382x679
 * - Dragon image: x=0, y=42, w=382, h=223
 * - Phase badge: x=145, y=302 (centered)
 * - Content: x=24, y=383
 * - CTA button: x=24, y=591, w=334, h=64
 */

import React from 'react';
import { View, Text, Image, StyleSheet, ImageSourcePropType } from 'react-native';
import { Card } from './Card';
import { Badge } from './Badge';
import { Button } from './Button';
import { Ellipse } from './Ellipse';

// Phase-specific styling
const PHASE_STYLES = {
  CONNECT: {
    backgroundColor: '#E4E4FF',
    ellipse77Color: '#9BD4DF',
    ellipse78Color: '#A6E0CB',
  },
  DISCIPLINE: {
    backgroundColor: '#FFE4C0',
    ellipse77Color: '#FFD4A3',
    ellipse78Color: '#FFC88A',
  },
};

export interface LessonCardProps {
  id: string;
  phase: string;
  phaseName: string;
  title: string;
  subtitle: string;
  description: string;
  dragonImageUrl: ImageSourcePropType; // Changed to support local images
  backgroundColor?: string; // Optional - will use phase-based color if not provided
  ellipse77Color?: string; // Color for bottom ellipse
  ellipse78Color?: string; // Color for top ellipse
  isLocked?: boolean;
  progress?: {
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'LOCKED';
    completedAt?: Date | string;
  };
  onPress?: () => void;
}

export const LessonCard: React.FC<LessonCardProps> = ({
  phase,
  phaseName,
  title,
  subtitle,
  description,
  dragonImageUrl,
  backgroundColor,
  ellipse77Color,
  ellipse78Color,
  isLocked = false,
  onPress,
}) => {
  // Determine phase-based styling (case-insensitive)
  const normalizedPhaseName = phaseName.toUpperCase();
  const phaseStyle = PHASE_STYLES[normalizedPhaseName as keyof typeof PHASE_STYLES] || PHASE_STYLES.CONNECT;

  // Use provided colors or fall back to phase-based defaults
  const finalBackgroundColor = backgroundColor || phaseStyle.backgroundColor;
  const finalEllipse77Color = ellipse77Color || phaseStyle.ellipse77Color;
  const finalEllipse78Color = ellipse78Color || phaseStyle.ellipse78Color;
  return (
    <Card
      backgroundColor={finalBackgroundColor}
      variant="pressable"
      onPress={!isLocked ? onPress : undefined}
      style={styles.card}
    >
      <View style={styles.container}>
        {/* Ellipse 78 - Top decorative background */}
        <Ellipse color={finalEllipse78Color} style={styles.ellipse78} />

        {/* Ellipse 77 - Bottom decorative background */}
        <Ellipse color={finalEllipse77Color} style={styles.ellipse77} />

        {/* Dragon Image - Figma node 35:798 */}
        <View style={[
          styles.dragonContainer,
          normalizedPhaseName === 'DISCIPLINE' && styles.dragonContainerDiscipline
        ]}>
          <Image
            source={dragonImageUrl}
            style={styles.dragonImage}
            resizeMode="contain"
          />
        </View>

        {/* Phase Badge - Figma node 35:794 */}
        <View style={styles.badgeContainer}>
          <Badge label={phase} subtitle={phaseName} />
        </View>

        {/* Content - Figma node 35:801 */}
        <View style={styles.contentContainer}>
          <View style={styles.textBlock}>
            <Text style={styles.subtitle}>{subtitle}</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
          <Text style={styles.description}>{description}</Text>
        </View>

        {/* CTA Button - Figma node 35:800 */}
        <View style={styles.buttonContainer}>
          <Button onPress={onPress || (() => {})} disabled={isLocked}>
            {isLocked ? 'Locked 🔒' : 'Start Reading'}
          </Button>
        </View>
      </View>
    </Card>
  );
};

// Exact measurements from Figma (node 35:791 - Frame 1980)
const styles = StyleSheet.create({
  card: {
    width: '90%', //adjusted
    height: 660, //adjusted
    alignSelf: 'center', //added
    // height: 679, //original
    //width: '100%', //original
  },
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  // Ellipse 78: x=-45, y=-88, w=473, h=259 (Figma image asset)
  ellipse78: {
    position: 'absolute',
    left: -45,
    top: -88,
    width: 473,
    height: 259,
  },
  // Ellipse 77: x=-45, y=153, w=473, h=175 (Figma image asset)
  ellipse77: {
    position: 'absolute',
    left: -45,
    top: 153,
    width: 473,
    height: 175,
  },
  // Dragon image: x=0, y=42, w=382, h=223
  dragonContainer: {
    position: 'absolute',
    left: 0,
    top: 42,
    width: 350, //adjusted
    height: 223,

    // width: 382, //original

  },
  // Discipline phase dragon (dino) - adjusted positioning
  dragonContainerDiscipline: {
    left: 0,
    top: -30,
    width: 360,
    height: 360,
  },
  dragonImage: {
    width: '100%',
    height: '100%',
  },
  // Badge: x=0, y=302 (centered with padding)
  badgeContainer: {
    position: 'absolute',
    top: 302,
    left: 0,
    width: 382,
    alignItems: 'center',
  },
  // Content: x=0, y=383
  contentContainer: {
    position: 'absolute',
    top: 383,
    left: 0,
    width: 382,
    paddingHorizontal: 24,
    gap: 16,
  },
  textBlock: {
    gap: 8,
    width: '100%',
  },
  subtitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#1E2939',
    lineHeight: 24,
  },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 32,
    color: '#1E2939',
    lineHeight: 38,
    letterSpacing: -0.2,
  },
  description: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#1E2939',
    lineHeight: 22,
    letterSpacing: -0.31,
  },
  // Button: x=24, y=591, w=334, h=64
  buttonContainer: {
    position: 'absolute',
    bottom: 15, //adjusted
    // bottom: 88, // 679 - 591 = 88 //original
    left: 24,
    width: 300, //adjusted
    // width: 334, //original
  },
});