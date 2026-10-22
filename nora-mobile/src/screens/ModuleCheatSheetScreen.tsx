/**
 * ModuleCheatSheetScreen
 * "Quick Cheat Sheet — What to Say & Do", opened from "Cheat Sheet from Last
 * Session" on LearnModuleScreen_v2. Two parts:
 * - Core focus: the latest report's myPlan.activeStrategy, with its
 *   myPlan.focusAreas (or for plans from before that field its protocol steps).
 * - The module's fixed screen-time routine (i18n
 *   learnV2.modules.<moduleKey>.cheatSheet.routine.<n>), as an accordion.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, LayoutAnimation } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/assets';
import type { RootStackParamList } from '../navigation/types';
import { TrackedTouchable } from '../components/TrackedTouchable';
import { useModulePlan } from './LearnModulePlanView';

const ROUTINE_STEP_COUNT = 8;

// Quoted phrases (the words to say) — “…” (en, zh-CN), 「…」 (zh-TW), "…".
const QUOTE_RE = /(\u201C[^\u201D]*\u201D|\u300C[^\u300D]*\u300D|"[^"]*")/;

// Renders text with its quoted phrases in bold.
const withBoldQuotes = (text: string, boldStyle: object) =>
  text.split(QUOTE_RE).map((part, i) =>
    i % 2 === 1 ? <Text key={i} style={boldStyle}>{part}</Text> : part);
const PURPLE_TINT = '#F1EBFB';
const MUTED = '#6B7280';

export const ModuleCheatSheetScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ModuleCheatSheet'>>();
  const { t } = useTranslation();
  const { moduleKey } = route.params;
  const base = `learnV2.modules.${moduleKey}.cheatSheet`;
  const { generatedPlan } = useModulePlan(moduleKey);
  const [openStep, setOpenStep] = useState<number | null>(1);

  const coreFocus = generatedPlan?.activeStrategy;
  const focusAreas = generatedPlan?.focusAreas?.length
    ? generatedPlan.focusAreas
    : (generatedPlan?.protocolSteps ?? []).map(step => ({ title: step, detail: '' }));

  const toggleStep = (step: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenStep(prev => (prev === step ? null : step));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.navRow}>
        <TrackedTouchable analyticsId="Back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityLabel="Back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.textDark} />
        </TrackedTouchable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t(`${base}.title`)}</Text>
        <Text style={styles.subtitle}>{t(`${base}.subtitle`)}</Text>

        {/* Core focus — from the latest report */}
        {focusAreas.length > 0 && (
          <View style={styles.focusCard}>
            <View style={styles.focusHeader}>
              <Ionicons name="locate" size={34} color={COLORS.mainPurple} />
              <View style={styles.flex}>
                <Text style={styles.focusTitle}>{coreFocus || t(`${base}.focusTitle`, { count: focusAreas.length })}</Text>
                <Text style={styles.focusSubtitle}>{t(`${base}.focusSubtitle`)}</Text>
              </View>
            </View>
            <View style={styles.focusDivider} />
            {focusAreas.map((area, i) => (
              <View key={i} style={styles.focusItem}>
                <View style={styles.focusNumber}>
                  <Text style={styles.focusNumberText}>{i + 1}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.focusItemTitle}>{area.title}</Text>
                  {!!area.detail && <Text style={styles.focusItemDetail}>{area.detail}</Text>}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Fixed screen-time routine */}
        <Text style={styles.routineHeading}>{t(`${base}.routineHeading`)}</Text>
        {Array.from({ length: ROUTINE_STEP_COUNT }, (_, i) => i + 1).map(step => {
          const open = openStep === step;
          return (
            <View key={step} style={styles.routineItem}>
              <TrackedTouchable analyticsId={`Module Cheat Sheet step: ${step}`}
                style={styles.routineRow}
                onPress={() => toggleStep(step)}
                activeOpacity={0.7}
              >
                <View style={styles.routineNumber}>
                  <Text style={styles.routineNumberText}>{step}</Text>
                </View>
                <Text style={styles.routineTitle}>{t(`${base}.routine.${step}.moment`)}</Text>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={MUTED} />
              </TrackedTouchable>
              {open && (
                <View style={styles.routineBody}>
                  <Text style={styles.routineBodyText}>
                    {withBoldQuotes(t(`${base}.routine.${step}.action`), styles.routineQuote)}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  navRow: { paddingHorizontal: 16, paddingVertical: 8 },
  backButton: { width: 36, height: 36, justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  title: { fontFamily: FONTS.bold, fontSize: 28, lineHeight: 34, color: COLORS.textDark, marginLeft: 36 },
  subtitle: { fontFamily: FONTS.regular, fontSize: 17, color: MUTED, marginTop: 4, marginLeft: 36 },

  // ── Focus areas ──
  focusCard: {
    backgroundColor: '#F4EFFC',
    borderWidth: 1,
    borderColor: '#D9CBF5',
    borderRadius: 18,
    padding: 18,
    marginTop: 18,
  },
  focusHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  focusTitle: { fontFamily: FONTS.bold, fontSize: 20, color: COLORS.mainPurple },
  focusSubtitle: { fontFamily: FONTS.regular, fontSize: 14, color: MUTED, marginTop: 2 },
  focusDivider: { height: 1, backgroundColor: '#D9CBF5', marginVertical: 14 },
  focusItem: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  focusNumber: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E4D8F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  focusNumberText: { fontFamily: FONTS.bold, fontSize: 16, color: COLORS.mainPurple },
  focusItemTitle: { fontFamily: FONTS.bold, fontSize: 16, lineHeight: 22, color: COLORS.textDark },
  focusItemDetail: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: '#4B5563', marginTop: 2 },

  // ── Routine accordion ──
  routineHeading: { fontFamily: FONTS.regular, fontSize: 14, color: MUTED, marginTop: 22, marginBottom: 4 },
  routineItem: { borderBottomWidth: 1, borderBottomColor: '#EEEAF5' },
  routineRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  routineNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PURPLE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineNumberText: { fontFamily: FONTS.semiBold, fontSize: 15, color: MUTED },
  routineTitle: { flex: 1, fontFamily: FONTS.regular, fontSize: 17, color: COLORS.textDark },
  routineBody: {
    backgroundColor: '#F6F3FB',
    borderRadius: 12,
    padding: 12,
    marginLeft: 48,
    marginBottom: 14,
  },
  routineBodyText: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: '#4B5563' },
  routineQuote: { fontFamily: FONTS.bold, color: COLORS.textDark },
});
