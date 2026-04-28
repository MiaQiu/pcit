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

const PRAISE_DESC = 'Specific feedback that identifies exactly what behavior you admire. Instead of a vague "Good job," you say, "I love how carefully you are stacking those blocks."';
const ECHO_DESC = 'Repeating or rephrasing what your child says. If they say "Big tower!", you respond with "Yes, a very big tower!"';
const NARRATE_DESC = "Describing your child's actions out loud, like a sports commentator. For example: \"You're putting the red car inside the garage.\"";
const QUESTION_DESC = 'Even "helpful" questions like "What color is that?" or "How was your day?".';
const COMMAND_DESC = 'Any instruction where you tell your child what to do (e.g., "Put the block there" or "Give me the toy").';
const CRITICISM_DESC = 'Any disapproval, including "No," "Stop," "Don\'t," or correcting a mistake.';

const SESSION_CONTEXT: Record<string, { title: string; description: string }> = {
  'Praise': { title: 'What counts as Praise?', description: 'These are moments where you named exactly what your child did well — specific statements that tell them precisely which behaviour to repeat.' },
  'Echo': { title: 'What counts as Echo?', description: 'These are moments where you repeated or rephrased your child\'s own words, showing you were fully listening and validating what they said.' },
  'Narrate': { title: 'What counts as Narration?', description: 'These are moments where you described your child\'s actions aloud, directing your full attention to what they were doing.' },
  'Question': { title: 'What counts as a Question?', description: 'These are moments where you asked something — even well-meaning questions can act as hidden commands that interrupt your child\'s focus and flow.' },
  'Command': { title: 'In this session', description: 'These are moments where you gave an instruction or directed your child\'s behaviour, which can shift the lead away from them.' },
  'Criticism': { title: 'What counts as Criticism?', description: 'These are moments where you used disapproving language — saying "No," "Stop," "Don\'t," or correcting a mistake, which can accidentally reinforce the behaviour.' },
};

const WHAT_IT_IS: Record<string, string> = {
  'Praise': PRAISE_DESC,
  'Labeled Praise': PRAISE_DESC,
  'Praise (Labeled)': PRAISE_DESC,
  'Praise(Labeled)': PRAISE_DESC,
  'Echo': ECHO_DESC,
  'Narrate': NARRATE_DESC,
  'Narration': NARRATE_DESC,
  'Question': QUESTION_DESC,
  'Questions': QUESTION_DESC,
  'Command': COMMAND_DESC,
  'Commands': COMMAND_DESC,
  'Direct Command': COMMAND_DESC,
  'Indirect Command': COMMAND_DESC,
  'Criticism': CRITICISM_DESC,
  'Negative Talk': CRITICISM_DESC,
};

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

  const whatItIs = WHAT_IT_IS[skillKey];

  const CONTEXT_CANONICAL: Record<string, string> = {
    'Labeled Praise': 'Praise', 'Praise (Labeled)': 'Praise', 'Praise(Labeled)': 'Praise',
    'Narration': 'Narrate',
    'Questions': 'Question', 'Commands': 'Command',
    'Direct Command': 'Command', 'Indirect Command': 'Command',
    'Negative Talk': 'Criticism',
  };
  const sessionContext = SESSION_CONTEXT[CONTEXT_CANONICAL[skillKey] || skillKey];

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
        {/* Skill info card linking to full explanation */}
        <TouchableOpacity
          style={[styles.explainCard, { borderColor: accentColor }]}
          onPress={() => navigation.navigate('SkillExplanation', { skillKey })}
          activeOpacity={0.7}
        >
          <View style={styles.explainCardHeader}>
            <Ionicons name="bulb-outline" size={18} color={accentColor} />
            <Text style={[styles.explainLinkText, { color: accentColor }]}>
              Learn about {displayName}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={accentColor} />
          </View>
          {whatItIs && (
            <Text style={styles.whatItIsText}>{whatItIs}</Text>
          )}
        </TouchableOpacity>

        {/* Session context */}
        {sessionContext && (
          <View style={styles.contextSection}>
            <Text style={styles.contextTitle}>{sessionContext.title}</Text>
            <Text style={styles.contextDescription}>{sessionContext.description}</Text>
          </View>
        )}

        {/* Transcript context hint */}
        <TouchableOpacity
          style={styles.contextHint}
          onPress={() => navigation.navigate('Transcript', { recordingId })}
          activeOpacity={0.7}
        >
          {/* <Text style={styles.contextHintText}>
            Want to see each moment with full surrounding context?{' '}
            <Text style={styles.contextHintLink}>Read the full transcript</Text>
          </Text> */}
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
                {/* {item.preceding && (
                  <View style={styles.precedingRow}>
                    <RolePill role={item.preceding.role} />
                    <Text style={styles.precedingText}>{item.preceding.text}</Text>
                  </View>
                )} */}
                <View style={item.preceding ? styles.mainRowIndented : undefined}>
                  {/* <RolePill role={item.main.role} /> */}
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
          <Text style={styles.transcriptButtonText}>Read Full Conversation</Text>
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
  contextHint: {
    marginBottom: 16,
  },
  contextHintText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  contextHintLink: {
    fontFamily: FONTS.semiBold,
    color: '#0059DB',
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
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  precedingRow: {
    gap: 6,
    opacity: 0.5,
  },
  mainRowIndented: {
    //borderLeftWidth: 2,
    //borderLeftColor: '#D1D5DB',
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
    //borderTopWidth: 1,
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
