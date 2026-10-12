/**
 * LearnModuleSurveyScreen
 * Parent-input survey for a Learn module, opened from LearnModuleScreen's
 * "Tell Nora" button. One question per page in the Child Snapshot (WACB)
 * format: progress header, centered title, pill options, back/continue row.
 * Parents advance with Continue; follow-up questions appear only when their
 * `showIf` matches earlier answers. Questions come from
 * LEARN_MODULE_SURVEYS; answers are submitted to /api/learn-module-survey
 * (LearnModuleSurvey table), which also generates a report + plan from them
 * (shown on LearnModuleScreen once ready). The latest submission prefills a retake.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/assets';
import type { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { TrackedTouchable } from '../components/TrackedTouchable';
import { OnboardingButtonRow } from '../components/OnboardingButtonRow';
import { useToast } from '../components/ToastManager';
import amplitudeService from '../services/amplitudeService';
import { useAuthService } from '../contexts/AppContext';
import {
  LEARN_MODULE_SURVEYS,
  SurveyAnswers,
  SurveyQuestion,
  surveyI18nBase,
} from '../constants/learnModuleSurveys';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const otherKey = (questionKey: string) => `${questionKey}Other`;

// strategyId: the parent's active strategy (Day 2+ check-in) — questions
// tagged with strategyIds only show for those strategies.
const getVisibleQuestions = (questions: SurveyQuestion[], answers: SurveyAnswers, strategyId?: number) =>
  questions.filter(q =>
    (!q.strategyIds || (strategyId !== undefined && q.strategyIds.includes(strategyId))) &&
    (!q.showIf || q.showIf(answers)));

export const LearnModuleSurveyScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'LearnModuleSurvey'>>();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const authService = useAuthService();
  // variant 'followup' (Day 2+) checks in on the strategy being practiced.
  const { moduleKey, variant = 'initial', strategy = '', strategyId } = route.params;
  const questions = LEARN_MODULE_SURVEYS[moduleKey]?.[variant] ?? [];
  const base = surveyI18nBase(moduleKey, variant);
  const [childName, setChildName] = useState('');
  // Copy may reference the strategy and the child ({{strategy}} / {{name}}).
  const vars = { strategy, name: childName || t('learnV2.moduleScreen.yourChild') };

  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [currentKey, setCurrentKey] = useState(questions[0]?.key);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visible = useMemo(() => getVisibleQuestions(questions, answers, strategyId), [questions, answers]);
  const index = Math.max(0, visible.findIndex(q => q.key === currentKey));
  const question = visible[index];

  // Prefill the Day 1 survey with the parent's previous answers, if any. The
  // Day 2+ check-in is about one day's practice, so it always starts blank.
  useEffect(() => {
    if (variant === 'initial') {
      authService.authenticatedRequest(`${API_URL}/api/learn-module-survey/latest?moduleKey=${moduleKey}&variant=initial`)
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data?.survey?.answers) setAnswers(prev => ({ ...data.survey.answers, ...prev }));
        })
        .catch(err => console.error('Failed to load previous module survey:', err));
    }
    authService.getCurrentUser()
      .then(user => setChildName(user?.childName ?? ''))
      .catch(() => {});
    amplitudeService.trackEvent('Learn Module Survey Started', { moduleKey, variant });
  }, [moduleKey, variant]);

  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [currentKey]);

  if (!question) return null;

  const value = answers[question.key];
  const selected: string[] = Array.isArray(value) ? value : value ? [value] : [];
  const otherText = (answers[otherKey(question.key)] as string | undefined) ?? '';
  const isOtherSelected = !!question.otherOption && selected.includes(question.otherOption);
  const isText = question.type === 'text';

  const isValid = isText
    ? question.optional || otherText.trim().length > 0 || (typeof value === 'string' && value.trim().length > 0)
    : selected.length > 0 && (!isOtherSelected || otherText.trim().length > 0);

  const finish = async (finalAnswers: SurveyAnswers) => {
    // Drop answers to follow-ups that no longer apply (e.g. changed Q4 to "No").
    const visibleKeys = new Set(getVisibleQuestions(questions, finalAnswers, strategyId)
      .flatMap(q => [q.key, otherKey(q.key), ...(q.noteKey ? [q.noteKey] : [])]));
    // Also drop blank free text (e.g. a skipped optional question).
    const kept = Object.fromEntries(
      Object.entries(finalAnswers).filter(([k, v]) =>
        visibleKeys.has(k) && (Array.isArray(v) ? v.length > 0 : v.trim().length > 0)),
    );
    // The same answers as the parent saw them (their language) — the server
    // feeds these to the coaching prompt to write a report + plan.
    const readableAnswers = getVisibleQuestions(questions, finalAnswers, strategyId)
      .filter(q => q.key in kept)
      .flatMap(q => {
        const value = kept[q.key];
        const values = Array.isArray(value) ? value : [value];
        const other = kept[otherKey(q.key)] as string | undefined;
        const note = q.noteKey ? (kept[q.noteKey] as string | undefined) : undefined;
        return [
          {
            question: t(`${base}.questions.${q.key}.title`, vars),
            answers: q.type === 'text'
              ? values
              : values.map(v => {
                  const label = t(`${base}.questions.${q.key}.options.${v}`, vars);
                  return v === q.otherOption && other ? `${label}: ${other}` : label;
                }),
          },
          ...(note ? [{ question: t(`${base}.questions.${q.noteKey}.title`, vars), answers: [note] }] : []),
        ];
      });
    setIsSubmitting(true);
    try {
      const res = await authService.authenticatedRequest(`${API_URL}/api/learn-module-survey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleKey, variant, answers: kept, readableAnswers, language: i18n.language }),
      });
      if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
    } catch (err) {
      // Stay on the last question so the parent can retry without losing answers.
      console.error('Failed to submit module survey:', err);
      showToast(t('learnV2.moduleSurvey.submitError'), 'error');
      setIsSubmitting(false);
      return;
    }
    amplitudeService.trackEvent('Learn Module Survey Completed', { moduleKey, variant });
    showToast(t('learnV2.moduleSurvey.thanks'), 'success');
    navigation.goBack();
  };

  const goNext = (nextAnswers: SurveyAnswers) => {
    const nextVisible = getVisibleQuestions(questions, nextAnswers, strategyId);
    const pos = nextVisible.findIndex(q => q.key === question.key);
    const next = nextVisible[pos + 1];
    if (next) setCurrentKey(next.key);
    else finish(nextAnswers);
  };

  const goBack = () => {
    if (index === 0) navigation.goBack();
    else setCurrentKey(visible[index - 1].key);
  };

  const handleSelect = (option: string) => {
    if (question.multiSelect) {
      const nextSelected = selected.includes(option)
        ? selected.filter(v => v !== option)
        : [...selected, option];
      setAnswers(prev => ({ ...prev, [question.key]: nextSelected }));
      return;
    }
    setAnswers(prev => ({ ...prev, [question.key]: option }));
  };

  const sectionLabel = question.section ? t(`${base}.sections.${question.section}`, vars) : '';
  const isLast = index === visible.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          {/* Progress header (matches OnboardingProgressHeader's single-phase look) */}
          <View style={styles.progressHeader}>
            <View style={styles.avatarContainer}>
              <Image
                source={require('../../assets/images/dragon_image.png')}
                style={styles.avatarImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.flex}>
              <View style={styles.progressTitleRow}>
                <Text style={styles.progressTitle}>{t('learnV2.moduleSurvey.headerTitle')}</Text>
                <Text style={styles.progressCounter}>{`${index + 1}/${visible.length}`}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${((index + 1) / visible.length) * 100}%` }]} />
              </View>
              <Text style={styles.sectionLabel}>{sectionLabel}</Text>
            </View>
          </View>

          {/* Title */}
          <View style={styles.header}>
            <Text style={styles.title}>{t(`${base}.questions.${question.key}.title`, vars)}</Text>
            {question.multiSelect && (
              <Text style={styles.hint}>{t('learnV2.moduleSurvey.selectAll')}</Text>
            )}
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {isText ? (
              <TextInput
                style={styles.textArea}
                placeholder={t('learnV2.moduleSurvey.textPlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={typeof value === 'string' ? value : ''}
                onChangeText={text => setAnswers(prev => ({ ...prev, [question.key]: text }))}
                multiline
                textAlignVertical="top"
              />
            ) : (
              question.options?.map(option => {
                const isSelected = selected.includes(option);
                const label = t(`${base}.questions.${question.key}.options.${option}`, vars);
                return (
                  <TrackedTouchable analyticsId={`Module Survey Option: ${question.key}.${option}`}
                    key={option}
                    style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                    onPress={() => handleSelect(option)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.optionLabel}>{label}</Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={24} color="#007866" style={styles.checkmark} />
                    )}
                  </TrackedTouchable>
                );
              })
            )}

            {isOtherSelected && (
              <TextInput
                style={styles.otherInput}
                placeholder={t('learnV2.moduleSurvey.otherPlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={otherText}
                onChangeText={text => setAnswers(prev => ({ ...prev, [otherKey(question.key)]: text }))}
                autoFocus
                returnKeyType="done"
              />
            )}

            {/* Optional note on the same page (e.g. "Anything else?") */}
            {question.noteKey && (
              <View style={styles.noteWrap}>
                <Text style={styles.noteLabel}>{t(`${base}.questions.${question.noteKey}.title`, vars)}</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder={t('learnV2.moduleSurvey.textPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  value={(answers[question.noteKey] as string | undefined) ?? ''}
                  onChangeText={text => setAnswers(prev => ({ ...prev, [question.noteKey!]: text }))}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            )}
          </ScrollView>

          <OnboardingButtonRow
            onBack={goBack}
            onContinue={() => goNext(answers)}
            continueDisabled={!isValid || isSubmitting}
            continueText={isLast ? t('learnV2.moduleSurvey.submit') : undefined}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 30 },

  // ── Progress header ──
  progressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#A2DFCB',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  avatarImage: { width: 80, height: 80, marginLeft: 20 },
  progressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressTitle: { fontFamily: FONTS.semiBold, fontSize: 14, color: COLORS.textDark },
  progressCounter: { fontFamily: FONTS.bold, fontSize: 14, color: COLORS.mainPurple },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F6F3F7',
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.mainPurple },
  sectionLabel: { fontFamily: FONTS.regular, fontSize: 12, color: '#6B7280', textAlign: 'right' },

  // ── Question ──
  header: { marginBottom: 24 },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: '#4A5565',
    textAlign: 'center',
  },
  hint: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  scrollContent: { paddingBottom: 16 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 68,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 36,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginBottom: 12,
  },
  optionCardSelected: {
    borderColor: '#007866',
    borderWidth: 2,
    backgroundColor: '#EBF9F8',
  },
  optionLabel: { flex: 1, fontFamily: FONTS.semiBold, fontSize: 16, color: COLORS.textDark },
  checkmark: { marginLeft: 8 },
  otherInput: {
    height: 68,
    borderWidth: 2,
    borderColor: '#007866',
    borderRadius: 36,
    paddingHorizontal: 24,
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textDark,
    backgroundColor: '#EBF9F8',
    marginTop: 8,
  },
  noteWrap: { marginTop: 12 },
  noteLabel: { fontFamily: FONTS.semiBold, fontSize: 14, color: '#4A5565', marginBottom: 8 },
  noteInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    padding: 16,
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 21,
    color: COLORS.textDark,
  },
  textArea: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    padding: 18,
    fontFamily: FONTS.regular,
    fontSize: 16,
    lineHeight: 22,
    color: COLORS.textDark,
  },
});
