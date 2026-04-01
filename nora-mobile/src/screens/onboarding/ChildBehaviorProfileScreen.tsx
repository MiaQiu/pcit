/**
 * Child Behavior Profile Screen
 * Shows the child's WACB behavior profile snapshot based on total survey score
 * Inserted between Reassurance and FocusAreas screens
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { useOnboarding } from '../../contexts/OnboardingContext';
import { OnboardingButtonRow } from '../../components/OnboardingButtonRow';
import { COLORS, FONTS } from '../../constants/assets';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Scale constants (0–63 range, matching server scoring)
const SCALE_MIN = 0;
const SCALE_MAX = 63;
const SCALE_RANGE = SCALE_MAX - SCALE_MIN; // 54

type BehaviorCategory = 'stable' | 'mild' | 'medium' | 'high';

interface CategoryInfo {
  label: string;
  snapshotTitle: string;
  description: string;
  color: string;
}

const CATEGORY_INFO: Record<BehaviorCategory, CategoryInfo> = {
  stable: {
    label: 'STABLE',
    snapshotTitle: 'Smooth Sailing',
    description:
      "[Child's Name]'s behaviors are well within the typical range for their age. Many families see similar patterns at this stage. We'll help you keep nurturing the emotional and social skills that support healthy development.",
    color: '#22C55E',
  },
  mild: {
    label: 'MILD',
    snapshotTitle: 'A Few Bumpy Moments',
    description:
      "You may be noticing some behaviors that are starting to test your patience. This is quite common at this age. The good news is that small shifts now can make a big difference, and we'll guide you with simple ways to respond.",
    color: '#EAB308',
  },
  medium: {
    label: 'MEDIUM',
    snapshotTitle: 'Getting Challenging',
    description:
      "It may feel like you're managing a lot right now. [Child's Name] may be having difficulty handling big emotions. We'll focus on practical strategies to reduce daily friction and help things feel calmer at home.",
    color: '#F97316',
  },
  high: {
    label: 'HIGH INTENSITY',
    snapshotTitle: 'High Intensity',
    description:
      "It sounds like things may feel overwhelming right now. When behaviors happen frequently, it can be exhausting for parents and children alike. We'll start with clear, supportive steps to help de-escalate difficult moments and bring more calm into daily routines.",
    color: '#EF4444',
  },
};

function getCategory(score: number): BehaviorCategory {
  if (score <= 25) return 'stable';
  if (score <= 35) return 'mild';
  if (score <= 45) return 'medium';
  return 'high'; // 46–63
}

// Matches server-side VALUE_TO_POINTS mapping in wacb-survey.cjs
const VALUE_TO_POINTS: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 6, 5: 7 };

function toPoints(val?: number): number {
  if (val == null) return 0;
  return VALUE_TO_POINTS[val] ?? 0;
}

function computeTotalScore(wacb?: {
  q1Dawdle?: number;
  q2MealBehavior?: number;
  q3Disobey?: number;
  q4Angry?: number;
  q5Scream?: number;
  q6Destroy?: number;
  q7ProvokeFights?: number;
  q8Interrupt?: number;
  q9Attention?: number;
}): number {
  if (!wacb) return SCALE_MIN;
  return (
    toPoints(wacb.q1Dawdle) +
    toPoints(wacb.q2MealBehavior) +
    toPoints(wacb.q3Disobey) +
    toPoints(wacb.q4Angry) +
    toPoints(wacb.q5Scream) +
    toPoints(wacb.q6Destroy) +
    toPoints(wacb.q7ProvokeFights) +
    toPoints(wacb.q8Interrupt) +
    toPoints(wacb.q9Attention)
  );
}

export const ChildBehaviorProfileScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { data } = useOnboarding();

  const childName = data.childName || 'Your child';
  const totalScore = useMemo(() => computeTotalScore(data.wacb), [data.wacb]);
  const category = getCategory(totalScore);
  const info = CATEGORY_INFO[category];

  // Percentage position of marker on bar (0–1)
  const markerPosition = Math.max(
    0,
    Math.min(1, (totalScore - SCALE_MIN) / SCALE_RANGE)
  );

  // Replace placeholder with actual child name
  const description = info.description.replace(/\[Child's Name\]/g, childName);

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
              80% of parents in a similar situation to you have seen meaningful
              changes using Nora within a month.
            </Text>
            <View style={styles.bubbleTail} />
          </View>
        </View>

        {/* Profile card */}
        <View style={styles.card}>
          {/* Card header */}
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{childName}'s Behavior Profile Snapshot</Text>
            <View style={styles.scoreChip}>
              <View style={[styles.scoreDot, { backgroundColor: info.color }]} />
              <Text style={styles.scoreNumber}>{totalScore}</Text>
            </View>
          </View>

          {/* Gradient bar */}
          <View style={styles.barSection}>
            {/* "You" label above marker */}
            <View
              style={[
                styles.youLabelContainer,
                { left: `${markerPosition * 100}%` },
              ]}
            >
              <View style={styles.youLabel}>
                <Text style={styles.youLabelText}>You</Text>
              </View>
            </View>

            {/* Gradient bar with marker */}
            <View style={styles.barWrapper}>
              <LinearGradient
                colors={['#4ADE80', '#A3E635', '#FACC15', '#FB923C', '#EF4444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradientBar}
              />
              {/* Marker circle */}
              <View
                style={[
                  styles.markerCircle,
                  { left: `${markerPosition * 100}%` },
                ]}
              />
            </View>

            {/* Scale numbers */}
            <View style={styles.scaleNumbers}>
              <Text style={styles.scaleNum}>0</Text>
              <Text style={styles.scaleNum}>25</Text>
              <Text style={styles.scaleNum}>35</Text>
              <Text style={styles.scaleNum}>45</Text>
              <Text style={styles.scaleNum}>63</Text>
            </View>

            {/* Category labels */}
            <View style={styles.categoryLabels}>
              <Text style={[styles.categoryLabel, category === 'stable' && styles.categoryLabelActive]}>
                STABLE
              </Text>
              <Text style={[styles.categoryLabel, category === 'mild' && styles.categoryLabelActive]}>
                MILD
              </Text>
              <Text style={[styles.categoryLabel, category === 'medium' && styles.categoryLabelActive]}>
                MEDIUM
              </Text>
              <Text style={[styles.categoryLabel, category === 'high' && styles.categoryLabelActive]}>
                HIGH
              </Text>
            </View>
          </View>

          {/* Status box */}
          <View style={[styles.statusBox, { borderLeftColor: info.color }]}>
            <View style={styles.statusHeader}>
              {/* <View style={[styles.statusIconCircle, { backgroundColor: info.color }]}>
                <Text style={styles.statusIcon}>
                  {category === 'stable' ? '✓' : category === 'high' ? '!' : '~'}
                </Text>
              </View> */}
              <Text style={styles.statusTitle}>Current Snapshot: {info.snapshotTitle}</Text>
            </View>
            <Text style={styles.statusDescription}>{description}</Text>
          </View>
        </View>

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          This snapshot isn't a diagnosis — it's simply a starting point to guide your parenting support
        </Text>
      </ScrollView>

      {/* Footer buttons */}
      <View style={styles.footer}>
        <OnboardingButtonRow
          onBack={() => navigation.goBack()}
          onContinue={() => navigation.navigate('FocusAreas')}
          continueText="Continue  →"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 32,
  },

  // Dragon + speech bubble
  chatRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 28,
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

  // Card
  card: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
    marginTop:20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
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
  scoreDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  scoreNumber: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textDark,
  },

  // Bar
  barSection: {
    
    marginBottom: 20,
  },
  youLabelContainer: {
    position: 'absolute',
    top: 0,
    transform: [{ translateX: -18 }],
    zIndex: 10,
    alignItems: 'center',
  },
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
    marginTop: 28,
    height: 12,
    borderRadius: 6,
    overflow: 'visible',
    position: 'relative',
  },
  gradientBar: {
    height: 12,
    borderRadius: 6,
  },
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
  scaleNumbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  scaleNum: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#9CA3AF',
  },
  categoryLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  categoryLabel: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: '#9CA3AF',
    flex: 1,
    textAlign: 'center',
  },
  categoryLabelActive: {
    fontFamily: FONTS.bold,
    color: COLORS.textDark,
  },

  // Status box
  statusBox: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    //borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  statusIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusIcon: {
    color: COLORS.white,
    fontFamily: FONTS.bold,
    fontSize: 14,
  },
  statusTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.textDark,
    flex: 1,
    lineHeight: 20,
  },
  statusDescription: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },

  // Disclaimer
  disclaimer: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 8,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    //borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: COLORS.white,
    marginBottom: -20,
  },
});
