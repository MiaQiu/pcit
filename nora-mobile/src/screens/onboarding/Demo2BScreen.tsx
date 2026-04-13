import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { OnboardingStackNavigationProp } from '../../navigation/types';

// ── Types ──────────────────────────────────────────────────────────────────
interface PenSkill {
  letter: string;
  rest: string;
  score: string;
  label: string;
  progress: number; // 0–1
  barColor: string;
  scoreColor: string;
}

interface AvoidItem {
  name: string;
  score: string;
  label: string;
  dotColor: string | null; // null = no dot
  scoreColor: string;
}

// ── Data ───────────────────────────────────────────────────────────────────
const PEN_SKILLS: PenSkill[] = [
  {
    letter: 'P', rest: 'raise (Labeled)',
    score: '6/10', label: 'Good',
    progress: 0.6, barColor: '#6B3FA0', scoreColor: '#6B3FA0',
  },
  {
    letter: 'E', rest: 'cho',
    score: '3/10', label: 'Pay attention',
    progress: 0.3, barColor: '#7B2020', scoreColor: '#7B2020',
  },
  {
    letter: 'N', rest: 'arrate',
    score: '15/10', label: 'Excellent',
    progress: 1, barColor: '#6B3FA0', scoreColor: '#6B3FA0',
  },
];

const AVOID_ITEMS: AvoidItem[] = [
  { name: 'Questions',  score: '1', label: 'Pay attention', dotColor: '#7B2020', scoreColor: '#7B2020' },
  { name: 'Commands',   score: '1', label: 'Pay attention', dotColor: '#7B2020', scoreColor: '#7B2020' },
  { name: 'Criticism',  score: '0', label: 'Excellent',     dotColor: null,      scoreColor: '#5B4FCF' },
];

// ── Sub-components ─────────────────────────────────────────────────────────
const PenRow: React.FC<PenSkill> = ({ letter, rest, score, label, progress, barColor, scoreColor }) => (
  <View style={row.container}>
    <View style={row.header}>
      <Text style={row.skillName}>
        <Text style={row.skillLetter}>{letter}</Text>
        {rest}
      </Text>
      <Text style={[row.score, { color: scoreColor }]}>
        {score} ({label}) {'>'}
      </Text>
    </View>
    <View style={row.barTrack}>
      <View style={[row.barFill, { width: `${progress * 100}%`, backgroundColor: barColor }]} />
    </View>
  </View>
);

const AvoidRow: React.FC<AvoidItem> = ({ name, score, label, dotColor, scoreColor }) => (
  <View style={avoid.container}>
    <View style={avoid.header}>
      <Text style={avoid.name}>{name}</Text>
      <Text style={[avoid.score, { color: scoreColor }]}>
        {score} ({label}) {'>'}
      </Text>
    </View>
    {dotColor && <View style={[avoid.dot, { backgroundColor: dotColor }]} />}
  </View>
);

// ── Screen ─────────────────────────────────────────────────────────────────
export const Demo2BScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Coaching report card with gradient border */}
      <View style={styles.cardWrapper}>
        <LinearGradient
          colors={['#B8D4F5', '#C8C0F0', '#D8E8FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}
        >
          <View style={styles.cardInner}>
            {/* PEN Skills */}
            <Text style={styles.sectionTitle}>Your PEN Skills</Text>
            {PEN_SKILLS.map((skill) => (
              <PenRow key={skill.letter} {...skill} />
            ))}

            <View style={styles.divider} />

            {/* Areas to Avoid */}
            <Text style={styles.sectionTitle}>Areas to Avoid</Text>
            {AVOID_ITEMS.map((item) => (
              <AvoidRow key={item.name} {...item} />
            ))}
          </View>
        </LinearGradient>
      </View>

      {/* Body text */}
      <View style={styles.textContainer}>
        <Text style={styles.body}>
          Nora helps you understand your child's behavior — and your parenting patterns.
        </Text>
      </View>

      {/* Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate('Demo3')}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>Next  →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  cardWrapper: {
    marginHorizontal: 20,
    marginTop: 32,
  },
  gradientBorder: {
    borderRadius: 24,
    padding: 2,
  },
  cardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
  },
  sectionTitle: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  textContainer: {
    paddingHorizontal: 28,
    paddingTop: 28,
    alignItems: 'center',
  },
  body: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 18,
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 28,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
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
    fontFamily: 'PlusJakartaSans_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
  },
});

const row = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  skillName: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: '#1F2937',
  },
  skillLetter: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 15,
    color: '#1F2937',
  },
  score: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
  },
  barTrack: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },
});

const avoid = StyleSheet.create({
  container: {
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 15,
    color: '#1F2937',
  },
  score: {
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
});
