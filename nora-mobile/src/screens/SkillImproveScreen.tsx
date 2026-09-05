/**
 * SkillImproveScreen
 * Opened from ReportDetailScreen's "Coach's Corner" card via the
 * "Improve/Remove {skill} in this session" link. Shows the session-grounded
 * opportunities to build (or reduce) the session's target skill —
 * generateSkillImprove server-side — each with a real transcript excerpt
 * where one was found, plus a suggested rewrite in the parent's voice.
 *
 * Data arrives fully resolved via route params (same pattern as
 * DemoVideoDetailScreen's `video` param) — no fetch here, since it's
 * precomputed once during the analysis pipeline alongside skillCoaching.
 */

import React, { useEffect } from 'react';
import { View, ScrollView, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS, COLORS, REPORT_DETAIL_DRAGON, REPORT_DRAGON_GOOD } from '../constants/assets';
import { ReportCard, REPORT_CARD_COLORS } from '../components/ReportCard';
import { RootStackParamList, RootStackNavigationProp } from '../navigation/types';
import type { SkillImproveResult } from '@nora/core';
import amplitudeService from '../services/amplitudeService';

// Same "Warm Elevation" accent split used elsewhere for build-vs-avoid goals
// (e.g. ReportDetailScreen's improveBadge vs demoBadge/crisis colors) — green
// for skills we're building up, terracotta for ones we're dialing back.
const ACCENTS = {
  BUILD: { color: '#0B9A6B', background: '#CFF3E3', icon: 'trending-up' as const },
  AVOID: { color: '#C2694B', background: '#FBE3CE', icon: 'trending-down' as const },
};

// Rotating palette for the opportunity cards — same hues ReportScreen.tsx
// uses per skill tag (praise green, echo blue, narration purple, command
// orange) — cycled by index just to keep a long list visually varied rather
// than tied to any one skill's meaning.
const OPPORTUNITY_COLORS: { color: string; background: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { color: '#8C49D5', background: '#F5EAFB', icon: 'bulb' },
  { color: '#3B82F6', background: '#DBEAFE', icon: 'chatbubble-ellipses' },
  { color: '#F97316', background: '#FFEDD5', icon: 'flash' },
  { color: '#EC4899', background: '#FCE7F3', icon: 'heart' },
];

type SkillImproveRouteProp = RouteProp<RootStackParamList, 'SkillImprove'>;

// Same API-label → i18n-key mapping used by ReportDetailScreen.tsx / ReportScreen.tsx.
const SKILL_LABEL_I18N_KEY: Record<string, string> = {
  'Praise (Labeled)': 'praiseLabeleld',
  'Echo': 'echo',
  'Narrate': 'narrate',
  'Questions': 'questions',
  'Commands': 'commands',
  'Criticism': 'criticism',
};

const getSkillDisplayLabel = (apiLabel: string, t: Function): string => {
  const key = SKILL_LABEL_I18N_KEY[apiLabel];
  if (!key) return apiLabel;
  const translated = t(`report.skillLabel.${key}`);
  return translated || apiLabel;
};

