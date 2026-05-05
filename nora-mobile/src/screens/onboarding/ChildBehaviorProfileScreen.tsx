/**
 * Child Behavior Profile Screen
 * Shows the child's WACB behavior profile snapshot based on total survey score
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp, OnboardingStackParamList } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { COLORS, FONTS } from '../../constants/assets';

type BehaviorCategory = 'stable' | 'mild' | 'medium' | 'high';

interface CategoryInfo {
  barLabel: string;        // label shown under gradient bar
  snapshotTitle: string;   // "Current Snapshot: ___"
  color: string;
  whatThisMeans: string;
  startingPlan: string;
  whatToExpect: string;
}

const CATEGORY_COLORS: Record<BehaviorCategory, string> = {
  stable: '#22C55E',
  mild: '#EAB308',
  medium: '#F97316',
  high: '#EF4444',
};

// Scale constants (0–63, matching server scoring)
const SCALE_MIN = 0;
const SCALE_MAX = 63;
const SCALE_RANGE = SCALE_MAX - SCALE_MIN;

function getCategory(score: number): BehaviorCategory {
  if (score <= 25) return 'stable';
  if (score <= 35) return 'mild';
  if (score <= 45) return 'medium';
  return 'high';
}

const VALUE_TO_POINTS: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 6, 5: 7 };

function toPoints(val?: number): number {
  if (val == null) return 0;
  return VALUE_TO_POINTS[val] ?? 0;
}

function computeTotalScore(wacb?: {
  q1Dawdle?: number; q2MealBehavior?: number; q3Disobey?: number; q4Angry?: number;
  q5Scream?: number; q6Destroy?: number; q7ProvokeFights?: number;
  q8Interrupt?: number; q9Attention?: number;
}): number {
  if (!wacb) return SCALE_MIN;
  return (
    toPoints(wacb.q1Dawdle) + toPoints(wacb.q2MealBehavior) + toPoints(wacb.q3Disobey) +
    toPoints(wacb.q4Angry) + toPoints(wacb.q5Scream) + toPoints(wacb.q6Destroy) +
    toPoints(wacb.q7ProvokeFights) + toPoints(wacb.q8Interrupt) + toPoints(wacb.q9Attention)
  );
}

export const ChildBehaviorProfileScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();
  const route = useRoute<RouteProp<OnboardingStackParamList, 'ChildBehaviorProfile'>>();
  const locked = route.params?.locked ?? false;
  const { data } = useOnboarding();

  const childName = data.childName || 'Your child';
  const totalScore = useMemo(() => computeTotalScore(data.wacb), [data.wacb]);
  const category = getCategory(totalScore);
  const info = {
    color: CATEGORY_COLORS[category],
    barLabel: t(`onboarding.childBehaviorProfile.barLabels.${category}`),
    snapshotTitle: t(`onboarding.childBehaviorProfile.snapshotTitles.${category}`),
    whatThisMeans: t(`onboarding.childBehaviorProfile.categories.${category}.whatThisMeans`),
    startingPlan: t(`onboarding.childBehaviorProfile.categories.${category}.startingPlan`),
    whatToExpect: t(`onboarding.childBehaviorProfile.categories.${category}.whatToExpect`),
  };
  const BAR_SEGMENTS: { key: BehaviorCategory; label: string; mid: number }[] = [
    { key: 'stable', label: t('onboarding.childBehaviorProfile.barSegments.stable'), mid: 12.5 },
    { key: 'mild',   label: t('onboarding.childBehaviorProfile.barSegments.mild'),   mid: 30   },
    { key: 'medium', label: t('onboarding.childBehaviorProfile.barSegments.medium'), mid: 40   },
    { key: 'high',   label: t('onboarding.childBehaviorProfile.barSegments.high'),   mid: 54   },
  ];

  const markerPosition = Math.max(0, Math.min(1, (totalScore - SCALE_MIN) / SCALE_RANGE));
  const [nameLabelWidth, setNameLabelWidth] = useState(0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Dragon + speech bubble */}
        <View style={styles.chatRow}>
          <View style={styles.dragonContainer}>
            <Image
              source={require('../../../assets/images/dragon_image.png')}
              style={styles.dragonIcon}
              resizeMode="contain"
            />
          </View>
          <View style={styles.speechBubble}>
            <Text style={styles.speechText}>
              {t('onboarding.childBehaviorProfile.speechBubble', { childName })}
            </Text>
            <View style={styles.bubbleTail} />
          </View>
        </View>

        {/* ── Profile snapshot card ── */}
        <View style={styles.card}>
          {locked && (
            <TouchableOpacity
              style={styles.lockOverlay}
              onPress={() => navigation.navigate('WacbQuestion1')}
              activeOpacity={0.9}
            >
              <Text style={styles.lockIcon}>🔒</Text>
              <Text style={styles.lockText}>
                {t('onboarding.childBehaviorProfile.lockText')}
              </Text>
            </TouchableOpacity>
          )}

          {/* Header */}
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t('onboarding.childBehaviorProfile.cardTitle', { childName })}</Text>
            <View style={styles.scoreChip}>
              <View style={[styles.scoreDot, { backgroundColor: info.color }]} />
              <Text style={styles.scoreNumber}>{totalScore}</Text>
            </View>
          </View>

          {/* Gradient bar */}
          <View style={styles.barSection}>
            <View
              style={[
                styles.youLabelContainer,
                {
                  left: `${markerPosition * 100}%`,
                  transform: [{ translateX: -nameLabelWidth / 2 }],
                },
              ]}
            >
              {/* <View
                style={styles.youLabel}
                onLayout={(e) => setNameLabelWidth(e.nativeEvent.layout.width)}
              >
                <Text style={styles.youLabelText}>{childName}</Text>
              </View> */}
            </View>

            <View style={styles.scaleNumbers}>
              {([0, 25, 35, 45, 63] as const).map((val) => (
                <Text
                  key={val}
                  style={[
                    styles.scaleNum,
                    {
                      position: 'absolute',
                      left: `${(val / SCALE_MAX) * 100}%`,
                      transform: [{ translateX: val === 0 ? 0 : val === 63 ? -14 : -7 }],
                    },
                  ]}
                >
                  {val}
                </Text>
              ))}
            </View>

            <View style={styles.barWrapper}>
              <View style={styles.segmentedBar}>
                {/* stable: 0–25 = 25/63 ≈ 39.68% */}
                <View style={[styles.barSegment, { flex: 25, backgroundColor: '#22C55E', borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
                {/* mild: 25–35 = 10/63 ≈ 15.87% */}
                <View style={[styles.barSegment, { flex: 10, backgroundColor: '#EAB308' }]} />
                {/* medium: 35–45 = 10/63 ≈ 15.87% */}
                <View style={[styles.barSegment, { flex: 10, backgroundColor: '#F97316' }]} />
                {/* high: 45–63 = 18/63 ≈ 28.57% */}
                <View style={[styles.barSegment, { flex: 18, backgroundColor: '#EF4444', borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />
              </View>
              <View style={[styles.markerCircle, { left: `${markerPosition * 100}%` }]} />
            </View>

            <View style={styles.categoryLabels}>
              {BAR_SEGMENTS.map(({ key, label, mid }) => (
                <Text
                  key={key}
                  style={[
                    styles.categoryLabel,
                    category === key && styles.categoryLabelActive,
                    {
                      position: 'absolute',
                      left: `${(mid / SCALE_MAX) * 100}%`,
                      transform: [{ translateX: -20 }],
                    },
                  ]}
                >
                  {label}
                </Text>
              ))}
            </View>
          </View>

          {/* Current snapshot title */}
          <Text style={styles.snapshotTitle}>{t('onboarding.childBehaviorProfile.currentSnapshot', { title: info.snapshotTitle })}</Text>

          {/* What this means */}
          <View style={styles.whatThisMeansBox}>
            <Text style={styles.sectionLabel}>{t('onboarding.childBehaviorProfile.whatThisMeans')}</Text>
            <Text style={styles.sectionBody}>{info.whatThisMeans}</Text>
          </View>
        </View>

        {/* ── Starting Plan + What to Expect combined card ── */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionLabel}>{t('onboarding.childBehaviorProfile.startingPlan')}</Text>
          {info.startingPlan.split('\n').filter(Boolean).map((line, i) => (
            <View key={i} style={styles.iconRow}>
              <Text style={styles.rowIcon}>💜</Text>
              <Text style={[styles.sectionBody, styles.iconRowText]}>{line}</Text>
            </View>
          ))}

          <View style={styles.divider} />

          <Text style={styles.sectionLabel}>{t('onboarding.childBehaviorProfile.whatToExpect')}</Text>
          {info.whatToExpect.split('\n').filter(Boolean).map((line, i) => (
            <View key={i} style={styles.iconRow}>
              <Text style={styles.rowIcon}>🌱</Text>
              <Text style={[styles.sectionBody, styles.iconRowText]}>{line}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Intro3')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>{t('onboarding.childBehaviorProfile.continueButton')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 32,
  },

  // Dragon + bubble
  chatRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    gap: 10,
  },
  dragonContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: '#F5F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  dragonIcon: {
    width: 90,
    height: 90,
    marginLeft: 22,
  },
  speechBubble: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  bubbleTail: {
    position: 'absolute',
    left: -8,
    top: 16,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderTopColor: 'transparent',
    borderRightColor: '#E5E7EB',
    borderBottomColor: 'transparent',
  },
  speechText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textDark,
    lineHeight: 21,
  },

  // Cards
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },

  // Lock overlay
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(243, 244, 246, 0.92)',
    borderRadius: 20,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  lockIcon: { fontSize: 32, marginBottom: 12 },
  lockText: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    color: COLORS.textDark,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Card header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 0,
  },
  cardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
    flex: 1,
    marginRight: 12,
    lineHeight: 22,
  },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreDot: { width: 10, height: 10, borderRadius: 5 },
  scoreNumber: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textDark,
  },

  // Gradient bar
  barSection: { marginBottom: 20 },
  youLabelContainer: { position: 'absolute', top: 0, zIndex: 10 },
  youLabel: {
    backgroundColor: COLORS.textDark,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  youLabelText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.white,
  },
  barWrapper: {
    marginTop: 4,
    height: 12,
    borderRadius: 6,
    overflow: 'visible',
    position: 'relative',
  },
  segmentedBar: { flexDirection: 'row', height: 12 },
  barSegment: { height: 12 },
  markerCircle: {
    position: 'absolute',
    top: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.textDark,
    borderWidth: 3,
    borderColor: COLORS.white,
    transform: [{ translateX: -10 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  scaleNumbers: { position: 'relative', height: 16, marginTop: 28 },
  scaleNum: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#9CA3AF',
    position: 'absolute',
  },
  categoryLabels: { position: 'relative', height: 16, marginTop: 4 },
  categoryLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#9CA3AF',
    position: 'absolute',
    width: 45,
    textAlign: 'center',
  },
  categoryLabelActive: {
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
  },

  // What this means (inside profile card)
  whatThisMeansBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },

  // Snapshot title (inside profile card)
  snapshotTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textDark,
    marginTop: 4,
    lineHeight: 20,
  },

  // Unified info cards
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },

  // Icon row layout
  iconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  rowIcon: {
    fontSize: 15,
    lineHeight: 22,
  },
  iconRowText: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },

  // Shared text styles
  sectionLabel: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    color: COLORS.textDark,
    marginBottom: 6,
  },
  sectionBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#8C49D5',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: COLORS.white,
  },
});
