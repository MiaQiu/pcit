import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { OnboardingStackNavigationProp } from '../../navigation/types';
import { OnboardingBackButton } from '../../components/OnboardingBackButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 16;
const CARD_GAP = 5;
const CARD_W = (SCREEN_WIDTH - H_PAD * 2 - CARD_GAP) / 2;
const CARD_H = CARD_W * 1.2;
const LABEL_H = 48;


// ── Score row ─────────────────────────────────────────────────────────────────
const ScoreRow: React.FC<{ name: string; score: string; label: string; progress: number; color: string }> = ({
  name, score, label, progress, color,
}) => (
  <View style={sr.wrap}>
    <View style={sr.header}>
      <Text style={sr.name} numberOfLines={1}>{name}</Text>
      <Text style={[sr.score, { color }]} numberOfLines={1}>{score} ({label}) ›</Text>
    </View>
    <View style={sr.track}>
      <View style={[sr.fill, { width: `${Math.min(progress, 1) * 100}%`, backgroundColor: color }]} />
    </View>
  </View>
);
const sr = StyleSheet.create({
  wrap: { marginBottom: 5 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  name: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 9, color: '#1F2937', flex: 1 },
  score: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 9, flexShrink: 0 },
  track: { height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
});

// ── Chip ──────────────────────────────────────────────────────────────────────
const Chip: React.FC<{ text: string; color: string; bg: string }> = ({ text, color, bg }) => (
  <View style={[ch.box, { backgroundColor: bg }]}>
    <Text style={[ch.text, { color }]}>{text}</Text>
  </View>
);
const ch = StyleSheet.create({
  box: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' },
  text: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 9 },
});

