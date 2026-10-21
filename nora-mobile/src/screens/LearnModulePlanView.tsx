/**
 * LearnModulePlanView
 * Plan detail (ModulePlanDetailScreen): the parent's custom plan for a Learn
 * module — active strategy, why it works, today's step-by-step protocol and
 * a crisis tool. Layout is shared across modules; icons/colors come from
 * LEARN_MODULES[moduleKey].plan. Copy is the parent's generated plan
 * (myPlan from their latest analyzed module recording, via
 * /api/learn-modules/:moduleKey/plan); until one exists it falls back to the
 * template copy in i18n `learnV2.modules.<moduleKey>.plan` ({{name}} = child's name).
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { COLORS, FONTS } from '../constants/assets';
import { useAuthService } from '../contexts/AppContext';
import { KeyStrategyId, LEARN_MODULES, LearnModuleConfig, LearnModuleKey, MasteredStrategy, ModulePlanData, SuggestedStrategy } from '../constants/learnModules';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

// Last fetched plan per module. The view remounts on every switch to the
// "My plan" tab; seeding from here shows the known plan immediately (and
// refreshes in the background) instead of a spinner each time. null = the
// server said there's no generated plan yet.
const planCache = new Map<LearnModuleKey, ModulePlanData | null>();
const masteredCache = new Map<LearnModuleKey, MasteredStrategy[]>();
const suggestedCache = new Map<LearnModuleKey, SuggestedStrategy[]>();
const recommendedCache = new Map<LearnModuleKey, KeyStrategyId[]>();

export interface PlanDisplay {
  strategy: string;
  why: string;
  steps: string[];
  crisis: { title: string; items: { lead: string; text: string }[] } | null;
}

const H_PAD = 20;
const PLAN_PURPLE = '#5B2EA6';
const WHY_BG = '#F8EBCB';
const WHY_TITLE = '#7A4A12';
const CRISIS_BG = '#FDE8E6';
const CRISIS_BORDER = '#EF8A80';
const CRISIS_ACCENT = '#E0584B';
const MASTERED_GREEN = '#2F9E5B';

// Splits template copy "**Bold lead:** rest" into its lead and text.
const splitLead = (raw: string) => {
  const match = raw.match(/^\*\*(.+?)\*\*\s*(.*)$/s);
  return match ? { lead: match[1], text: match[2] } : { lead: '', text: raw };
};

/**
 * The parent's generated plan for a module (myPlan of their latest analyzed
 * report), plus the child's name for template copy. generatedPlan is
 * undefined until the first response, null when there's no plan yet.
 * Shared by the module screen, plan views, cheat sheet and module chat.
 * Refetches when refreshKey changes (e.g. the day advanced after a new report).
 */
export const useModulePlan = (moduleKey: LearnModuleKey, refreshKey?: unknown) => {
  const authService = useAuthService();
  const [childName, setChildName] = useState('');
  // undefined until the first response — the template fallback is only for a
  // confirmed "no plan yet", never a placeholder while loading.
  const [generatedPlan, setGeneratedPlan] = useState<ModulePlanData | null | undefined>(
    planCache.has(moduleKey) ? planCache.get(moduleKey) : undefined,
  );
  // Strategies mastered so far (first mastery each), oldest first.
  const [masteredStrategies, setMasteredStrategies] = useState<MasteredStrategy[]>(
    masteredCache.get(moduleKey) ?? [],
  );
  // The latest report's "Next Growth Focus" strategies (module chat ideas).
  const [suggestedStrategies, setSuggestedStrategies] = useState<SuggestedStrategy[]>(
    suggestedCache.get(moduleKey) ?? [],
  );
  // Key strategies of the newest report that lists any (Cheat Sheet focus areas).
  const [recommendedStrategies, setRecommendedStrategies] = useState<KeyStrategyId[]>(
    recommendedCache.get(moduleKey) ?? [],
  );

  useEffect(() => {
    authService.getCurrentUser()
      .then(user => setChildName(user?.childName ?? ''))
      .catch(() => {});
    authService.authenticatedRequest(`${API_URL}/api/learn-modules/${moduleKey}/plan`)
      .then(res => {
        if (!res.ok) throw new Error(`Plan request failed: ${res.status}`);
        return res.json();
      })
      .then(data => {
        const fetched: ModulePlanData | null = data?.plan ?? null;
        planCache.set(moduleKey, fetched);
        setGeneratedPlan(fetched);
        const mastered: MasteredStrategy[] = data?.masteredStrategies ?? [];
        masteredCache.set(moduleKey, mastered);
        setMasteredStrategies(mastered);
        const suggested: SuggestedStrategy[] = data?.suggestedStrategies ?? [];
        suggestedCache.set(moduleKey, suggested);
        setSuggestedStrategies(suggested);
        const recommended: KeyStrategyId[] = data?.recommendedStrategies ?? [];
        recommendedCache.set(moduleKey, recommended);
        setRecommendedStrategies(recommended);
      })
      .catch(err => {
        console.error('Failed to load module plan:', err);
        // Keep a previously shown plan; otherwise fall back to the template.
        setGeneratedPlan(prev => (prev === undefined ? null : prev));
      });
  }, [authService, moduleKey, refreshKey]);

  return { generatedPlan, childName, masteredStrategies, suggestedStrategies, recommendedStrategies };
};

