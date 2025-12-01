/**
 * LessonViewerScreen
 * Display lesson content with progress tracking
 * Based on Figma design (36:1210)
 *
 * Features:
 * - Segmented progress bar at top
 * - Close button (top-left)
 * - Scrollable content with phase badge, title, body text, and images
 * - Continue button at bottom
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressBar } from '../components/ProgressBar';
import { Button } from '../components/Button';
import { COLORS, FONTS } from '../constants/assets';

export interface LessonContent {
  id: string;
  phase: string;
  title: string;
  bodyText: string;
  imageUrl?: ImageSourcePropType;
  totalSegments: number;
  currentSegment: number;
}

interface LessonViewerScreenProps {
  route: {
    params: {
      lesson: LessonContent;
    };
  };
  navigation: any;
}

export const LessonViewerScreen: React.FC<LessonViewerScreenProps> = ({ route, navigation }) => {
  const { lesson } = route.params;
  const [currentSegment, setCurrentSegment] = useState(lesson.currentSegment);

  const handleContinue = () => {
    if (currentSegment < lesson.totalSegments) {
      // Move to next segment
      setCurrentSegment(currentSegment + 1);
      // In a real app, this would load the next lesson content
    } else {
      // Lesson complete, navigate back
      navigation.goBack();
    }
  };

  const handleClose = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header with Progress Bar */}
      <View style={styles.header}>
        <ProgressBar
          totalSegments={lesson.totalSegments}
          currentSegment={currentSegment}
        />

        {/* Close Button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          accessibilityLabel="Close lesson"
        >
          <Text style={styles.closeIcon}>×</Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Phase Badge */}
        <Text style={styles.phaseBadge}>{lesson.phase}</Text>

        {/* Title */}
        <Text style={styles.title}>{lesson.title}</Text>

        {/* Body Text */}
        <Text style={styles.bodyText}>{lesson.bodyText}</Text>

        {/* Dragon Image */}
        {lesson.imageUrl && (
          <View style={styles.imageContainer}>
            <Image
              source={lesson.imageUrl}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Spacer for button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer with Continue Button */}
      <View style={styles.footer}>
        <Button onPress={handleContinue}>
          Continue →
        </Button>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    position: 'relative',
    paddingTop: 16,
    paddingBottom: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeIcon: {
    fontSize: 32,
    color: COLORS.textDark,
    fontWeight: '300',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  phaseBadge: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.mainPurple,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.2,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 24,
  },
  bodyText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: COLORS.textDark,
    textAlign: 'left',
    marginBottom: 32,
  },
  imageContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
});
