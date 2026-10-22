/**
 * LearnModulePlanOverview
 * "My plan" tab of LearnModuleScreen_v2: the module's goal roadmap — header,
 * then each goal (LEARN_MODULES[moduleKey].goals) with its
 * status (completed / current / next / later). Progress = the goal's
 * strategies the parent has mastered (getGoalProgress). Tapping the current
 * (or a completed, or an `unlocked`) goal opens the detailed plan
 * (ModulePlanDetail); other later goals are locked. Below, "Past reports":
 * the module's daily reports, plus play time recordings when the parent has
 * special play, on a calendar (ReportsCalendar).
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/assets';
import { TrackedTouchable } from '../components/TrackedTouchable';
import { CalendarRecording, ReportsCalendar } from '../components/ReportsCalendar';
import { useModulePlan } from './LearnModulePlanView';
import { getGoalProgress, GoalProgress, LearnModuleKey, ModuleDay } from '../constants/learnModules';

const H_PAD = 20;
const PURPLE_TINT = '#F1EBFB';
const MUTED = '#6B7280';
const DONE_GREEN = '#2F9E5B';
const NUMBER_SIZE = 36;
const HEADER_ART = require('../../assets/images/modules/plan5.png');

interface Props {
  moduleKey: LearnModuleKey;
  onOpenPlan: (goal: GoalProgress) => void;
  onLockedGoal: (goal: GoalProgress) => void;
  // The module's analyzed reports, one per day (GET /api/learn-modules/:moduleKey/days).
  days: ModuleDay[];
  // Completed play time recordings (special play); empty when it's off.
  playRecordings: CalendarRecording[];
  onOpenReport: (day: ModuleDay) => void;
  onOpenPlayReport: (recordingId: string) => void;
}

const GoalCard: React.FC<{
  goal: GoalProgress;
  isLast: boolean;
  base: string;
  onPress: () => void;
}> = ({ goal, isLast, base, onPress }) => {
  const { t } = useTranslation();
  const highlighted = goal.status === 'current';

  return (
    <TrackedTouchable analyticsId={`Learn Module Plan Goal: ${goal.key}`}
      style={styles.goalCard}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Number + connector to the next goal */}
      <View style={styles.numberCol}>
        <View
          style={[
            styles.number,
            highlighted && styles.numberCurrent,
            goal.status === 'completed' && styles.numberDone,
          ]}
        >
          {goal.status === 'completed' ? (
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          ) : (
            <Text style={[styles.numberText, highlighted && styles.numberTextCurrent]}>{goal.number}</Text>
          )}
        </View>
        {!isLast && <View style={styles.connector} />}
      </View>

      <View style={styles.goalText}>
        <View style={[styles.statusPill, goal.status === 'completed' && styles.statusPillDone]}>
          <Text style={[styles.statusText, goal.status === 'completed' && styles.statusTextDone]}>
            {t(`learnV2.moduleScreenV2.planOverview.status.${goal.status}`)}
          </Text>
        </View>
        <Text style={styles.goalTitle}>{t(`${base}.${goal.key}.title`)}</Text>
        <Text style={styles.goalDescription}>{t(`${base}.${goal.key}.description`)}</Text>

        {goal.status === 'current' ? (goal.hideProgress ? null : (
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              {/* A sliver even at 0 so "In progress" reads as started */}
              <View style={[styles.progressFill, { width: `${Math.max(goal.mastered / goal.total, 0.08) * 100}%` }]} />
            </View>
            <Text style={styles.progressLabel}>{t('learnV2.moduleScreenV2.planOverview.inProgress')}</Text>
          </View>
        )) : goal.status === 'completed' ? (
          <View style={styles.metaRow}>
            <Ionicons name="checkmark-circle" size={16} color={DONE_GREEN} />
            <Text style={[styles.metaText, { color: DONE_GREEN }]}>{t('learnV2.moduleScreenV2.planOverview.done')}</Text>
          </View>
        ) : goal.unlocked ? null : (
          <View style={styles.metaRow}>
            <Ionicons name="lock-closed" size={15} color={MUTED} />
            <Text style={styles.metaText}>{t('learnV2.moduleScreenV2.planOverview.locked')}</Text>
          </View>
        )}
      </View>

      <Image source={goal.image} style={styles.goalArt} resizeMode="contain" />
      <Ionicons name="chevron-forward" size={18} color={MUTED} />
    </TrackedTouchable>
  );
};

