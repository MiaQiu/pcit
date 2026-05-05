/**
 * HowToRecordCard Component
 * Card showing instructions for recording a play session
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FONTS, COLORS } from '../constants/assets';
import { useTranslation } from 'react-i18next';

interface HowToRecordCardProps {
  sessionMode?: 'specialTime' | 'discipline';
}

export const HowToRecordCard: React.FC<HowToRecordCardProps> = ({ sessionMode = 'specialTime' }) => {
  const { t } = useTranslation();
  const minutes = sessionMode === 'discipline' ? 10 : 5;
  const STEPS = [
    t('howToRecord.step1'),
    t('howToRecord.step2'),
    t('howToRecord.step3', { minutes }),
    t('howToRecord.step4', { minutes }),
  ];
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('howToRecord.title')}</Text>

      {STEPS.map((step, index) => (
        <View key={index} style={styles.stepItem}>
          <View style={styles.numberCircle}>
            <Text style={styles.numberText}>{index + 1}</Text>
          </View>
          <Text style={styles.stepText}>{step}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  numberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.textDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textDark,
    lineHeight: 22,
    paddingTop: 4,
  },
});
