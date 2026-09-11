/**
 * Next Level Overview Modal
 * Shown from ReportDetailScreen's "See you tomorrow" exit when this session
 * pushed the parent up a level. Previews the next skill on the Personalized
 * Learning Journey ladder using the exact same copy as ProfileReportScreen's
 * journey roadmap row for that level — journeyLevelBadge ("LEVEL N"),
 * profileReport.levels.<levelKey>.skill (e.g. "Narration"), and the
 * focus-area-personalised profileReport.journeyPlan.levelHelp.<levelKey>.<focusSlug>
 * one-liner — then asks for an explicit commitment before letting the parent
 * leave.
 */

import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS, COLORS } from '../constants/assets';
import { PARENT_SKILL_LEVEL_ICONS, PARENT_SKILL_LEVEL_KEYS } from '../constants/parentSkillLevels';
import type { ParentSkillLevel } from '@nora/core';

interface NextLevelOverviewModalProps {
  visible: boolean;
  level: ParentSkillLevel;
  // Top Child Snapshot focus-area key ('routines' | 'cooperation' |
  // 'selfControl' | 'boundaries'), or 'generic' with no survey signal — same
  // journeyFocusSlug ProfileReportScreen derives via primaryFocusAreas().
  focusSlug: string;
  childName: string;
  onCommit: () => void;
}

export const NextLevelOverviewModal: React.FC<NextLevelOverviewModalProps> = ({ visible, level, focusSlug, childName, onCommit }) => {
  const { t } = useTranslation();
  const levelKey = PARENT_SKILL_LEVEL_KEYS[level];
  const description = t(`profileReport.journeyPlan.levelHelp.${levelKey}.${focusSlug}` as any, { childName });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCommit}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconBadge}>
            <Ionicons name={PARENT_SKILL_LEVEL_ICONS[level]} size={30} color="#FFFFFF" />
          </View>

          <Text style={styles.eyebrow}>{t('profileReport.journeyLevelBadge', { level })}</Text>
          <Text style={styles.title}>{t(`profileReport.levels.${levelKey}.skill`)}</Text>

          <Text style={styles.description}>{description}</Text>

          <TouchableOpacity style={styles.commitButton} activeOpacity={0.85} onPress={onCommit}>
            <Text style={styles.commitButtonText}>{t('reportDetail.nextLevelOverview.commitButton')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(43, 26, 15, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFF8F0',
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 24,
    width: width - 40,
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.mainPurple,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  eyebrow: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#C2694B',
    marginBottom: 6,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: '#2B1A0F',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#5C4A3D',
    textAlign: 'center',
    marginBottom: 24,
  },
  commitButton: {
    backgroundColor: COLORS.mainPurple,
    borderRadius: 999,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  commitButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
