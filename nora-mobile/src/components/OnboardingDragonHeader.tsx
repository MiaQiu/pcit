/**
 * OnboardingDragonHeader
 * Shared dragon header with text box for onboarding screens
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface OnboardingDragonHeaderProps {
  text: string;
  progress?: number; // Progress as a percentage (0-100)
}

export const OnboardingDragonHeader: React.FC<OnboardingDragonHeaderProps> = ({ text, progress = 0 }) => {
  const size = 60; // Overall size of the progress ring
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progressOffset = circumference - (progress / 100) * circumference;

  return (
    <View style={styles.headerSection}>
      <View style={styles.dragonContainer}>
        {/* Progress Ring */}
        <Svg width={size} height={size} style={styles.progressRing}>
          {/* White background ring */}
          <Circle
            stroke="#FFFFFF"
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
          />
          {/* Purple progress ring */}
          <Circle
            stroke="#D4B6FA"
            fill="none"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        {/* Dragon Icon */}
        <View style={styles.dragonIconContainer}>
          <Image
            source={require('../../assets/images/dragon_image.png')}
            style={styles.dragonIcon}
            resizeMode="contain"
          />
        </View>
      </View>
      <View style={styles.headerTextBox}>
        <Text style={styles.headerText}>{text}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerSection: {
    marginBottom: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dragonContainer: {
    width: 60,
    height: 60,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
  },
  progressRing: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  dragonIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    backgroundColor: '#F5F0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragonIcon: {
    width: 90,
    height: 90,
    marginLeft: 25,
  },
  headerTextBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerText: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 16,
    color: '#364153',
    lineHeight: 24,
  },
});
