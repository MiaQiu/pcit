/**
 * ModuleRoutineScreen
 * "Making screentime endings predictable", opened from that goal on the
 * "My plan" roadmap: why a routine stops screen-time tantrums (three
 * reasons), then the predictable 8-step transition flow. Each step shows its
 * moment and a one-line summary, and expands to the exact script — the
 * cheat sheet's routine (learnV2.modules.<moduleKey>.cheatSheet.routine.<n>.action).
 * Copy: learnV2.modules.<moduleKey>.routinePage.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, LayoutAnimation } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS } from '../constants/assets';
import type { RootStackParamList } from '../navigation/types';
import { TrackedTouchable } from '../components/TrackedTouchable';
import { useModulePlan } from './LearnModulePlanView';

const TITLE = '#0D221E';
const BODY = '#5B706B';
const HEADER_ART = require('../../assets/images/modules/dino_screen.png');
const HEADER_ART_WIDTH = 150;
const STEP_COUNT = 8;

// Quoted phrases (the words to say) — “…” (en, zh-CN), 「…」 (zh-TW), "…".
const QUOTE_RE = /(“[^”]*”|「[^」]*」|"[^"]*")/;

// Renders text with its quoted phrases in bold.
const withBoldQuotes = (text: string, boldStyle: object) =>
  text.split(QUOTE_RE).map((part, i) =>
    i % 2 === 1 ? <Text key={i} style={boldStyle}>{part}</Text> : part);

const REASONS = [
  { key: 'surprises', icon: 'flash', color: '#E5484D', tint: '#FDE7E7' },
  { key: 'badGuy', icon: 'shield-checkmark', color: '#3B82F6', tint: '#E0ECFD' },
  { key: 'overload', icon: 'bulb', color: '#E5A00D', tint: '#FDF1D6' },
] as const;

export const ModuleRoutineScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ModuleRoutine'>>();
  const { t } = useTranslation();
  const { moduleKey } = route.params;
  const base = `learnV2.modules.${moduleKey}.routinePage`;
  const scriptBase = `learnV2.modules.${moduleKey}.cheatSheet.routine`;
  const { childName } = useModulePlan(moduleKey);
  const name = childName || t('learnV2.moduleScreen.yourChild');
  const [openStep, setOpenStep] = useState<number | null>(null);

  const toggleStep = (step: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenStep(prev => (prev === step ? null : step));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.navRow}>
        <TrackedTouchable analyticsId="Back"
          onPress={() => navigation.goBack()}
          style={styles.backCircle}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={20} color={TITLE} />
        </TrackedTouchable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t(`${base}.title`)}</Text>
        <View style={styles.headerRow}>
          <Text style={styles.subtitle}>{t(`${base}.subtitle`, { name })}</Text>
          <Image source={HEADER_ART} style={styles.headerArt} resizeMode="contain" />
        </View>

        {/* Why a routine works */}
        <View style={[styles.card, styles.whyCard]}>
          <Text style={styles.cardTitle}>{t(`${base}.why.title`)}</Text>
          <View style={styles.reasons}>
            {REASONS.map((reason, i) => (
              <View key={reason.key} style={[styles.reason, i > 0 && styles.reasonDivider]}>
                <View style={[styles.reasonIcon, { backgroundColor: reason.tint }]}>
                  <Ionicons name={reason.icon} size={20} color={reason.color} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.reasonTitle}>{t(`${base}.why.${reason.key}.title`)}</Text>
                  <Text style={styles.reasonBody}>{t(`${base}.why.${reason.key}.body`, { name })}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* The 8-step flow */}
        <View style={[styles.card, styles.flowCard]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: '#CFE2FB' }]}>
              <Ionicons name="list" size={24} color="#1E3A8A" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{t(`${base}.flow.title`)}</Text>
              <Text style={styles.flowHint}>{t(`${base}.flow.hint`)}</Text>
            </View>
          </View>
          {Array.from({ length: STEP_COUNT }, (_, i) => i + 1).map(step => {
            const open = openStep === step;
            return (
              <TrackedTouchable key={step} analyticsId={`Module Routine step: ${step}`}
                style={styles.step}
                onPress={() => toggleStep(step)}
                activeOpacity={0.8}
              >
                <View style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{step}</Text>
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.stepMoment}>{t(`${base}.flow.steps.${step}.moment`, { name })}</Text>
                    <Text style={styles.stepSummary}>{t(`${base}.flow.steps.${step}.summary`)}</Text>
                  </View>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={BODY} />
                </View>
                {open && (
                  <Text style={styles.stepScript}>
                    {withBoldQuotes(t(`${scriptBase}.${step}.action`), styles.stepQuote)}
                  </Text>
                )}
              </TrackedTouchable>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7FBF9' },
  flex: { flex: 1 },
  navRow: { paddingHorizontal: 16, paddingVertical: 8 },
  backCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E6F2EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  // ── Header ──
  title: { fontFamily: FONTS.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.5, color: TITLE, marginTop: 4 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  subtitle: { flex: 1, fontFamily: FONTS.regular, fontSize: 17, lineHeight: 24, color: BODY, marginTop: 10, marginBottom: 8 },
  headerArt: { width: HEADER_ART_WIDTH, height: HEADER_ART_WIDTH * (448 / 600), marginRight: -8 },

  // ── Cards ──
  card: { borderRadius: 20, padding: 18, marginTop: 14 },
  whyCard: { backgroundColor: '#F0F8F4' },
  flowCard: { backgroundColor: '#EFF6FF' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flexShrink: 1, fontFamily: FONTS.bold, fontSize: 20, lineHeight: 26, color: TITLE },

  // ── Why a routine works ──
  reasons: { marginTop: 6 },
  reason: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14 },
  reasonDivider: { borderTopWidth: 1, borderTopColor: '#D5E8DD' },
  reasonIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  reasonTitle: { fontFamily: FONTS.bold, fontSize: 17, lineHeight: 23, color: TITLE },
  reasonBody: { fontFamily: FONTS.regular, fontSize: 16, lineHeight: 23, color: BODY, marginTop: 4 },

  // ── 8-step flow ──
  flowHint: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 21, color: BODY, marginTop: 4 },
  step: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginTop: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepNumber: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DCE8FA', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontFamily: FONTS.bold, fontSize: 16, color: '#1E3A8A' },
  stepMoment: { fontFamily: FONTS.bold, fontSize: 17, lineHeight: 23, color: TITLE },
  stepSummary: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 21, color: BODY, marginTop: 2 },
  stepScript: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
    backgroundColor: '#F4F8FE',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  stepQuote: { fontFamily: FONTS.bold, color: TITLE },
});