export const LearnModulePlanOverview: React.FC<Props> = ({ moduleKey, onOpenPlan, onLockedGoal, days, playRecordings, onOpenReport, onOpenPlayReport }) => {
  const { t } = useTranslation();
  const { masteredStrategies } = useModulePlan(moduleKey);
  const goals = getGoalProgress(moduleKey, masteredStrategies.map(m => m.strategyId));
  const base = `learnV2.modules.${moduleKey}.goals`;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('learnV2.moduleScreenV2.planOverview.title')}</Text>
          <Text style={styles.subtitle}>{t('learnV2.moduleScreenV2.planOverview.subtitle')}</Text>
        </View>
        <Image source={HEADER_ART} style={styles.headerArt} resizeMode="contain" />
      </View>

      {/* Goals */}
      {goals.map((goal, i) => (
        <GoalCard
          key={goal.key}
          goal={goal}
          isLast={i === goals.length - 1}
          base={base}
          onPress={() => (goal.status === 'current' || goal.status === 'completed' || goal.unlocked ? onOpenPlan(goal) : onLockedGoal(goal))}
        />
      ))}

      {/* Past reports — shown before the first report too, with a note that they'll appear here */}
      <View style={styles.pastReports}>
        <ReportsCalendar
          title={t('learnV2.moduleScreenV2.planOverview.pastReports')}
          subtitle={days.length + playRecordings.length === 0 ? t('learnV2.moduleScreenV2.planOverview.pastReportsEmpty') : undefined}
          recordingDates={[...days, ...playRecordings].map(r => new Date(r.createdAt))}
          recordings={[
            ...days.map(day => ({
              id: day.reportId,
              createdAt: day.createdAt,
              analysisStatus: 'COMPLETED',
              moduleKey,
              label: t('learnV2.moduleScreenV2.planOverview.sessionReport', { session: day.dayNumber }),
            })),
            ...playRecordings,
          ]}
          onReportPress={(recordingId, reportModuleKey) => {
            if (!reportModuleKey) {
              onOpenPlayReport(recordingId);
              return;
            }
            const day = days.find(d => d.reportId === recordingId);
            if (day) onOpenReport(day);
          }}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: H_PAD, paddingBottom: 24 },

  // ── Header ──
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  headerText: { flex: 1 },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: '#1A1446',
  },
  subtitle: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 22, color: MUTED, marginTop: 6 },
  headerArt: { width: 170, height: 170 * (210 / 316), alignSelf: 'flex-end', marginRight: -12 },

  // ── Goal card ──
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 14,
    marginTop: 12,
    shadowColor: '#5B3A9E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  numberCol: { alignSelf: 'stretch', alignItems: 'center' },
  number: {
    width: NUMBER_SIZE,
    height: NUMBER_SIZE,
    borderRadius: NUMBER_SIZE / 2,
    borderWidth: 1.5,
    borderColor: '#E5DDF6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberCurrent: { backgroundColor: COLORS.mainPurple, borderColor: COLORS.mainPurple },
  numberDone: { backgroundColor: DONE_GREEN, borderColor: DONE_GREEN },
  numberText: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.textDark },
  numberTextCurrent: { color: '#FFFFFF' },
  connector: {
    flex: 1,
    width: 0,
    marginTop: 6,
    marginBottom: -14,
    borderLeftWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#D9CFF0',
  },
  goalText: { flex: 1 },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: PURPLE_TINT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusPillDone: { backgroundColor: '#E7F6EC' },
  statusText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: COLORS.mainPurple,
    textTransform: 'uppercase',
  },
  statusTextDone: { color: DONE_GREEN },
  goalTitle: { fontFamily: FONTS.bold, fontSize: 17, lineHeight: 22, color: COLORS.textDark, marginTop: 6 },
  goalDescription: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, color: MUTED, marginTop: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: PURPLE_TINT, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: COLORS.mainPurple },
  progressLabel: { fontFamily: FONTS.semiBold, fontSize: 12, color: COLORS.mainPurple },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  metaText: { fontFamily: FONTS.semiBold, fontSize: 13, color: MUTED },
  goalArt: { width: 80, height: 80 },

  pastReports: { marginTop: 28 },
});
