import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { DemoTemplate } from './DemoTemplate';
import amplitudeService from '../../services/amplitudeService';

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
  const { t } = useTranslation();

  useEffect(() => { amplitudeService.trackOnboardingScreen('demo2b', 7); }, []);

  const PEN_SKILLS: PenSkill[] = [
    { letter: 'P', rest: t('onboarding.demo2B.praiseLabeled'), score: '6/10', label: t('onboarding.demo2B.labelGood'), progress: 0.6, barColor: '#6B3FA0', scoreColor: '#6B3FA0' },
    { letter: 'E', rest: t('onboarding.demo2B.echo'), score: '3/10', label: t('onboarding.demo2B.labelPayAttention'), progress: 0.3, barColor: '#7B2020', scoreColor: '#7B2020' },
    { letter: 'N', rest: t('onboarding.demo2B.narrate'), score: '15/10', label: t('onboarding.demo2B.labelExcellent'), progress: 1, barColor: '#6B3FA0', scoreColor: '#6B3FA0' },
  ];

  const AVOID_ITEMS: AvoidItem[] = [
    { name: t('onboarding.demo2B.questions'), score: '1', label: t('onboarding.demo2B.labelPayAttention'), dotColor: '#7B2020', scoreColor: '#7B2020' },
    { name: t('onboarding.demo2B.commands'), score: '1', label: t('onboarding.demo2B.labelPayAttention'), dotColor: '#7B2020', scoreColor: '#7B2020' },
    { name: t('onboarding.demo2B.criticism'), score: '0', label: t('onboarding.demo2B.labelExcellent'), dotColor: null, scoreColor: '#5B4FCF' },
  ];

  return (
    <DemoTemplate
      text={t('onboarding.demo2B.text')}
      onBack={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Demo2')}
      onNext={() => { amplitudeService.trackOnboardingStepCompleted('demo2b', 7); navigation.navigate('Demo3'); }}
    >
      <View style={styles.cardWrapper}>
        <LinearGradient
          colors={['#B8D4F5', '#C8C0F0', '#D8E8FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}
        >
          <View style={styles.cardInner}>
            <Text style={styles.sectionTitle}>{t('onboarding.demo2B.penSkills')}</Text>
            {PEN_SKILLS.map((skill) => (
              <PenRow key={skill.letter} {...skill} />
            ))}
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>{t('onboarding.demo2B.areasToAvoid')}</Text>
            {AVOID_ITEMS.map((item) => (
              <AvoidRow key={item.name} {...item} />
            ))}
          </View>
        </LinearGradient>
      </View>
    </DemoTemplate>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  cardWrapper: {
    marginHorizontal: 28,
    marginTop:60
  },
  gradientBorder: {
    borderRadius: 24,
    padding: 8,
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
