/**
 * OnboardingProgressHeader
 * 4-phase progress header for onboarding screens
 * Shows dragon avatar, title, phase counter, progress segments, and phase name
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

interface OnboardingProgressHeaderProps {
  phase: number; // 1-4
  step: number; // 1-N (current step within phase)
  totalSteps: number; // total steps in current phase
}

const PHASE_NAMES = ['Basic data', 'Developmental snapshot', 'Nora advantage', 'Setup for success'];
const TOTAL_PHASES = 4;

export const OnboardingProgressHeader: React.FC<OnboardingProgressHeaderProps> = ({
  phase,
  step,
  totalSteps,
}) => {
  const phaseName = PHASE_NAMES[phase - 1] || '';

  return (
    <View style={styles.container}>
      {/* Dragon avatar on the left */}
      <View style={styles.avatarContainer}>
        <Image
          source={require('../../assets/images/dragon_image.png')}
          style={styles.avatarImage}
          resizeMode="contain"
        />
      </View>

      {/* Right side: title row, progress bar, phase name */}
      <View style={styles.rightSection}>
        {/* Title + counter row */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>Personalizing Nora</Text>
          <Text style={styles.counterText}>{phase}/{TOTAL_PHASES}</Text>
        </View>

        {/* Progress segments */}
        <View style={styles.segmentsContainer}>
          {Array.from({ length: TOTAL_PHASES }).map((_, index) => {
            const segmentPhase = index + 1;
            let fillRatio = 0;

            if (segmentPhase < phase) {
              fillRatio = 1;
            } else if (segmentPhase === phase) {
              fillRatio = step / totalSteps;
            }

            return (
              <View key={index} style={styles.segmentBackground}>
                <View
                  style={[
                    styles.segmentFill,
                    { width: `${fillRatio * 100}%` },
                  ]}
                />
              </View>
            );
          })}
        </View>

        {/* Phase name aligned right */}
        <Text style={styles.phaseName}>{phaseName}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 0,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#A2DFCB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  avatarImage: {
    width: 80,
    height: 80,
    marginLeft: 20,
  },
  rightSection: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#1E2939',
  },
  counterText: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 14,
    color: '#8C49D5',
  },
  segmentsContainer: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  segmentBackground: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F6F3F7',
    overflow: 'hidden',
  },
  segmentFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#8C49D5',
  },
  phaseName: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
});
