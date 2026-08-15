/**
 * PersonalizingProgressHeader
 * Progress header for the ADHD/developmental-concern branch questions
 * (DiagnosisStatus, ProfessionalSupport). Same avatar treatment as
 * OnboardingProgressHeader, but segments represent steps in this
 * mini-flow rather than onboarding phases.
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useTranslation } from 'react-i18next';

interface PersonalizingProgressHeaderProps {
  step: number; // 1-N
  totalSteps: number;
}

export const PersonalizingProgressHeader: React.FC<PersonalizingProgressHeaderProps> = ({
  step,
  totalSteps,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.avatarContainer}>
        <Image
          source={require('../../assets/images/dragon_image.png')}
          style={styles.avatarImage}
          resizeMode="contain"
        />
      </View>

      <View style={styles.rightSection}>
        <Text style={styles.title}>{t('onboarding.progressHeader.title')}</Text>

        <View style={styles.segmentsContainer}>
          {Array.from({ length: totalSteps }).map((_, index) => (
            <View key={index} style={styles.segmentBackground}>
              <View
                style={[
                  styles.segmentFill,
                  { width: index < step ? '100%' : '0%' },
                ]}
              />
            </View>
          ))}
        </View>
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
  title: {
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 14,
    color: '#1E2939',
    marginBottom: 6,
  },
  segmentsContainer: {
    flexDirection: 'row',
    gap: 4,
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
});
