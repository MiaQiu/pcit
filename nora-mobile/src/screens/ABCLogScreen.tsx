import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { useAuthService } from '../contexts/AppContext';
import {
  ANTECEDENT_TAGS,
  BEHAVIOR_TAGS,
  SITUATION_TAGS,
  PLACE_TAGS,
  PERSON_TAGS,
  CONSEQUENCE_TAGS,
  POSITIVE_BEHAVIOR_TAGS,
} from '../data/abcTags';
import { getTodaySingapore } from '../utils/timezone';
import * as userStorage from '../lib/userStorage';
import amplitudeService from '../services/amplitudeService';
import { RootStackParamList } from '../navigation/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const CUSTOM_TAGS_KEY = (cat: string) => `abc_custom_tags_${cat}`;
const FREQ_KEY = (cat: string) => `abc_tag_freq_${cat}`;
const SAFETY_CHECK_KEY = 'abc_safety_check_seen';
const INTRO_SEEN_KEY = 'abc_intro_seen';

const SAFETY_BEHAVIORS = new Set(['Hurting themselves', 'Hitting, kicking, or biting']);
const DURATION_OPTIONS = ['Under 5 min', '5–15 min', '15–30 min', 'Over 30 min'];
const INTENSITY_EMOJI = ['😐', '😟', '😣', '😤', '🤯'];

// ─── Time slots (replaces DateTimePicker spinner) ─────────────────────────────

interface TimeSlot { label: string; range: string; hour: number }

const TIME_SLOTS: TimeSlot[] = [
  { label: 'Early morning', range: '5–7am', hour: 6 },
  { label: 'Before school',  range: '7–9am',  hour: 8 },
  { label: 'Mid-morning',    range: '9–11am', hour: 10 },
  { label: 'Around lunch',   range: '11am–1pm', hour: 12 },
  { label: 'After lunch',    range: '1–3pm',  hour: 14 },
  { label: 'After school',   range: '3–5pm',  hour: 16 },
  { label: 'Early evening',  range: '5–7pm',  hour: 18 },
  { label: 'Bedtime',        range: '7–9pm',  hour: 20 },
  { label: 'Late night',     range: '9pm+',   hour: 21 },
];

// ─── Step definitions ─────────────────────────────────────────────────────────
// Challenging: 6 steps
//   0  What did your child do?      (behavior, required)
//   1  What triggered it?           (antecedent, required)
//   2  What happened right after?   (consequence — "Save Log" OR "Add more context")
//   3  How was it?                  (severity: intensity + duration)
//   4  What else was going on?      (combined: situations + places + persons)
//   5  When did it happen?          (time chips)
// Positive: 3 steps
//   0  What did they do well?       (positive behaviors, required)
//   1  What was happening?          (situations, optional)
//   2  When did it happen?          (time chips)

const C_STEPS = 6;
const P_STEPS = 3;

const C_TITLES = [
  'What did your\nchild do?',
  'What triggered\nit?',
  'What happened\nright after?',
  'How was it?',
  'What else was\ngoing on?',
  'When did it\nhappen?',
];
const C_SUBTITLES = [
  'Select all that happened',
  'My child:',
  'My child: (optional)',
  'Optional — helps Nora spot severity patterns',
  'Optional — select across any category',
  'Optional — pick the closest time slot',
];
const P_TITLES = [
  'What did your\nchild do well?',
  'What was\ngoing on?',
  'When did it\nhappen?',
];
const P_SUBTITLES = [
  'Select all that apply.',
  'Optional context.',
  'Optional — pick the closest time slot',
];

// ─── Cross-step consequence inference ────────────────────────────────────────
// Re-orders consequence tags based on what behaviors + antecedents were selected,
// so the most relevant options appear at the top.

function inferConsequenceTags(behaviors: string[], antecedents: string[]): string[] {
  const priority: string[] = [];

  // Attention-seeking behaviors → attention consequences first
  if (behaviors.some(b => ['Yelling or screaming', 'Hitting, kicking, or biting', 'Crying or sobbing'].includes(b))) {
    priority.push('My child got more attention (even if I was upset)');
  }
  // "Told no" trigger → desire-related consequences
  if (antecedents.some(a => a.includes('told no'))) {
    priority.push("My child got what they wanted after being told no");
    priority.push("My child didn't get what they wanted");
  }
  // "Asked to do something" trigger → compliance consequences
  if (antecedents.some(a => a.includes('asked to do something'))) {
    priority.push("My child didn't have to do what they were asked");
    priority.push("My child had to follow through with what they were asked");
  }
  // Escape/avoidance behavior → situation-exit consequences
  if (behaviors.some(b => ['Running away or hiding', 'Refusing to move / shutting down'].includes(b))) {
    priority.push('We stopped the activity or left the situation');
  }

  const inferred = priority.filter(t => CONSEQUENCE_TAGS.includes(t));
  const rest = CONSEQUENCE_TAGS.filter(t => !inferred.includes(t));
  return [...inferred, ...rest];
}

