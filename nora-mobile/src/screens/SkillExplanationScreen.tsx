/**
 * SkillExplanationScreen
 * Displays detailed explanation of PEN skills and areas to avoid
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { RootStackNavigationProp, RootStackParamList } from '../navigation/types';

type SkillExplanationRouteProp = RouteProp<RootStackParamList, 'SkillExplanation'>;

// Skill explanation data
const SKILL_EXPLANATIONS: Record<string, {
  title: string;
  category: 'pen' | 'avoid';
  whatItIs: string;
  whyImportant: string;
  inDailyLife: string;
}> = {
  // PEN Skills
  'Praise': {
    title: 'Praise (Labeled)',
    category: 'pen',
    whatItIs: 'Specific feedback that identifies exactly what behavior you admire. Instead of a vague "Good job," you say, "I love how carefully you are stacking those blocks."',
    whyImportant: 'It builds Self-Efficacy (a child\'s belief in their ability to succeed). By labeling the action, you tell the child exactly which behaviors to repeat.',
    inDailyLife: 'Be a "detective" for the Positive Opposite. If your child usually struggles to wait, the moment you see them sitting patiently, use a Labeled Praise: "I\'m so proud of how patiently you are waiting for your snack."',
  },
  'Echo': {
    title: 'Echo',
    category: 'pen',
    whatItIs: 'Repeating or rephrasing what your child says. If they say "Big tower!", you respond with "Yes, a very big tower!"',
    whyImportant: 'Known as a Verbal Hug, it provides immediate validation and proves you are listening. It also acts as Language Modeling, showing correct grammar without the "withdrawal" of a correction.',
    inDailyLife: 'Use Energy Matching. If your child is excited about a small discovery, match their enthusiasm with an Echo. This proves you are "in sync" with their world.',
  },
  'Narrate': {
    title: 'Narrate',
    category: 'pen',
    whatItIs: 'Describing your child\'s actions out loud, like a sports commentator. For example: "You\'re putting the red car inside the garage."',
    whyImportant: 'It creates Joint Attention, which is the most effective way to improve a child\'s focus and attention span. It signals that their actions are important enough for your full attention.',
    inDailyLife: 'Replace questions with narration. Instead of asking "What are you drawing?", try "You are using the green crayon to make big circles." This provides attention without putting "Performance Pressure" on the child.',
  },
  // Areas to Avoid
  'Question': {
    title: 'Questions',
    category: 'avoid',
    whatItIs: 'Even "helpful" questions like "What color is that?" or "How was your day?".',
    whyImportant: 'Questions are often Hidden Commands. They force the child to stop playing and "answer to you," which breaks their Flow (deep immersion).',
    inDailyLife: 'Use Active Silence. When your child comes home from school, avoid the "interrogation." Use P.E.N. skills to narrate their actions until they feel secure enough to share information voluntarily.',
  },
  'Command': {
    title: 'Commands',
    category: 'avoid',
    whatItIs: 'Any instruction where you tell your child what to do (e.g., "Put the block there" or "Give me the toy").',
    whyImportant: 'Commands take the lead away from the child and can trigger a power struggle.',
    inDailyLife: 'The 10:1 Repair Rule:\n\n• Reduce the Volume: Aim to reduce the total number of commands you give in a day.\n\n• The Repair: Think of every command as a $10 withdrawal. To keep the relationship "in the black," aim to use your P.E.N. skills 10 times for every 1 command you give. This repairs the connection and ensures your child is neurologically "receptive" rather than "defensive."',
  },
  'Criticism': {
    title: 'Criticism',
    category: 'avoid',
    whatItIs: 'Any disapproval, including "No," "Stop," "Don\'t," or correcting a mistake.',
    whyImportant: 'It creates a Negative Attention Trap. If you give attention to a behavior by criticizing it, you may accidentally reinforce that behavior.',
    inDailyLife: 'Use Strategic Ignoring for minor misbehaviors like whining or pouting. Use a "Poker Face" and turn your attention away. The moment the behavior stops, jump back in with a Labeled Praise to reward the positive shift.',
  },
};

// Aliases for different label formats
const SKILL_ALIASES: Record<string, string> = {
  'Labeled Praise': 'Praise',
  'Praise (Labeled)': 'Praise',
  'Praise(Labeled)': 'Praise',
  'Narration': 'Narrate',
  'Questions': 'Question',
  'Commands': 'Command',
};

// Nora Score explanations based on score range
const getNoraScoreExplanation = (score: number): {
  title: string;
  rating: string;
  ratingColor: string;
  introduction: string;
  summary: string;
  science: string;
  result: string;
} => {
  const introduction = 'Your Nora Score is the daily balance you keep in your child\'s Emotional Bank Account. It measures your "Connection Capital"—the ratio of P.E.N. deposits to behavioral withdrawals made during your 5-minute Special Play Time.';

  if (score >= 90) {
    return {
      title: 'Nora Score',
      rating: 'Excellent',
      ratingColor: '#6750A4',
      introduction,
      summary: 'Your connection is overflowing! You\'ve made massive deposits today. By maintaining high skill density and avoiding withdrawals, you have signaled to your child that they are safe, seen, and supported.',
      science: 'Your child\'s Upstairs Brain (logic and empathy) is fully engaged and "in the lead."',
      result: 'Your child\'s emotional resilience is high today. With a full bank account, they are better equipped to handle frustrations, transitions, and big feelings with ease.',
    };
  } else if (score >= 80) {
    return {
      title: 'Nora Score',
      rating: 'Good',
      ratingColor: '#6750A4',
      introduction,
      summary: 'You\'re building a strong foundation. You have a healthy, positive balance in the bank. You are successfully practicing the "Mental Gym" workout and following your child\'s lead.',
      science: 'You are successfully balancing Cortisol vs. Oxytocin by focusing on pure connection.',
      result: 'Your child has a steady emotional buffer. They feel connected to you, which lowers their overall stress levels as they start their day.',
    };
  } else {
    return {
      title: 'Nora Score',
      rating: 'Pay Attention',
      ratingColor: '#852221',
      introduction,
      summary: 'Relational "leaks" happen. A lower score usually means the "Withdrawal Rate" (Commands, Questions, or Criticism) was high. This is a normal part of busy parenting, but it\'s a signal that the account needs a top-up.',
      science: 'A low balance can trigger the Downstairs Brain (survival mode), making children more sensitive to stress.',
      result: 'When "Connection Capital" is low, your child may have less emotional stamina for challenges, leading to quicker frustrations or "defense" behaviors.',
    };
  }
};

export const SkillExplanationScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<SkillExplanationRouteProp>();
  const { skillKey, score, tip } = route.params;

  // Check if this is the Overall Nora Score
  const isOverallScore = skillKey === 'Overall';

  // Show "The Next Step" for Good and Pay Attention scores (not Excellent)
  const showNextStep = isOverallScore && (score ?? 0) < 90 && tip;

  // Resolve alias to canonical key
  const canonicalKey = SKILL_ALIASES[skillKey] || skillKey;
  const explanation = isOverallScore ? null : SKILL_EXPLANATIONS[canonicalKey];
  const noraScoreExplanation = isOverallScore ? getNoraScoreExplanation(score ?? 0) : null;

  const handleBack = () => {
    navigation.goBack();
  };

  // Render Nora Score explanation
  if (isOverallScore && noraScoreExplanation) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{noraScoreExplanation.title}</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Score and Rating Badge */}
          <View style={styles.scoreHeader}>
            <Text style={styles.scoreValue}>{score ?? 0}</Text>
            <View style={[styles.categoryBadge, { backgroundColor: noraScoreExplanation.ratingColor }]}>
              <Text style={styles.categoryBadgeText}>{noraScoreExplanation.rating}</Text>
            </View>
          </View>

          {/* Introduction */}
          <View style={styles.section}>
            <Text style={styles.sectionText}>{noraScoreExplanation.introduction}</Text>
          </View>

          {/* Summary */}
          <View style={[styles.section, { backgroundColor: '#FAF5FF' }]}>
            <Text style={styles.sectionText}>{noraScoreExplanation.summary}</Text>
          </View>

          {/* The Science */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flask-outline" size={22} color={noraScoreExplanation.ratingColor} />
              <Text style={styles.sectionTitle}>The Science</Text>
            </View>
            <Text style={styles.sectionText}>{noraScoreExplanation.science}</Text>
          </View>

          {/* The Result */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="heart-outline" size={22} color={noraScoreExplanation.ratingColor} />
              <Text style={styles.sectionTitle}>The Result</Text>
            </View>
            <Text style={styles.sectionText}>{noraScoreExplanation.result}</Text>
          </View>

          {/* The Next Step - only for Good and Pay Attention */}
          {showNextStep && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="arrow-forward-circle-outline" size={22} color={noraScoreExplanation.ratingColor} />
                <Text style={styles.sectionTitle}>The Next Step</Text>
              </View>
              <Text style={styles.sectionText}>{tip}</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!explanation) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Skill Details</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Information not available for this skill.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isPenSkill = explanation.category === 'pen';
  const accentColor = isPenSkill ? '#6750A4' : '#852221';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={COLORS.textDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{explanation.title}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Category Badge */}
        <View style={[styles.categoryBadge, { backgroundColor: accentColor }]}>
          <Text style={styles.categoryBadgeText}>
            {isPenSkill ? 'PEN Skill' : 'Area to Avoid'}
          </Text>
        </View>

        {/* What it is */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="help-circle-outline" size={22} color={accentColor} />
            <Text style={styles.sectionTitle}>What it is</Text>
          </View>
          <Text style={styles.sectionText}>{explanation.whatItIs}</Text>
        </View>

        {/* Why it's important */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bulb-outline" size={22} color={accentColor} />
            <Text style={styles.sectionTitle}>
              {isPenSkill ? "Why it's important" : 'Why avoid it'}
            </Text>
          </View>
          <Text style={styles.sectionText}>{explanation.whyImportant}</Text>
        </View>

        {/* In Daily Life */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="home-outline" size={22} color={accentColor} />
            <Text style={styles.sectionTitle}>In Daily Life</Text>
          </View>
          <Text style={styles.sectionText}>{explanation.inDailyLife}</Text>
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
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 12,
  },
  scoreValue: {
    fontFamily: FONTS.bold,
    fontSize: 48,
    color: COLORS.textDark,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 24,
  },
  categoryBadgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
  },
  sectionText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textDark,
    lineHeight: 24,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
});