export const SkillImproveScreen: React.FC = () => {
  const route = useRoute<SkillImproveRouteProp>();
  const navigation = useNavigation<RootStackNavigationProp>();
  const { recordingId, skillTag, direction, skillImprove } = route.params;
  const { t } = useTranslation();

  useEffect(() => {
    amplitudeService.trackScreenView('SkillImprove');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skillLabel = getSkillDisplayLabel(skillTag, t);
  const title = t(
    direction === 'AVOID' ? 'skillImprove.titleAvoid' : 'skillImprove.titleBuild',
    { skill: skillLabel }
  );
  const opportunities = skillImprove?.opportunities || [];
  const accent = ACCENTS[direction === 'AVOID' ? 'AVOID' : 'BUILD'];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backCircle} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color={REPORT_CARD_COLORS.title} />
        </TouchableOpacity>
        <View style={styles.backCircle} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <Image source={REPORT_DETAIL_DRAGON} style={styles.heroDragon} resizeMode="contain" />
            <View style={styles.heroTextCol}>
              <View style={[styles.skillPill, { backgroundColor: accent.background }]}>
                <Ionicons name={accent.icon} size={12} color={accent.color} />
                <Text style={[styles.skillPillText, { color: accent.color }]}>{skillLabel}</Text>
              </View>
              <Text style={styles.title}>{title}</Text>
            </View>
          </View>

          {skillImprove?.summary ? (
            <View style={styles.heroSummaryRow}>
              <Ionicons name="sparkles" size={16} color={accent.color} style={styles.summaryBannerIcon} />
              <Text style={styles.summaryText}>{skillImprove.summary}</Text>
            </View>
          ) : null}
        </View>

        {opportunities.length === 0 ? (
          <View style={styles.emptyCard}>
            <Image source={REPORT_DRAGON_GOOD} style={styles.emptyDragon} resizeMode="contain" />
            <Text style={styles.emptyState}>{t('skillImprove.emptyState')}</Text>
          </View>
        ) : (
          <View style={styles.opportunityList}>
            {opportunities.map((opportunity: SkillImproveResult['opportunities'][number], index: number) => {
              const palette = OPPORTUNITY_COLORS[index % OPPORTUNITY_COLORS.length];
              return (
                <ReportCard
                  key={index}
                  icon={palette.icon}
                  iconColor={palette.color}
                  iconBackgroundColor={palette.background}
                  eyebrow={
                    <View style={[styles.opportunityPill, { backgroundColor: palette.background }]}>
                      <Text style={[styles.opportunityPillText, { color: palette.color }]}>
                        {t('skillImprove.opportunityLabel', { number: index + 1 })}
                      </Text>
                    </View>
                  }
                  title={opportunity.title}
                >
                  <Text style={styles.opportunityExplanation}>{opportunity.explanation}</Text>

                  {opportunity.quote ? (
                    <View style={[styles.quoteBlock, { borderLeftColor: palette.color }]}>
                      <Ionicons name="chatbox-ellipses-outline" size={14} color="#9CA3AF" style={styles.quoteIcon} />
                      {opportunity.quote.split('\n').map((line: string, lineIndex: number) => (
                        <Text key={lineIndex} style={styles.quoteLine}>{line}</Text>
                      ))}
                    </View>
                  ) : null}

                  {opportunity.suggestedRewrite ? (
                    <View style={[styles.rewriteBlock, { backgroundColor: ACCENTS.BUILD.background }]}>
                      <View style={styles.rewriteLabelRow}>
                        <Ionicons name="checkmark-circle" size={14} color={ACCENTS.BUILD.color} />
                        <Text style={[styles.rewriteLabel, { color: ACCENTS.BUILD.color }]}>{t('skillImprove.tryInstead')}</Text>
                      </View>
                      <Text style={styles.rewriteText}>{opportunity.suggestedRewrite}</Text>
                    </View>
                  ) : null}
                </ReportCard>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFF8F0' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F5EAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 40 },

  heroCard: {
    backgroundColor: '#F1EEFB',
    borderRadius: 28,
    padding: 20,
    marginBottom: 18,
    shadowColor: '#8C49D5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 3,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroDragon: {
    width: 84,
    height: 84,
    flexShrink: 0,
  },
  heroTextCol: { flex: 1, gap: 6 },
  skillPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  skillPillText: { fontFamily: FONTS.bold, fontSize: 11 },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
    color: REPORT_CARD_COLORS.title,
  },

  heroSummaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(140, 73, 213, 0.15)',
  },
  summaryBannerIcon: { marginTop: 2 },
  summaryText: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textDark,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyDragon: { width: 120, height: 120 },
  emptyState: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 23,
    color: '#4B5563',
    textAlign: 'center',
  },

  opportunityList: {
    gap: 14,
  },
  opportunityPill: { alignSelf: 'flex-start', marginBottom: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  opportunityPillText: { fontFamily: FONTS.bold, fontSize: 11 },
  opportunityExplanation: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: '#4B5563',
    marginTop: 6,
  },
  quoteBlock: {
    marginTop: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
    gap: 4,
  },
  quoteIcon: { marginBottom: 2 },
  quoteLine: {
    fontFamily: FONTS.regular,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 20,
    color: REPORT_CARD_COLORS.title,
  },
  rewriteBlock: {
    marginTop: 12,
    borderRadius: 16,
    padding: 12,
  },
  rewriteLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rewriteLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
  },
  rewriteText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: REPORT_CARD_COLORS.title,
    marginTop: 4,
  },
});