// ─── Success messages ─────────────────────────────────────────────────────────

const POSITIVE_SUCCESS = [
  "Noticing wins is the foundation of PCIT. Keep catching them.",
  "This is exactly what builds your child's confidence over time.",
  "Every win you log teaches Nora what works — not just what doesn't.",
  "Great catch. Positive moments are data too.",
];
const CHALLENGING_SUCCESS = [
  "Every log brings Nora one step closer to spotting what's really happening.",
  "Understanding the 'why' is the first step toward change.",
  "Consistency is what makes patterns visible. You're building something useful.",
  "Each log you save gives Nora more to work with. Keep going.",
];

// ─── Types ────────────────────────────────────────────────────────────────────

type LogMode = 'challenging' | 'positive';
type ChallengingCategory = 'antecedents' | 'behaviors' | 'situations' | 'places' | 'persons' | 'consequences';
type PositiveCategory = 'positiveBehaviors' | 'positiveSituations';

// ─── Component ───────────────────────────────────────────────────────────────

export const ABCLogScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ABCLog'>>();
  const authService = useAuthService();

  const logMode: LogMode = route.params?.mode === 'positive' ? 'positive' : 'challenging';
  const isPositive = logMode === 'positive';
  const TOTAL_STEPS = isPositive ? P_STEPS : C_STEPS;

  const [showIntro, setShowIntro] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);

  // Challenging selections
  const [selected, setSelected] = useState<Record<ChallengingCategory, string[]>>({
    antecedents: [], behaviors: [], situations: [], places: [], persons: [], consequences: [],
  });
  const [customTags, setCustomTags] = useState<Record<ChallengingCategory, string[]>>({
    antecedents: [], behaviors: [], situations: [], places: [], persons: [], consequences: [],
  });
  const [tagFrequencies, setTagFrequencies] = useState<Record<string, Record<string, number>>>({});
  const [intensity, setIntensity] = useState<number | null>(null);
  const [durationBucket, setDurationBucket] = useState<string | null>(null);

  // Positive selections
  const [posSelected, setPosSelected] = useState<Record<PositiveCategory, string[]>>({
    positiveBehaviors: [], positiveSituations: [],
  });

  // Time
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<number | null>(null); // hour value

  // UI state
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customModalCategory, setCustomModalCategory] = useState<ChallengingCategory>('antecedents');
  const [customTagInput, setCustomTagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Toast success state (replaces blocking modal)
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const accentColor = isPositive ? '#10B981' : COLORS.mainPurple;
  const selectedBg = isPositive ? '#ECFDF5' : '#F3EEFF';
  const isQuickSave = !isPositive && step === 2;
  const isLastStep = step === TOTAL_STEPS - 1;

  // ── Init ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    amplitudeService.trackScreenView('ABC Log');

    const init = async () => {
      const [seen, ...freqResults] = await Promise.all([
        userStorage.getItem(INTRO_SEEN_KEY),
        ...(['antecedents', 'behaviors', 'situations', 'places', 'persons', 'consequences'] as ChallengingCategory[])
          .map(cat => userStorage.getItem(FREQ_KEY(cat))),
      ]);

      setShowIntro(!seen);

      const cats: ChallengingCategory[] = ['antecedents', 'behaviors', 'situations', 'places', 'persons', 'consequences'];
      const freqs: Record<string, Record<string, number>> = {};
      cats.forEach((cat, i) => {
        try { freqs[cat] = JSON.parse(freqResults[i] ?? '{}'); }
        catch { freqs[cat] = {}; }
      });
      setTagFrequencies(freqs);

      // Load saved custom tags
      const customResults = await Promise.all(
        cats.map(cat => userStorage.getItem(CUSTOM_TAGS_KEY(cat)))
      );
      const customData: Record<ChallengingCategory, string[]> = {} as any;
      cats.forEach((cat, i) => {
        try { customData[cat] = JSON.parse(customResults[i] ?? '[]'); }
        catch { customData[cat] = []; }
      });
      setCustomTags(customData);
    };

    init();

    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // ── Frequency-sorted tag helper ───────────────────────────────────────────

  const sortedTags = (cat: ChallengingCategory, baseTags: string[]): string[] => {
    const freq = tagFrequencies[cat];
    if (!freq || Object.keys(freq).length === 0) return baseTags;
    return [...baseTags].sort((a, b) => (freq[b] ?? 0) - (freq[a] ?? 0));
  };

  const saveFrequencies = async () => {
    const cats: ChallengingCategory[] = ['antecedents', 'behaviors', 'situations', 'places', 'persons', 'consequences'];
    await Promise.all(cats.map(async cat => {
      const tags = selected[cat];
      if (!tags.length) return;
      const freq: Record<string, number> = { ...(tagFrequencies[cat] ?? {}) };
      for (const tag of tags) freq[tag] = (freq[tag] ?? 0) + 1;
      await userStorage.setItem(FREQ_KEY(cat), JSON.stringify(freq));
    }));
  };

  // ── Tag toggle helpers ─────────────────────────────────────────────────────

  const toggleTag = (cat: ChallengingCategory, tag: string) =>
    setSelected(prev => ({
      ...prev,
      [cat]: prev[cat].includes(tag) ? prev[cat].filter(t => t !== tag) : [...prev[cat], tag],
    }));

  const togglePosTag = (cat: PositiveCategory, tag: string) =>
    setPosSelected(prev => ({
      ...prev,
      [cat]: prev[cat].includes(tag) ? prev[cat].filter(t => t !== tag) : [...prev[cat], tag],
    }));

  const handleAddCustomTag = async () => {
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    const cat = customModalCategory;
    const updated = [...customTags[cat], trimmed].slice(0, 3);
    setCustomTags(prev => ({ ...prev, [cat]: updated }));
    await userStorage.setItem(CUSTOM_TAGS_KEY(cat), JSON.stringify(updated));
    amplitudeService.trackEvent('abc_custom_tag_added', { category: cat });
    setCustomTagInput('');
    setShowCustomModal(false);
  };

  const handleDeleteCustomTag = (cat: ChallengingCategory, tag: string) =>
    Alert.alert('Remove tag', `Remove "${tag}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const updated = customTags[cat].filter(t => t !== tag);
          setCustomTags(prev => ({ ...prev, [cat]: updated }));
          await userStorage.setItem(CUSTOM_TAGS_KEY(cat), JSON.stringify(updated));
        },
      },
    ]);

  // ── Navigation ───────────────────────────────────────────────────────────────

  const canAdvance = (): boolean => {
    if (step === 0) return isPositive ? posSelected.positiveBehaviors.length > 0 : selected.behaviors.length > 0;
    if (!isPositive && step === 1) return selected.antecedents.length > 0;
    return true;
  };

  const goNext = () => {
    amplitudeService.trackEvent('ABC Log Next Pressed', { step });
    if (step < TOTAL_STEPS - 1) setStep(s => s + 1);
  };

  const goBack = () => {
    amplitudeService.trackEvent('ABC Log Back Pressed', { step });
    if (step > 0) setStep(s => s - 1);
    else navigation.goBack();
  };

  // ── Submission ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (submitting) return;
    if (!isPositive) {
      const hasSafety = selected.behaviors.some(b => SAFETY_BEHAVIORS.has(b));
      if (hasSafety && !(await userStorage.getItem(SAFETY_CHECK_KEY))) {
        setShowSafetyModal(true);
        return;
      }
    }
    await doSubmit();
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const recordedAt = selectedTimeSlot != null
        ? (() => { const d = new Date(); d.setHours(selectedTimeSlot, 0, 0, 0); return d.toISOString(); })()
        : undefined;

      if (isPositive) {
        await authService.authenticatedRequest(`${API_URL}/api/abc-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            logType: 'POSITIVE',
            antecedents: posSelected.positiveBehaviors,
            situations: posSelected.positiveSituations,
            recordedAt,
          }),
        });
        await userStorage.setItem('abc_positive_logged_today', getTodaySingapore());
        amplitudeService.trackEvent('abc_log_completed', { log_type: 'positive', num_behaviors: posSelected.positiveBehaviors.length });
        showToast(POSITIVE_SUCCESS[Math.floor(Math.random() * POSITIVE_SUCCESS.length)]);
      } else {
        await saveFrequencies();
        await authService.authenticatedRequest(`${API_URL}/api/abc-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            logType: 'CHALLENGING',
            antecedents: selected.antecedents,
            behaviors: selected.behaviors,
            situations: selected.situations,
            places: selected.places,
            persons: selected.persons,
            consequences: selected.consequences,
            intensity: intensity ?? undefined,
            durationBucket: durationBucket ?? undefined,
            recordedAt,
          }),
        });
        await userStorage.setItem('abc_logged_today', getTodaySingapore());
        amplitudeService.trackEvent('abc_log_completed', {
          log_type: 'challenging',
          steps_completed: step + 1,
          used_extended: step >= 3,
          source: route.params?.source ?? 'quick',
        });
        showToast(CHALLENGING_SUCCESS[Math.floor(Math.random() * CHALLENGING_SUCCESS.length)]);
      }
    } catch (err) {
      console.error('[ABCLogScreen] submit error:', err);
      amplitudeService.trackError(err as Error, 'ABCLogScreen.handleSubmit');
      Alert.alert('Error', 'Could not save the log. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setToastVisible(false);
        navigation.goBack();
      });
    }, 2500);
  };

  const handleNewEntry = () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setToastVisible(false);
      resetForm();
    });
    amplitudeService.trackEvent('ABC Log New Entry Pressed');
  };

  const handleSafetyAcknowledged = async () => {
    await userStorage.setItem(SAFETY_CHECK_KEY, '1');
    setShowSafetyModal(false);
    await doSubmit();
  };

  const resetForm = () => {
    setStep(0);
    setSelected({ antecedents: [], behaviors: [], situations: [], places: [], persons: [], consequences: [] });
    setPosSelected({ positiveBehaviors: [], positiveSituations: [] });
    setIntensity(null);
    setDurationBucket(null);
    setSelectedTimeSlot(null);
  };

  // ── Render helpers ───────────────────────────────────────────────────────────

  // Frequency-sorted tag list with custom tags and "Add your own"
  const renderTagList = (cat: ChallengingCategory, allowCustom = true, overrideTags?: string[]) => {
    const baseTags = overrideTags ?? (() => {
      const defaultMap: Record<ChallengingCategory, string[]> = {
        antecedents: ANTECEDENT_TAGS, behaviors: BEHAVIOR_TAGS,
        situations: SITUATION_TAGS, places: PLACE_TAGS,
        persons: PERSON_TAGS, consequences: CONSEQUENCE_TAGS,
      };
      return defaultMap[cat];
    })();

    const sorted = overrideTags ? baseTags : sortedTags(cat, baseTags);
    const allTags = allowCustom ? [...sorted, ...customTags[cat]] : sorted;
    const selectedSet = new Set(selected[cat]);

    return (
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {allTags.map(tag => {
          const sel = selectedSet.has(tag);
          const isCust = customTags[cat].includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.optionCard, sel && { borderColor: accentColor, borderWidth: 2, backgroundColor: selectedBg }]}
              onPress={() => toggleTag(cat, tag)}
              onLongPress={() => isCust ? handleDeleteCustomTag(cat, tag) : undefined}
              activeOpacity={0.8}
            >
              <Text style={styles.optionLabel}>{tag}</Text>
              {sel && <Ionicons name="checkmark-circle" size={24} color={accentColor} />}
            </TouchableOpacity>
          );
        })}
        {allowCustom && customTags[cat].length < 3 && (
          <TouchableOpacity
            style={[styles.addCustomCard, { borderColor: accentColor }]}
            onPress={() => { setCustomModalCategory(cat); setCustomTagInput(''); setShowCustomModal(true); }}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={20} color={accentColor} />
            <Text style={[styles.addCustomLabel, { color: accentColor }]}>Add your own</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  // Inline tag items (no wrapping ScrollView) for the combined context step
  const renderInlineTags = (cat: ChallengingCategory, tags: string[]) => {
    const sorted = sortedTags(cat, tags);
    return sorted.map(tag => {
      const sel = selected[cat].includes(tag);
      return (
        <TouchableOpacity
          key={tag}
          style={[styles.optionCard, sel && { borderColor: accentColor, borderWidth: 2, backgroundColor: selectedBg }]}
          onPress={() => toggleTag(cat, tag)}
          activeOpacity={0.8}
        >
          <Text style={styles.optionLabel}>{tag}</Text>
          {sel && <Ionicons name="checkmark-circle" size={24} color={accentColor} />}
        </TouchableOpacity>
      );
    });
  };

  const renderCombinedContextStep = () => (
    <ScrollView contentContainerStyle={[styles.listContent, { paddingBottom: 24 }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.contextSectionLabel}>What was happening?</Text>
      {renderInlineTags('situations', SITUATION_TAGS)}
      <Text style={[styles.contextSectionLabel, { marginTop: 20 }]}>Where?</Text>
      {renderInlineTags('places', PLACE_TAGS)}
      <Text style={[styles.contextSectionLabel, { marginTop: 20 }]}>Who else was there?</Text>
      {renderInlineTags('persons', PERSON_TAGS)}
    </ScrollView>
  );

  const renderPosTagList = (cat: PositiveCategory, tags: string[]) => (
    <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
      {tags.map(tag => {
        const sel = posSelected[cat].includes(tag);
        return (
          <TouchableOpacity
            key={tag}
            style={[styles.optionCard, sel && { borderColor: accentColor, borderWidth: 2, backgroundColor: selectedBg }]}
            onPress={() => togglePosTag(cat, tag)}
            activeOpacity={0.8}
          >
            <Text style={styles.optionLabel}>{tag}</Text>
            {sel && <Ionicons name="checkmark-circle" size={24} color={accentColor} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // Hour chips — replaces the DateTimePicker spinner
  const renderTimeChips = () => (
    <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
      <View style={styles.timeChipGrid}>
        {TIME_SLOTS.map(slot => {
          const active = selectedTimeSlot === slot.hour;
          return (
            <TouchableOpacity
              key={slot.hour}
              style={[styles.timeChip, active && { borderColor: accentColor, borderWidth: 2, backgroundColor: selectedBg }]}
              onPress={() => setSelectedTimeSlot(active ? null : slot.hour)}
              activeOpacity={0.8}
            >
              <Text style={[styles.timeChipLabel, active && { color: accentColor }]}>{slot.label}</Text>
              <Text style={styles.timeChipRange}>{slot.range}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderSeverityStep = () => (
    <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.severityLabel}>How intense was it?</Text>
      <View style={styles.intensityRow}>
        {INTENSITY_EMOJI.map((emoji, i) => {
          const val = i + 1;
          const active = intensity === val;
          return (
            <TouchableOpacity
              key={val}
              style={[styles.intensityBtn, active && { borderColor: accentColor, backgroundColor: selectedBg }]}
              onPress={() => setIntensity(active ? null : val)}
              activeOpacity={0.8}
            >
              <Text style={styles.intensityEmoji}>{emoji}</Text>
              <Text style={[styles.intensityNum, active && { color: accentColor }]}>{val}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.severityLabel, { marginTop: 28 }]}>How long did it last?</Text>
      {DURATION_OPTIONS.map(opt => {
        const active = durationBucket === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.optionCard, active && { borderColor: accentColor, borderWidth: 2, backgroundColor: selectedBg }]}
            onPress={() => setDurationBucket(active ? null : opt)}
            activeOpacity={0.8}
          >
            <Text style={styles.optionLabel}>{opt}</Text>
            {active && <Ionicons name="checkmark-circle" size={24} color={accentColor} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  // ── Step router ──────────────────────────────────────────────────────────────

  const renderStep = () => {
    if (isPositive) {
      if (step === 0) return renderPosTagList('positiveBehaviors', POSITIVE_BEHAVIOR_TAGS);
      if (step === 1) return renderPosTagList('positiveSituations', SITUATION_TAGS);
      if (step === 2) return renderTimeChips();
    } else {
      if (step === 0) return renderTagList('behaviors', false);
      if (step === 1) return renderTagList('antecedents');
      if (step === 2) {
        // Infer consequence ordering from behavior + antecedent selections
        const inferred = inferConsequenceTags(selected.behaviors, selected.antecedents);
        const hasInference = inferred[0] !== CONSEQUENCE_TAGS[0];
        return (
          <>
            {hasInference && (
              <View style={styles.inferenceBadge}>
                <Ionicons name="sparkles-outline" size={13} color={COLORS.mainPurple} />
                <Text style={styles.inferenceText}>Reordered based on what you selected</Text>
              </View>
            )}
            {renderTagList('consequences', true, inferred)}
          </>
        );
      }
      if (step === 3) return renderSeverityStep();
      if (step === 4) return renderCombinedContextStep();
      if (step === 5) return renderTimeChips();
    }
    return null;
  };

  const TITLES = isPositive ? P_TITLES : C_TITLES;
  const SUBTITLES = isPositive ? P_SUBTITLES : C_SUBTITLES;

  // ── Intro ────────────────────────────────────────────────────────────────────

  if (showIntro === null) {
    return <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']} />;
  }

  if (showIntro) {
    const features = isPositive
      ? [
          { icon: 'star-outline' as const, label: 'Catch the wins', desc: "Log moments when your child did something well — big or small." },
          { icon: 'analytics-outline' as const, label: 'Balance the picture', desc: "Tracking positive behaviors helps Nora give advice that builds on what's already working." },
          { icon: 'heart-outline' as const, label: 'PCIT is strength-based', desc: "Noticing and labeling good behavior is the most powerful tool you have." },
        ]
      : [
          { icon: 'create-outline' as const, label: 'Three taps to log', desc: "Capture the core ABC in three steps. Add more detail when you have the time." },
          { icon: 'analytics-outline' as const, label: 'Nora spots patterns', desc: "As you log, Nora tracks frequency and timing to find recurring triggers." },
          { icon: 'bulb-outline' as const, label: 'Advice surfaces automatically', desc: "You'll see Nora's analysis on the log screen — no button-pressing required." },
        ];

    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.introContainer}>
          <ScrollView contentContainerStyle={styles.introContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.introIconCircle, { backgroundColor: isPositive ? '#ECFDF5' : '#F3EEFF' }]}>
              <Ionicons name={isPositive ? 'star' : 'journal'} size={36} color={accentColor} />
            </View>
            <Text style={styles.introTitle}>
              {isPositive
                ? "Celebrate the wins. They matter more than you think."
                : "Three taps to log. Nora handles the rest."}
            </Text>
            <View style={styles.introFeatureList}>
              {features.map(f => (
                <View key={f.label} style={styles.introFeatureRow}>
                  <View style={[styles.introFeatureIcon, { backgroundColor: isPositive ? '#ECFDF5' : '#F3EEFF' }]}>
                    <Ionicons name={f.icon} size={22} color={accentColor} />
                  </View>
                  <View style={styles.introFeatureText}>
                    <Text style={styles.introFeatureLabel}>{f.label}</Text>
                    <Text style={styles.introFeatureDesc}>{f.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
              <Ionicons name="arrow-back" size={22} color="#1F2937" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.continueBtn, { backgroundColor: accentColor }]}
              onPress={async () => { await userStorage.setItem(INTRO_SEEN_KEY, '1'); setShowIntro(false); }}
              activeOpacity={0.8}
            >
              <Text style={styles.continueBtnText}>Let's start</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>

          {/* Progress bar — dims last 3 segments until extended mode */}
          <View style={styles.progressRow}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <React.Fragment key={i}>
                {/* Divider between quick and extended segments */}
                {!isPositive && i === 3 && <View style={styles.progressDivider} />}
                <View style={styles.progressSegmentBg}>
                  <View style={[
                    styles.progressSegmentFill,
                    {
                      backgroundColor: accentColor,
                      width: i < step ? '100%' : i === step ? '50%' : '0%',
                      opacity: !isPositive && i >= 3 && step < 3 ? 0.2 : 1,
                    },
                  ]} />
                </View>
              </React.Fragment>
            ))}
          </View>

          {/* Phase labels */}
          {!isPositive && (
            <View style={styles.phaseLabels}>
              <Text style={styles.phaseLabelLeft}>Quick capture</Text>
              <Text style={[styles.phaseLabelRight, step >= 3 && { color: accentColor }]}>Optional detail</Text>
            </View>
          )}

          <Text style={styles.title}>{TITLES[step]}</Text>
          <Text style={styles.subtitle}>{SUBTITLES[step]}</Text>

          <View style={styles.contentArea}>{renderStep()}</View>

          {/* Primary action row */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.85}>
              <Ionicons name="arrow-back" size={22} color="#1F2937" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.continueBtn, { backgroundColor: accentColor }, !canAdvance() && styles.continueBtnDisabled]}
              onPress={isQuickSave || isLastStep ? handleSubmit : goNext}
              disabled={!canAdvance() || submitting}
              activeOpacity={0.8}
            >
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={[styles.continueBtnText, !canAdvance() && styles.continueBtnTextDisabled]}>
                    {isQuickSave || isLastStep ? 'Save Log' : 'Continue'}
                  </Text>
              }
            </TouchableOpacity>
          </View>

          {/* "Add more context" at step 2 */}
          {isQuickSave && (
            <TouchableOpacity style={styles.addContextBtn} onPress={goNext} activeOpacity={0.7}>
              <Text style={[styles.addContextText, { color: accentColor }]}>Add more context</Text>
              <Ionicons name="chevron-forward" size={15} color={accentColor} />
            </TouchableOpacity>
          )}

          {/* Skip as a real bordered button for extended steps */}
          {!isPositive && step >= 3 && step < TOTAL_STEPS - 1 && (
            <TouchableOpacity style={styles.skipBtn} onPress={goNext} activeOpacity={0.7}>
              <Text style={styles.skipBtnText}>Skip this step</Text>
            </TouchableOpacity>
          )}

          {(isPositive || (!isQuickSave && (step < 3 || step === TOTAL_STEPS - 1))) && (
            <View style={{ height: 16 }} />
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Toast success banner (replaces blocking modal) */}
      {toastVisible && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
          <View style={styles.toastInner}>
            <Ionicons name="checkmark-circle" size={22} color="#10B981" />
            <Text style={styles.toastMessage} numberOfLines={2}>{toastMessage}</Text>
            <TouchableOpacity style={styles.toastNewEntry} onPress={handleNewEntry} activeOpacity={0.8}>
              <Text style={styles.toastNewEntryText}>New Entry</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Safety modal */}
      <Modal visible={showSafetyModal} transparent animationType="fade" onRequestClose={() => setShowSafetyModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.safetyIconWrap}>
              <Ionicons name="heart-outline" size={36} color="#D97558" />
            </View>
            <Text style={styles.safetyTitle}>A quick check-in</Text>
            <Text style={styles.safetyBody}>
              You logged a behavior that can sometimes put someone at risk. Nora is not a crisis tool.
            </Text>
            <Text style={styles.safetyBody}>
              If you or your child are ever in immediate danger, please reach out to a local crisis service or your child's therapist.
            </Text>
            <Text style={styles.safetyResources}>
              🆘 Emergency services: 999{'\n'}
              📞 Mental health support: 1800-221-4444 (Singapore){'\n'}
              💬 Your child's therapist is always your first call.
            </Text>
            <TouchableOpacity style={[styles.modalAdd, { marginTop: 8 }]} onPress={handleSafetyAcknowledged} activeOpacity={0.85}>
              <Text style={styles.modalAddText}>Got it — save my log</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Custom tag modal */}
      <Modal visible={showCustomModal} transparent animationType="fade" onRequestClose={() => setShowCustomModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCustomModal(false)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Add your own option</Text>
            <TextInput
              style={styles.modalInput}
              value={customTagInput}
              onChangeText={setCustomTagInput}
              placeholder="e.g. Refused to eat dinner"
              maxLength={30}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAddCustomTag}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCustomModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAdd, { backgroundColor: accentColor }, !customTagInput.trim() && { backgroundColor: '#E5E7EB' }]}
                onPress={handleAddCustomTag}
                disabled={!customTagInput.trim()}
              >
                <Text style={styles.modalAddText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },

  progressRow: { flexDirection: 'row', gap: 4, alignItems: 'center', marginBottom: 4 },
  progressSegmentBg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#F3F4F6', overflow: 'hidden' },
  progressSegmentFill: { height: '100%', borderRadius: 3 },
  progressDivider: { width: 1, height: 12, backgroundColor: '#D1D5DB', marginHorizontal: 2 },

  phaseLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  phaseLabelLeft: { fontFamily: FONTS.regular, fontSize: 10, color: '#9CA3AF' },
  phaseLabelRight: { fontFamily: FONTS.regular, fontSize: 10, color: '#D1D5DB' },

  title: { fontFamily: FONTS.bold, fontSize: 24, color: '#1E2939', textAlign: 'center', marginBottom: 6, lineHeight: 32 },
  subtitle: { fontFamily: FONTS.regular, fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 20 },

  contentArea: { flex: 1 },
  listContent: { paddingBottom: 16 },

  optionCard: {
    flexDirection: 'row', alignItems: 'center', minHeight: 56,
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 36,
    paddingHorizontal: 24, paddingVertical: 10, marginBottom: 10, backgroundColor: '#FFFFFF',
  },
  optionLabel: { flex: 1, fontFamily: FONTS.semiBold, fontSize: 15, color: '#1E2939' },

  inferenceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F3EEFF', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12, alignSelf: 'flex-start',
  },
  inferenceText: { fontFamily: FONTS.regular, fontSize: 12, color: COLORS.mainPurple },

  contextSectionLabel: { fontFamily: FONTS.bold, fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },

  addCustomCard: {
    flexDirection: 'row', alignItems: 'center', minHeight: 56,
    borderWidth: 1.5, borderRadius: 36, paddingHorizontal: 24, paddingVertical: 10,
    marginBottom: 10, backgroundColor: '#FFFFFF', gap: 10, borderStyle: 'dashed',
  },
  addCustomLabel: { fontFamily: FONTS.semiBold, fontSize: 15 },

  // Hour chips
  timeChipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeChip: {
    width: '47%', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, backgroundColor: '#fff',
  },
  timeChipLabel: { fontFamily: FONTS.semiBold, fontSize: 14, color: '#1E2939', marginBottom: 2 },
  timeChipRange: { fontFamily: FONTS.regular, fontSize: 12, color: '#9CA3AF' },

  severityLabel: { fontFamily: FONTS.semiBold, fontSize: 15, color: '#1E2939', marginBottom: 14 },
  intensityRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  intensityBtn: {
    flex: 1, marginHorizontal: 4, alignItems: 'center', paddingVertical: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 16, backgroundColor: '#fff',
  },
  intensityEmoji: { fontSize: 28, marginBottom: 4 },
  intensityNum: { fontFamily: FONTS.semiBold, fontSize: 13, color: '#6B7280' },

  buttonRow: { flexDirection: 'row', gap: 12, paddingTop: 12 },
  backBtn: { width: 56, height: 56, borderRadius: 30, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  continueBtn: { flex: 1, height: 56, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  continueBtnDisabled: { backgroundColor: '#E5E7EB' },
  continueBtnText: { fontFamily: FONTS.semiBold, fontSize: 18, color: '#FFFFFF' },
  continueBtnTextDisabled: { color: '#9CA3AF' },

  addContextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 16, paddingBottom: 8 },
  addContextText: { fontFamily: FONTS.semiBold, fontSize: 15 },

  skipBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14, marginTop: 8, marginBottom: 4, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 30 },
  skipBtnText: { fontFamily: FONTS.semiBold, fontSize: 15, color: '#9CA3AF' },

  // Toast
  toast: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
  },
  toastInner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1E2939', margin: 16, marginTop: Platform.OS === 'ios' ? 56 : 16,
    borderRadius: 16, padding: 16,
  },
  toastMessage: { flex: 1, fontFamily: FONTS.regular, fontSize: 13, color: '#fff', lineHeight: 18 },
  toastNewEntry: { backgroundColor: '#FFFFFF20', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  toastNewEntryText: { fontFamily: FONTS.semiBold, fontSize: 12, color: '#fff' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 440, maxHeight: '85%' },

  safetyIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF3EE', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  safetyTitle: { fontFamily: FONTS.bold, fontSize: 20, color: '#1E2939', textAlign: 'center', marginBottom: 12 },
  safetyBody: { fontFamily: FONTS.regular, fontSize: 15, color: '#6B7280', lineHeight: 22, textAlign: 'center', marginBottom: 10 },
  safetyResources: { fontFamily: FONTS.regular, fontSize: 14, color: '#374151', lineHeight: 24, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginVertical: 8 },

  modalTitle: { fontFamily: FONTS.bold, fontSize: 18, color: '#1E2939', marginBottom: 16 },
  modalInput: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 36, paddingHorizontal: 20, paddingVertical: 14, fontFamily: FONTS.regular, fontSize: 16, color: '#1E2939', marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 30, borderWidth: 1, borderColor: '#E5E7EB' },
  modalCancelText: { fontFamily: FONTS.semiBold, fontSize: 16, color: '#6B7280' },
  modalAdd: { flex: 1, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 30, backgroundColor: COLORS.mainPurple },
  modalAddText: { fontFamily: FONTS.semiBold, fontSize: 16, color: '#fff' },

  introContainer: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  introContent: { paddingBottom: 24 },
  introIconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 24, marginTop: 8 },
  introTitle: { fontFamily: FONTS.bold, fontSize: 24, color: '#1E2939', textAlign: 'center', lineHeight: 34, marginBottom: 36, paddingHorizontal: 8 },
  introFeatureList: { gap: 24 },
  introFeatureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  introFeatureIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  introFeatureText: { flex: 1, paddingTop: 4 },
  introFeatureLabel: { fontFamily: FONTS.bold, fontSize: 16, color: '#1E2939', marginBottom: 4 },
  introFeatureDesc: { fontFamily: FONTS.regular, fontSize: 14, color: '#6B7280', lineHeight: 22 },
});