// What the plan screens render: the generated plan, or the module's template
// copy when the parent has no plan yet.
export const buildPlanDisplay = (
  t: TFunction,
  moduleKey: LearnModuleKey,
  generatedPlan: ModulePlanData | null,
  childName: string,
): PlanDisplay | null => {
  const plan = (LEARN_MODULES[moduleKey] as LearnModuleConfig).plan;
  if (!plan) return null;
  const base = `learnV2.modules.${moduleKey}.plan`;
  const name = childName || t('learnV2.moduleScreen.yourChild');
  return generatedPlan
    ? {
        strategy: generatedPlan.activeStrategy,
        why: generatedPlan.whyItWorks,
        steps: generatedPlan.protocolSteps,
        crisis: generatedPlan.crisisTool?.isNeeded
          ? {
              title: generatedPlan.crisisTool.title,
              items: [
                { lead: t('learnV2.moduleScreen.plan.crisisAction'), text: generatedPlan.crisisTool.action },
                { lead: t('learnV2.moduleScreen.plan.crisisScript'), text: `\u201C${generatedPlan.crisisTool.script}\u201D` },
              ].filter(item => item.text),
            }
          : null,
      }
    : {
        strategy: t(`${base}.strategy`),
        why: t(`${base}.why`, { name }),
        steps: plan.steps.map((_, i) => t(`${base}.steps.${i + 1}`, { name })),
        crisis: {
          title: t(`${base}.crisis.title`),
          items: Array.from({ length: plan.crisisItemCount }, (_, i) =>
            splitLead(t(`${base}.crisis.items.${i + 1}`, { name }))),
        },
      };
};

// "Today's Protocol": numbered steps on a colored connector, icons/colors
// from LEARN_MODULES[moduleKey].plan.steps (cycled if there are more steps).
export const ProtocolSteps: React.FC<{ moduleKey: LearnModuleKey; steps: string[] }> = ({ moduleKey, steps }) => {
  const plan = (LEARN_MODULES[moduleKey] as LearnModuleConfig).plan;
  if (!plan) return null;
  const stepStyle = (i: number) => plan.steps[i % plan.steps.length];
  return (
    <View style={styles.protocol}>
      {/* Connector behind the numbered dots, one colored segment per gap */}
      <View style={styles.connectorRow} pointerEvents="none">
        {steps.slice(0, -1).map((_, i) => (
          <View key={i} style={styles.connectorSegment}>
            <View style={[styles.connectorHalf, { backgroundColor: stepStyle(i).color }]} />
            <View style={[styles.connectorHalf, { backgroundColor: stepStyle(i + 1).color }]} />
          </View>
        ))}
      </View>
      {steps.map((text, i) => (
        <View key={i} style={styles.step}>
          <View style={styles.stepIconWrap}>
            <Ionicons name={stepStyle(i).icon} size={40} color={stepStyle(i).color} />
          </View>
          <View style={[styles.stepDot, { backgroundColor: stepStyle(i).color }]}>
            <Text style={styles.stepNumber}>{i + 1}</Text>
          </View>
          <Text style={styles.stepText}>{text}</Text>
        </View>
      ))}
    </View>
  );
};

