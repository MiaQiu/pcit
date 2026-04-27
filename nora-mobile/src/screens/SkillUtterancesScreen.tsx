/**
 * SkillUtterancesScreen
 * Shows transcript utterances categorized under a PEN skill or Area to Avoid,
 * with a link to the skill explanation screen.
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { RootStackNavigationProp, RootStackParamList } from '../navigation/types';

type SkillUtterancesRouteProp = RouteProp<RootStackParamList, 'SkillUtterances'>;

const DISPLAY_NAMES: Record<string, string> = {
  'Praise': 'Praise',
  'Labeled Praise': 'Praise',
  'Echo': 'Echo',
  'Narrate': 'Narration',
  'Narration': 'Narration',
  'Question': 'Questions',
  'Questions': 'Questions',
  'Command': 'Commands',
  'Commands': 'Commands',
  'Direct Command': 'Commands',
  'Indirect Command': 'Commands',
  'Criticism': 'Criticism',
  'Negative Talk': 'Criticism',
};

const PEN_SKILL_KEYS = new Set(['Praise', 'Labeled Praise', 'Echo', 'Narrate', 'Narration']);

const RolePill: React.FC<{ role?: string }> = ({ role }) => {
  const isChild = role === 'child';
  return (
    <View style={[styles.rolePill, { backgroundColor: isChild ? '#FFF3E0' : '#E3F2FD' }]}>
      <Text style={styles.rolePillText}>{isChild ? 'Child' : 'Adult'}</Text>
    </View>
  );
};

export const SkillUtterancesScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<SkillUtterancesRouteProp>();
  const { skillKey, recordingId, utterances } = route.params;

  const displayName = DISPLAY_NAMES[skillKey] || skillKey;
  const isPenSkill = PEN_SKILL_KEYS.has(skillKey);
  const accentColor = isPenSkill ? '#6750A4' : '#852221';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{displayName} Utterances</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Link to explanation screen */}
        <TouchableOpacity
          style={[styles.explainLink, { borderColor: accentColor }]}
          onPress={() => navigation.navigate('SkillExplanation', { skillKey })}
          activeOpacity={0.7}
        >
          <Ionicons name="bulb-outline" size={18} color={accentColor} />
          <Text style={[styles.explainLinkText, { color: accentColor }]}>
            Learn about {displayName}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={accentColor} />
        </TouchableOpacity>

        {/* Utterances list */}
        {utterances.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              No {displayName} utterances recorded in this session.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {utterances.map((item, index) => (
              <View key={index} style={styles.utteranceCard}>
                {item.preceding && (
                  <View style={styles.precedingRow}>
                    <RolePill role={item.preceding.role} />
                    <Text style={styles.precedingText}>{item.preceding.text}</Text>
                  </View>
                )}
                <View style={item.preceding ? styles.mainRowIndented : undefined}>
                  <RolePill role={item.main.role} />
                  <Text style={styles.utteranceText}>{item.main.text}</Text>
                  {item.main.feedback && (
                    <View style={[styles.feedbackBox, isPenSkill ? styles.feedbackDesirable : styles.feedbackUndesirable]}>
                      <Text style={[styles.feedbackText, isPenSkill ? styles.feedbackTextDesirable : styles.feedbackTextUndesirable]}>
                        {isPenSkill ? '✓ ' : '💡 '}{item.main.feedback}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
        {/* Full transcript link */}
        <TouchableOpacity
          style={styles.transcriptButton}
          onPress={() => navigation.navigate('Transcript', { recordingId })}
        >
          <Text style={styles.transcriptButtonText}>Read Full Transcript with Tips</Text>
        </TouchableOpacity>
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
  explainLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
  },
  explainLinkText: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  list: {
    gap: 12,
  },
  utteranceCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  precedingRow: {
    gap: 6,
    opacity: 0.5,
  },
  mainRowIndented: {
    borderLeftWidth: 2,
    borderLeftColor: '#D1D5DB',
    paddingLeft: 12,
    gap: 6,
  },
  rolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 4,
  },
  rolePillText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.textDark,
  },
  precedingText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textDark,
    lineHeight: 20,
  },
  utteranceText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textDark,
    lineHeight: 22,
  },
  feedbackBox: {
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  feedbackDesirable: {
    backgroundColor: '#F0FDF4',
  },
  feedbackUndesirable: {
    backgroundColor: '#FAF5FF',
  },
  feedbackText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
  },
  feedbackTextDesirable: {
    color: '#15803D',
  },
  feedbackTextUndesirable: {
    color: '#7E22CE',
  },
  transcriptButton: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 20,
    alignItems: 'center',
  },
  transcriptButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#0059DB',
  },
});
