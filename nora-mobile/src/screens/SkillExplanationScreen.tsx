/**
 * SkillExplanationScreen
 * Displays detailed explanation of PEN skills and areas to avoid
 */

import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { useTranslation } from 'react-i18next';
import amplitudeService from '../services/amplitudeService';

type SkillExplanationRouteProp = RouteProp<RootStackParamList, 'SkillExplanation'>;

// Aliases for different label formats — no translation needed
const SKILL_ALIASES: Record<string, string> = {
  'Labeled Praise': 'Praise',
  'Praise (Labeled)': 'Praise',
  'Praise(Labeled)': 'Praise',
  'Narration': 'Narrate',
  'Questions': 'Question',
  'Commands': 'Command',
};

// Structural metadata only — which skills are PEN vs avoid
const SKILL_CATEGORIES: Record<string, 'pen' | 'avoid'> = {
  praise: 'pen',
  echo: 'pen',
  narrate: 'pen',
  question: 'avoid',
  command: 'avoid',
  criticism: 'avoid',
};

export const SkillExplanationScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<SkillExplanationRouteProp>();
  const { skillKey, score, tip } = route.params;
  const { t } = useTranslation();

  const isOverallScore = skillKey === 'Overall';
  const showNextStep = isOverallScore && (score ?? 0) < 90 && tip;

  const canonicalKey = (SKILL_ALIASES[skillKey] || skillKey).toLowerCase();

  useEffect(() => {
    amplitudeService.trackScreenView('Skill Explanation', { skillKey, score });
  }, []);
  const category = SKILL_CATEGORIES[canonicalKey];

  const explanation = isOverallScore ? null : {
    title: t(`skillInfo.${canonicalKey}.title` as any),
    category,
    whatItIs: t(`skillInfo.${canonicalKey}.whatItIs` as any),
    whyImportant: t(`skillInfo.${canonicalKey}.whyImportant` as any),
    inDailyLife: t(`skillInfo.${canonicalKey}.inDailyLife` as any),
  };

  const getNoraScoreData = () => {
    const s = score ?? 0;
    const tier = s >= 90 ? 'excellent' : s >= 80 ? 'good' : 'payAttention';
    return {
      title: t('skillInfo.noraScore.title'),
      rating: t(`skillInfo.noraScore.${tier}.rating` as any),
      ratingColor: tier === 'payAttention' ? '#852221' : '#6750A4',
      introduction: t('skillInfo.noraScore.introduction'),
      summary: t(`skillInfo.noraScore.${tier}.summary` as any),
      science: t(`skillInfo.noraScore.${tier}.science` as any),
      result: t(`skillInfo.noraScore.${tier}.result` as any),
    };
  };

  const noraScoreExplanation = isOverallScore ? getNoraScoreData() : null;

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
              <Text style={styles.sectionTitle}>{t('skillInfo.theScience')}</Text>
            </View>
            <Text style={styles.sectionText}>{noraScoreExplanation.science}</Text>
          </View>

          {/* The Result */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="heart-outline" size={22} color={noraScoreExplanation.ratingColor} />
              <Text style={styles.sectionTitle}>{t('skillInfo.theResult')}</Text>
            </View>
            <Text style={styles.sectionText}>{noraScoreExplanation.result}</Text>
          </View>

          {/* The Next Step - only for Good and Pay Attention */}
          {showNextStep && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="arrow-forward-circle-outline" size={22} color={noraScoreExplanation.ratingColor} />
                <Text style={styles.sectionTitle}>{t('skillInfo.theNextStep')}</Text>
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
          <Text style={styles.headerTitle}>{t('skillInfo.skillDetails')}</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{t('skillInfo.skillNotAvailable')}</Text>
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
            {isPenSkill ? t('skillInfo.penSkill') : t('skillInfo.areaToAvoid')}
          </Text>
        </View>

        {/* What it is */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="help-circle-outline" size={22} color={accentColor} />
            <Text style={styles.sectionTitle}>{t('skillInfo.whatItIsLabel')}</Text>
          </View>
          <Text style={styles.sectionText}>{explanation.whatItIs}</Text>
        </View>

        {/* Why it's important */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bulb-outline" size={22} color={accentColor} />
            <Text style={styles.sectionTitle}>
              {isPenSkill ? t('skillInfo.whyImportantLabel') : t('skillInfo.whyAvoidLabel')}
            </Text>
          </View>
          <Text style={styles.sectionText}>{explanation.whyImportant}</Text>
        </View>

        {/* In Daily Life */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="home-outline" size={22} color={accentColor} />
            <Text style={styles.sectionTitle}>{t('skillInfo.inDailyLifeLabel')}</Text>
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