// ── Card ──────────────────────────────────────────────────────────────────────
const PolaroidCard: React.FC<{ label: string; rotate: string; children: React.ReactNode }> = ({
  label, rotate, children,
}) => (
  <View style={[pc.wrapper, { transform: [{ rotate }] }]}>
    <View style={pc.shadow}>
      <View style={pc.card}>
        <View style={pc.pill} />
        <View style={pc.content}>{children}</View>
        <View style={pc.labelWrap}>
          <Text style={pc.label} adjustsFontSizeToFit numberOfLines={2}>{label}</Text>
        </View>
      </View>
    </View>
  </View>
);
const pc = StyleSheet.create({
  wrapper: {
    width: CARD_W,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  shadow: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  pill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  labelWrap: {
    height: LABEL_H,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  label: {
    fontFamily: 'PlusJakartaSans_700Bold',
    fontSize: 17,
    color: '#1F2937',
    textAlign: 'center',
  },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export const PlaySession4Screen: React.FC = () => {
  const navigation = useNavigation<OnboardingStackNavigationProp>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const c = (key: string) => t(`onboarding.playSession4.cards.${key}`);
  const d = (key: string) => t(`onboarding.demo2B.${key}`);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{t('onboarding.playSession4.title')}</Text>
      </View>
      <View style={styles.subtitleContainer}>
        <Text style={styles.subtitle}>{t('onboarding.playSession4.subtitle')}</Text>
      </View>

      <View style={styles.gridOuter}>
        <View style={styles.grid}>

          {/* Card 1 — Parenting Pattern */}
          <PolaroidCard label={c('parentingPattern')} rotate="-5deg">
            <View style={s.ebaRow}>
              <Text style={s.ebaTitle}>{c('ebaTitle')}</Text>
              <Text style={s.ebaScore}>{c('ebaScore')} ({c('ebaLabel')}) ›</Text>
            </View>
            <View style={s.ebaBar} />
            <Text style={s.overallLabel}>{c('overallLabel')}</Text>
            <View style={s.divider} />
            <Text style={s.penTitle}>{c('penSkills')}</Text>
            <ScoreRow name={c('penPraise')}  score="6/10"  label={d('labelGood')}         progress={0.6} color="#6B3FA0" />
            <ScoreRow name={c('penEcho')}    score="3/10"  label={d('labelPayAttention')} progress={0.3} color="#7B2020" />
            <ScoreRow name={c('penNarrate')} score="15/10" label={d('labelExcellent')}    progress={1}   color="#6B3FA0" />
          </PolaroidCard>

          {/* Card 2 — Sentence Tip */}
          <PolaroidCard label={c('sentenceTip')} rotate="4deg">
            <View style={s.chipRow}>
              <Chip text={c('adultLabel')} color="#374151" bg="#F3F4F6" />
              <Chip text={c('repeatBadge')} color="#0F766E" bg="#CCFBF1" />
            </View>
            <Text style={s.utterance}>{c('adultSays')}</Text>
            <View style={s.greenBox}>
              <Text style={s.greenText}>{c('sentenceTipHint')}</Text>
            </View>
            <View style={[s.chipRow, { marginTop: 6 }]}>
              <Chip text={c('childLabel')} color="#92400E" bg="#FEF3C7" />
            </View>
            <Text style={s.utterance}>{c('childSays')}</Text>
          </PolaroidCard>

          {/* Card 3 — In the Moment Coaching */}
          <PolaroidCard label={c('momentCoaching')} rotate="-5deg">
            <Text style={s.coachTitle}>{c('coachingLabel')}</Text>
            <Text style={s.coachBody}>{c('coachingSnippet')}</Text>
          </PolaroidCard>

          {/* Card 4 — Gentle Focus */}
          <PolaroidCard label={c('gentleFocus')} rotate="4deg">
            <Text style={s.focusSubtitle}>{c('gentleFocusTitle')}</Text>
            <Text style={s.focusStar}>✦</Text>
            <Text style={s.focusBody}>{c('focusSnippet')}</Text>
          </PolaroidCard>

        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <OnboardingBackButton onPress={() => navigation.goBack()} />
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('PlaySession5')} activeOpacity={0.85}>
          <Text style={styles.buttonText}>{t('onboarding.continue')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ── Card content styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  ebaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 },
  ebaTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: '#1F2937', flex: 1 },
  ebaScore: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 8, color: '#7B2020', flexShrink: 0 },
  ebaBar: { height: 5, backgroundColor: '#7B2020', borderRadius: 3, width: '85%', marginBottom: 2 },
  overallLabel: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 8, color: '#6B7280', marginBottom: 4 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E5E7EB', marginBottom: 5 },
  penTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 9, color: '#1F2937', marginBottom: 5 },

  chipRow: { flexDirection: 'row', gap: 4, marginBottom: 3, alignItems: 'center' },
  utterance: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 9, color: '#1F2937', marginBottom: 4, marginLeft: 2 },
  greenBox: { backgroundColor: '#DCFCE7', borderRadius: 6, padding: 5, marginBottom: 2 },
  greenText: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 9, color: '#14532D', lineHeight: 13 },

  coachTitle: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 10, color: '#6B3FA0', marginBottom: 5 },
  coachBody: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 9, color: '#374151', lineHeight: 14 },

  focusSubtitle: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 9, color: '#9CA3AF', marginBottom: 3 },
  focusStar: { fontSize: 14, color: '#F59E0B', marginBottom: 4 },
  focusBody: { fontFamily: 'PlusJakartaSans_400Regular', fontSize: 9, color: '#374151', lineHeight: 14 },
});

// ── Screen layout styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  titleContainer: { paddingHorizontal: 28, paddingTop: 64, alignItems: 'center' },
  title: {
    fontFamily: 'PlusJakartaSans_700Bold', fontSize: 24, color: '#1F2937',
    lineHeight: 34, textAlign: 'center', width: '100%',
  },
  subtitleContainer: { paddingHorizontal: 28, paddingTop: 8, paddingBottom: 8, alignItems: 'center' },
  subtitle: {
    fontFamily: 'PlusJakartaSans_400Regular', fontSize: 14, color: '#6B7280',
    lineHeight: 22, textAlign: 'center', width: '100%',
  },
  gridOuter: { flex: 1, justifyContent: 'center', paddingHorizontal: H_PAD },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: CARD_GAP, alignItems: 'flex-start' },
  footer: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  button: {
    flex: 1, height: 56, backgroundColor: '#8C49D5',
    borderRadius: 30, alignItems: 'center', justifyContent: 'center',
  },
  buttonText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 18, color: '#FFFFFF' },
});
