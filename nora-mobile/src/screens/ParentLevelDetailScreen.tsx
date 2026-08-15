/**
 * ParentLevelDetailScreen
 * Explains every level of the 7-level Personalized Learning Journey ladder,
 * highlighting the parent's current level. Opened from the Parenting Level
 * card on ReportScreen_v2.
 */

import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import type { ParentSkillLevel } from '@nora/core';
import { useTranslation } from 'react-i18next';
import amplitudeService from '../services/amplitudeService';

type ParentLevelDetailRouteProp = RouteProp<RootStackParamList, 'ParentLevelDetail'>;

// Same 7-level ladder shown in ReportScreen_v2 and ProfileReportScreen's
// Personalized Learning Journey.
const PARENT_SKILL_LEVELS: Array<{ level: ParentSkillLevel; key: string }> = [
  { level: 1, key: 'playBuilder' },
  { level: 2, key: 'confidenceBuilder' },
  { level: 3, key: 'attentionBuilder' },
  { level: 4, key: 'communicationBuilder' },
  { level: 5, key: 'cooperationBuilder' },
  { level: 6, key: 'boundaryBuilder' },
  { level: 7, key: 'confidentParent' },
];

export const ParentLevelDetailScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<ParentLevelDetailRouteProp>();
  const { t } = useTranslation();
  const { level: currentLevel } = route.params;

  useEffect(() => {
    amplitudeService.trackScreenView('Parent Level Detail', { currentLevel });
  }, [currentLevel]);

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('parentLevelDetail.title')}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>{t('parentLevelDetail.subtitle')}</Text>

        {PARENT_SKILL_LEVELS.map(step => {
          const status = step.level < currentLevel ? 'done' : step.level === currentLevel ? 'active' : 'locked';
          const learnItems = t(`profileReport.levels.${step.key}.learn`).split('•').map(s => s.trim()).filter(Boolean);

          return (
            <View
              key={step.key}
              style={[
                styles.levelCard,
                status === 'active' && styles.levelCardActive,
                status === 'locked' && styles.levelCardLocked,
              ]}
            >
              <View style={styles.levelHeaderRow}>
                <View style={[
                  styles.levelNumberBadge,
                  status === 'done' && styles.levelNumberBadgeDone,
                  status === 'locked' && styles.levelNumberBadgeLocked,
                ]}>
                  {status === 'done' ? (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  ) : status === 'locked' ? (
                    <Ionicons name="lock-closed" size={14} color="#9CA3AF" />
                  ) : (
                    <Text style={styles.levelNumberText}>{step.level}</Text>
                  )}
                </View>
                {status === 'active' && (
                  <View style={styles.currentBadge}>
                    <Text style={styles.currentBadgeText}>{t('parentLevelDetail.currentBadge')}</Text>
                  </View>
                )}
                {status === 'done' && (
                  <View style={styles.doneBadge}>
                    <Text style={styles.doneBadgeText}>{t('parentLevelDetail.doneBadge')}</Text>
                  </View>
                )}
              </View>

              <Text style={[styles.levelTitle, status === 'locked' && styles.levelTitleLocked]}>
                {t('profileReport.journeyLevelBadge', { level: step.level })}
              </Text>
              <Text style={[styles.levelName, status === 'locked' && styles.levelTextLocked]}>
                {t(`profileReport.levels.${step.key}.title`)}
              </Text>
              <Text style={[styles.levelSkill, status === 'locked' && styles.levelTextLocked]}>
                {t(`profileReport.levels.${step.key}.skill`)}
              </Text>

              <Text style={[styles.levelGoal, status === 'locked' && styles.levelTextLocked]}>
                <Text style={styles.levelGoalLabel}>{t('profileReport.journeyGoalLabel')}</Text>
                {t(`profileReport.levels.${step.key}.goal`)}
              </Text>

              {status !== 'locked' && (
                <View style={styles.learnBlock}>
                  <Text style={styles.learnLabel}>{t('parentLevelDetail.learnLabel')}</Text>
                  {learnItems.map((item, i) => (
                    <View key={i} style={styles.learnItemRow}>
                      <View style={styles.learnBullet} />
                      <Text style={styles.learnItemText}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}

              {status === 'active' && (
                <View style={styles.clearGoalBox}>
                  <View style={styles.clearGoalHeaderRow}>
                    <Ionicons name="flag" size={14} color="#B45309" />
                    <Text style={styles.clearGoalLabel}>{t('parentLevelDetail.clearGoalLabel')}</Text>
                  </View>
                  <Text style={styles.clearGoalText}>{t(`profileReport.levels.${step.key}.clearGoal`)}</Text>
                </View>
              )}

              {status === 'locked' && (
                <Text style={styles.lockedNote}>{t('parentLevelDetail.lockedBadge')}</Text>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textDark,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },

  levelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    padding: 16,
    marginBottom: 14,
  },
  levelCardActive: {
    backgroundColor: '#F5F0FF',
    borderColor: COLORS.mainPurple,
  },
  levelCardLocked: {
    backgroundColor: '#FAFAFA',
  },
  levelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  levelNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.mainPurple,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelNumberBadgeDone: {
    backgroundColor: '#10B981',
  },
  levelNumberBadgeLocked: {
    backgroundColor: '#E5E7EB',
  },
  levelNumberText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  currentBadge: {
    marginLeft: 'auto',
    backgroundColor: COLORS.mainPurple,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  currentBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  doneBadge: {
    marginLeft: 'auto',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  doneBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    color: '#047857',
    letterSpacing: 0.3,
  },
  levelTitle: {
    fontFamily: FONTS.bold,
    fontSize: 19,
    color: COLORS.textDark,
    marginBottom: 2,
  },
  levelTitleLocked: {
    color: '#9CA3AF',
  },
  levelName: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  levelSkill: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.mainPurple,
    marginBottom: 10,
  },
  levelTextLocked: {
    color: '#9CA3AF',
  },
  levelGoal: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textDark,
    lineHeight: 18,
  },
  levelGoalLabel: {
    fontFamily: FONTS.bold,
  },
  learnBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ECE5FB',
  },
  learnLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  learnItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  learnBullet: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.mainPurple,
    marginTop: 6,
  },
  learnItemText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textDark,
    lineHeight: 18,
  },
  lockedNote: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 10,
  },

  clearGoalBox: {
    marginTop: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 12,
  },
  clearGoalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  clearGoalLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#B45309',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  clearGoalText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
});
