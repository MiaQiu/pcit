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
import { View, ScrollView, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS, COLORS } from '../constants/assets';
import { RootStackParamList, RootStackNavigationProp } from '../navigation/types';
import type { SkillImproveResult } from '@nora/core';
import amplitudeService from '../services/amplitudeService';

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

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backCircle} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={18} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={styles.backCircle} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{title}</Text>

        {skillImprove?.summary ? (
          <Text style={styles.summary}>{skillImprove.summary}</Text>
        ) : null}

        {opportunities.length === 0 ? (
          <Text style={styles.emptyState}>{t('skillImprove.emptyState')}</Text>
        ) : (
          <View style={styles.opportunityList}>
            {opportunities.map((opportunity: SkillImproveResult['opportunities'][number], index: number) => (
              <View key={index} style={styles.opportunityCard}>
                <Text style={styles.opportunityTitle}>{opportunity.title}</Text>
                <Text style={styles.opportunityExplanation}>{opportunity.explanation}</Text>

                {opportunity.quote ? (
                  <View style={styles.quoteBlock}>
                    {opportunity.quote.split('\n').map((line: string, lineIndex: number) => (
                      <Text key={lineIndex} style={styles.quoteLine}>{line}</Text>
                    ))}
                  </View>
                ) : null}

                {opportunity.suggestedRewrite ? (
                  <View style={styles.rewriteBlock}>
                    <Text style={styles.rewriteLabel}>{t('skillImprove.tryInstead')}</Text>
                    <Text style={styles.rewriteText}>{opportunity.suggestedRewrite}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
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
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: COLORS.textDark,
    marginTop: 4,
  },
  summary: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 23,
    color: '#4B5563',
    marginTop: 10,
  },
  emptyState: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 23,
    color: '#4B5563',
    marginTop: 24,
    textAlign: 'center',
  },
  opportunityList: {
    marginTop: 20,
    gap: 14,
  },
  opportunityCard: {
    backgroundColor: '#F7F7F9',
    borderRadius: 16,
    padding: 16,
  },
  opportunityTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.textDark,
  },
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
    borderLeftColor: '#0E7C66',
    gap: 4,
  },
  quoteLine: {
    fontFamily: FONTS.regular,
    fontStyle: 'italic',
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textDark,
  },
  rewriteBlock: {
    marginTop: 12,
  },
  rewriteLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#0E7C66',
  },
  rewriteText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textDark,
    marginTop: 2,
  },
});
