/**
 * SkillUtterancesScreen
 * Shows transcript utterances categorized under a PEN skill or Area to Avoid,
 * with a link to the skill explanation screen.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';
import amplitudeService from '../services/amplitudeService';
import { TranscriptPanel } from '../components/TranscriptPanel';

type SkillUtterancesRouteProp = RouteProp<RootStackParamList, 'SkillUtterances'>;

// Maps from the route skillKey to the i18n namespace key (lowercase)
const SKILL_KEY_MAP: Record<string, string> = {
  'Praise (Labeled)': 'praise',
  'Echo': 'echo',
  'Narrate': 'narrate',
  'Questions': 'question',
  'Commands': 'command',
  'Criticism': 'criticism',
};

const PEN_SKILL_KEYS = new Set(['Praise (Labeled)', 'Echo', 'Narrate']);

// Maps this screen's skillKey vocabulary to TranscriptPanel's filter
// category names, so the embedded transcript auto-selects the matching chip.
const SKILL_KEY_TO_TRANSCRIPT_CATEGORY: Record<string, string> = {
  'Praise (Labeled)': 'Praise',
  'Echo': 'Echo',
  'Narrate': 'Narration',
  'Questions': 'Question',
  'Commands': 'Command',
  'Criticism': 'Criticism',
};

export const SkillUtterancesScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<SkillUtterancesRouteProp>();
  const { skillKey, recordingId, utterances, target, childUtteranceCount } = route.params;
  const { t } = useTranslation();

  const nsKey = SKILL_KEY_MAP[skillKey] || skillKey.toLowerCase();
  const isPenSkill = PEN_SKILL_KEYS.has(skillKey);
  const accentColor = isPenSkill ? '#6750A4' : '#852221';
  const transcriptCategory = SKILL_KEY_TO_TRANSCRIPT_CATEGORY[skillKey];

  const scrollViewRef = useRef<ScrollView>(null);
  const transcriptSectionY = useRef(0);

  const handleTranscriptNext = () => {
    scrollViewRef.current?.scrollTo({ y: Math.max(transcriptSectionY.current - 12, 0), animated: true });
  };

  useEffect(() => {
    amplitudeService.trackScreenView('Skill Utterances', { skillKey, recordingId });
  }, []);

  const displayName = t(`skillInfo.${nsKey}.displayName` as any);
  const whatItIs = t(`skillInfo.${nsKey}.whatItIs` as any);
  const contextTitle = t(`skillInfo.${nsKey}.contextTitle` as any);
  const contextDescription = t(`skillInfo.${nsKey}.contextDescription` as any);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('skillInfo.utterancesHeader', { name: displayName })}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Skill info card linking to full explanation */}
        <TouchableOpacity
          style={[styles.explainCard, { borderColor: accentColor }]}
          onPress={() => navigation.navigate('SkillExplanation', { skillKey, target })}
          activeOpacity={0.7}
        >
          <View style={styles.explainCardHeader}>
            <Ionicons name="bulb-outline" size={18} color={accentColor} />
            <Text style={[styles.explainLinkText, { color: accentColor }]}>
              {t('skillInfo.learnAbout', { name: displayName })}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={accentColor} />
          </View>
          {whatItIs && (
            <Text style={styles.whatItIsText}>{whatItIs}</Text>
          )}
        </TouchableOpacity>

        {/* Session goal */}
        {isPenSkill && target != null && (
          <View style={[styles.goalBadge, { borderColor: accentColor }]}>
            <Ionicons name="flag-outline" size={16} color={accentColor} />
            <View style={styles.goalTextBlock}>
              <Text style={[styles.goalText, { color: accentColor }]}>
                {t('skillInfo.goalDisplay' as any, { target })}
              </Text>
              {skillKey === 'Echo' && childUtteranceCount != null && childUtteranceCount < 10 && (
                <Text style={styles.goalSubText}>
                  {t('skillInfo.echoGoalDynamic' as any, { count: childUtteranceCount, target })}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Session context */}
        {contextTitle && (
          <View style={styles.contextSection}>
            <Text style={styles.contextTitle}>{contextTitle}</Text>
            <Text style={styles.contextDescription}>{contextDescription}</Text>
          </View>
        )}

        {/* Full transcript, embedded directly — no navigation needed. Same
            TranscriptPanel the standalone Transcript screen uses, scrolling
            within its own bounded box here since it's nested inside this
            screen's ScrollView. Pre-filtered to this skill. */}
        <View
          style={styles.transcriptSection}
          onLayout={(e) => { transcriptSectionY.current = e.nativeEvent.layout.y; }}
        >
          <Text style={styles.transcriptSectionLabel}>
            {t('skillInfo.transcriptFoundLabel', { count: utterances.length, skill: displayName })}
          </Text>
          <View style={styles.transcriptPanelWrapper}>
            <TranscriptPanel
              recordingId={recordingId}
              initialCategory={transcriptCategory}
              restrictToInitialCategory
              scrollHeight={650}
              onNext={handleTranscriptNext}
            />
          </View>
        </View>
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
    paddingTop: 20,
    paddingBottom: 40,
  },
  explainCard: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
  },
  explainCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  explainLinkText: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
  whatItIsText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 21,
    marginTop: 10,
  },
  goalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  goalTextBlock: {
    flex: 1,
    gap: 4,
  },
  goalText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
  goalSubText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
  },
  contextSection: {
    marginBottom: 16,
  },
  contextTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textDark,
    marginBottom: 4,
  },
  contextDescription: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 21,
  },
  transcriptSection: {
    marginTop: 24,
  },
  transcriptSectionLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  transcriptPanelWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
});