export const LearnModulePlanView: React.FC<{ moduleKey: LearnModuleKey }> = ({ moduleKey }) => {
  const { t } = useTranslation();
  const plan = (LEARN_MODULES[moduleKey] as LearnModuleConfig).plan;
  const { generatedPlan, childName, masteredStrategies } = useModulePlan(moduleKey);

  if (!plan) return null;
  if (generatedPlan === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.mainPurple} />
      </View>
    );
  }
  const display = buildPlanDisplay(t, moduleKey, generatedPlan, childName)!;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Plan card */}
      <View style={styles.planCardWrap}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('learnV2.moduleScreen.plan.title')}</Text>

          <View style={styles.strategy}>
            <View style={styles.strategyIcon}>
              <Ionicons name={plan.strategyIcon} size={22} color={PLAN_PURPLE} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.strategyLabel}>{t('learnV2.moduleScreen.plan.activeStrategy')}</Text>
              <Text style={styles.strategyName}>{display.strategy}</Text>
            </View>
          </View>

          <View style={styles.whyPointer} />
          <View style={styles.why}>
            <Text style={styles.whyTitle}>{t('learnV2.moduleScreen.plan.whyItWorks')}</Text>
            <Text style={styles.whyBody}>{display.why}</Text>
          </View>

          <Text style={styles.sectionTitle}>{t('learnV2.moduleScreen.plan.todaysProtocol')}</Text>
          <ProtocolSteps moduleKey={moduleKey} steps={display.steps} />
        </View>
      </View>

      {/* Crisis tool — omitted when the generated plan says it isn't needed */}
      {display.crisis && (
        <View style={styles.crisisCard}>
          <View style={styles.crisisHeader}>
            <Ionicons name="warning-outline" size={24} color={CRISIS_ACCENT} />
            <Text style={styles.crisisTitle}>{t('learnV2.moduleScreen.plan.crisisTitle', { title: display.crisis.title })}</Text>
          </View>
          {display.crisis.items.map((item, i) => (
            <View key={i} style={styles.crisisItem}>
              <Text style={styles.crisisBullet}>{'•'}</Text>
              <Text style={styles.crisisText}>
                {!!item.lead && <Text style={styles.crisisLead}>{item.lead} </Text>}
                {item.text}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Strategies mastered so far — hidden until the first one */}
      {masteredStrategies.length > 0 && (
        <View style={styles.masteredCard}>
          <Text style={styles.masteredTitle}>{t('learnV2.moduleScreen.plan.masteredTitle')}</Text>
          <View style={styles.masteredChips}>
            {masteredStrategies.map(item => (
              <View key={item.reportId} style={styles.masteredChip}>
                <Ionicons name="checkmark-circle" size={16} color={MASTERED_GREEN} />
                <Text style={styles.masteredChipText}>{item.strategy}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: H_PAD, paddingBottom: 24 },


  // ── Plan card ──
  planCardWrap: { marginTop: 4 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    shadowColor: '#5B3A9E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: COLORS.textDark,
  },
  strategy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: PLAN_PURPLE,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 14,
  },
  strategyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FBEFE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  strategyLabel: { fontFamily: FONTS.regular, fontSize: 14, color: '#E9E0FA' },
  strategyName: { fontFamily: FONTS.bold, fontSize: 18, lineHeight: 23, color: '#FFFFFF' },
  whyPointer: {
    alignSelf: 'flex-end',
    marginRight: 40,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: WHY_BG,
    marginTop: 6,
  },
  why: { backgroundColor: WHY_BG, borderRadius: 18, padding: 16 },
  whyTitle: { fontFamily: FONTS.bold, fontSize: 16, color: WHY_TITLE },
  whyBody: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 22, color: COLORS.textDark, marginTop: 4 },

  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.textDark,
    marginTop: 24,
    marginBottom: 14,
  },

  // ── Protocol ──
  protocol: { flexDirection: 'row' },
  // Spans dot centre of the first step to dot centre of the last.
  connectorRow: {
    position: 'absolute',
    top: 56 + 16 - 2,
    left: '16.67%',
    right: '16.67%',
    flexDirection: 'row',
  },
  connectorSegment: { flex: 1, flexDirection: 'row', height: 4 },
  connectorHalf: { flex: 1, opacity: 0.85 },
  step: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  stepIconWrap: { height: 56, justifyContent: 'center' },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
  stepText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textDark,
    textAlign: 'center',
    marginTop: 10,
  },

  // ── Mastered strategies ──
  masteredCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginTop: 16,
    shadowColor: '#5B3A9E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  masteredTitle: { fontFamily: FONTS.bold, fontSize: 17, color: COLORS.textDark },
  masteredChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  masteredChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E7F6EC',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: '100%',
  },
  masteredChipText: { flexShrink: 1, fontFamily: FONTS.semiBold, fontSize: 13, color: '#1F6B3E' },

  // ── Crisis tool ──
  crisisCard: {
    backgroundColor: CRISIS_BG,
    borderWidth: 1.5,
    borderColor: CRISIS_BORDER,
    borderRadius: 24,
    padding: 18,
    marginTop: 16,
  },
  crisisHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  crisisTitle: { flex: 1, fontFamily: FONTS.bold, fontSize: 17, lineHeight: 22, color: COLORS.textDark },
  crisisItem: { flexDirection: 'row', marginTop: 8 },
  crisisBullet: { fontFamily: FONTS.bold, fontSize: 15, color: COLORS.textDark, width: 16 },
  crisisText: { flex: 1, fontFamily: FONTS.regular, fontSize: 15, lineHeight: 22, color: COLORS.textDark },
  crisisLead: { fontFamily: FONTS.bold },
});
