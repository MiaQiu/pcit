import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { useAuthService } from '../contexts/AppContext';
import {
  ANTECEDENT_TAGS,
  SITUATION_TAGS,
  PLACE_TAGS,
  PERSON_TAGS,
  CONSEQUENCE_TAGS,
} from '../data/abcTags';
import { getTodaySingapore } from '../utils/timezone';
import * as userStorage from '../lib/userStorage';
import amplitudeService from '../services/amplitudeService';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const CUSTOM_TAGS_KEY = (category: string) => `abc_custom_tags_${category}`;
const TOTAL_STEPS = 6;

const INTRO_FEATURES = [
  {
    icon: 'create-outline' as const,
    label: 'Log the triggers',
    description: "Quickly note the \"what, when, and why\" behind an outburst.",
  },
  {
    icon: 'analytics-outline' as const,
    label: 'Let Nora spot patterns',
    description: "As you log, Nora automatically tracks the frequency and intensity to find recurring triggers.",
  },
  {
    icon: 'bulb-outline' as const,
    label: 'Get tailored strategies',
    description: "When Nora detects a pattern, you'll get instant, science-backed tips to handle future situations with confidence.",
  },
];

const SUCCESS_MESSAGES = [
  "Logging helps us understand the pattern; thanks for staying consistent.",
  "Understanding the 'why' is the first step toward change.",
  "Your consistency is key to identifying behavior patterns.",
  "Every log helps us see the bigger picture.",
];

type StepIndex = 0 | 1 | 2 | 3 | 4 | 5;
type Category = 'antecedents' | 'situations' | 'places' | 'persons' | 'consequences';

const STEP_TITLES = [
  'When did it\nhappen?',
  'What was the\nantecedent?',
  'What else was\nhappening?',
  'Where was your child\nwhen this happened?',
  'Who else\nwas there?',
  'What was the\nconsequence?',
];

const STEP_SUBTITLES = [
  'Pick a time or mark as not sure',
  'My child:',
  'Select all that apply.',
  'Select all that apply.',
  'Select all that apply.',
  'My child:',
];

const DEFAULT_TAGS: Record<Category, string[]> = {
  antecedents: ANTECEDENT_TAGS,
  situations: SITUATION_TAGS,
  places: PLACE_TAGS,
  persons: PERSON_TAGS,
  consequences: CONSEQUENCE_TAGS,
};

export const ABCLogScreen: React.FC = () => {
  const navigation = useNavigation();
  const authService = useAuthService();

  const [showIntro, setShowIntro] = useState(true);
  const [step, setStep] = useState<StepIndex>(0);

  const [selected, setSelected] = useState<Record<Category, string[]>>({
    antecedents: [],
    situations: [],
    places: [],
    persons: [],
    consequences: [],
  });
  const [customTags, setCustomTags] = useState<Record<Category, string[]>>({
    antecedents: [],
    situations: [],
    places: [],
    persons: [],
    consequences: [],
  });

  const [timeNotSure, setTimeNotSure] = useState(false);
  const [recordedTime, setRecordedTime] = useState(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    return d;
  });

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customModalCategory, setCustomModalCategory] = useState<Category>('antecedents');
  const [customTagInput, setCustomTagInput] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    amplitudeService.trackScreenView('ABC Log');
  }, []);

  const loadCustomTags = async (category: Category): Promise<string[]> => {
    try {
      const stored = await userStorage.getItem(CUSTOM_TAGS_KEY(category));
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const saveCustomTags = async (category: Category, tags: string[]) => {
    await userStorage.setItem(CUSTOM_TAGS_KEY(category), JSON.stringify(tags));
  };

  const toggleTag = (category: Category, tag: string) => {
    setSelected(prev => {
      const current = prev[category];
      return {
        ...prev,
        [category]: current.includes(tag)
          ? current.filter(t => t !== tag)
          : [...current, tag],
      };
    });
  };

  const handleAddCustomTag = async () => {
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    const cat = customModalCategory;
    const updated = [...customTags[cat], trimmed].slice(0, 3);
    setCustomTags(prev => ({ ...prev, [cat]: updated }));
    await saveCustomTags(cat, updated);
    amplitudeService.trackEvent('abc_custom_tag_added', { category: cat });
    setCustomTagInput('');
    setShowCustomModal(false);
  };

  const handleDeleteCustomTag = (category: Category, tag: string) => {
    Alert.alert('Remove tag', `Remove "${tag}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const updated = customTags[category].filter(t => t !== tag);
          setCustomTags(prev => ({ ...prev, [category]: updated }));
          await saveCustomTags(category, updated);
        },
      },
    ]);
  };

  const goNext = () => {
    amplitudeService.trackEvent('ABC Log Next Pressed', { step });
    if (step < 5) setStep((step + 1) as StepIndex);
  };

  const goBack = () => {
    amplitudeService.trackEvent('ABC Log Back Pressed', { step });
    if (step > 0) setStep((step - 1) as StepIndex);
    else navigation.goBack();
  };

  const canAdvance = () => {
    if (step === 1) return selected.antecedents.length > 0;
    return true;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const recordedAt = timeNotSure ? undefined : recordedTime.toISOString();

      await authService.authenticatedRequest(`${API_URL}/api/abc-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logType: 'CHALLENGING',
          antecedents: selected.antecedents,
          situations: selected.situations,
          places: selected.places,
          persons: selected.persons,
          consequences: selected.consequences,
          recordedAt,
        }),
      });

      await userStorage.setItem('abc_logged_today', getTodaySingapore());

      amplitudeService.trackEvent('abc_log_completed', {
        log_type: 'challenging',
        num_antecedents: selected.antecedents.length,
        num_situations: selected.situations.length,
        num_places: selected.places.length,
        num_persons: selected.persons.length,
        num_consequences: selected.consequences.length,
        source: 'quick',
      });

      setSuccessMessage(SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)]);
      setShowSuccessModal(true);
    } catch (err) {
      console.error('[ABCLogScreen] submit error:', err);
      amplitudeService.trackError(err as Error, 'ABCLogScreen.handleSubmit');
      Alert.alert('Error', 'Could not save the log. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    amplitudeService.trackEvent('ABC Log Closed');
    setShowSuccessModal(false);
    navigation.goBack();
  };

  const handleLogAnother = () => {
    amplitudeService.trackEvent('ABC Log Another Pressed');
    setShowSuccessModal(false);
    setStep(0);
    setSelected({ antecedents: [], situations: [], places: [], persons: [], consequences: [] });
    setTimeNotSure(false);
    setRecordedTime(() => {
      const d = new Date();
      d.setMinutes(0, 0, 0);
      return d;
    });
  };

  // ── Tag list ───────────────────────────────────────────────────────────────

  const renderTagList = (category: Category) => {
    const allTags = [...DEFAULT_TAGS[category], ...customTags[category]];
    const isCustom = (tag: string) => customTags[category].includes(tag);

    return (
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {allTags.map(tag => {
          const isSelected = selected[category].includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.optionCard, isSelected && styles.optionCardSelected]}
              onPress={() => toggleTag(category, tag)}
              onLongPress={() => isCustom(tag) ? handleDeleteCustomTag(category, tag) : undefined}
              activeOpacity={0.8}
            >
              <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                {tag}
              </Text>
              {isSelected && (
                <Ionicons name="checkmark-circle" size={24} color={COLORS.mainPurple} />
              )}
            </TouchableOpacity>
          );
        })}

        {customTags[category].length < 3 && (
          <TouchableOpacity
            style={styles.addCustomCard}
            onPress={() => {
              setCustomModalCategory(category);
              setCustomTagInput('');
              setShowCustomModal(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={20} color={COLORS.mainPurple} />
            <Text style={styles.addCustomLabel}>Others</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  // ── Intro page ─────────────────────────────────────────────────────────────

  if (showIntro) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.introContainer}>
          <ScrollView contentContainerStyle={styles.introContent} showsVerticalScrollIndicator={false}>
            <View style={styles.introIconCircle}>
              <Ionicons name="journal" size={36} color={COLORS.mainPurple} />
            </View>

            <Text style={styles.introTitle}>
              Track, understand, and manage your child's big emotions.
            </Text>

            <View style={styles.introFeatureList}>
              {INTRO_FEATURES.map((f) => (
                <View key={f.label} style={styles.introFeatureRow}>
                  <View style={styles.introFeatureIcon}>
                    <Ionicons name={f.icon} size={22} color={COLORS.mainPurple} />
                  </View>
                  <View style={styles.introFeatureText}>
                    <Text style={styles.introFeatureLabel}>{f.label}</Text>
                    <Text style={styles.introFeatureDesc}>{f.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.continueBtn} onPress={() => setShowIntro(false)} activeOpacity={0.8}>
              <Text style={styles.continueBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.skipLink} />
        </View>
      </SafeAreaView>
    );
  }

  // ── Time step (step 0) ─────────────────────────────────────────────────────

  const renderTimePicker = () => (
    <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
      <View style={{ opacity: timeNotSure ? 0.3 : 1 }}>
        <DateTimePicker
          mode="time"
          value={recordedTime}
          display="spinner"
          minuteInterval={60}
          onChange={(_, date) => {
            if (date) {
              setTimeNotSure(false);
              setRecordedTime(date);
            }
          }}
        />
      </View>

      <TouchableOpacity
        style={[styles.optionCard, timeNotSure && styles.optionCardSelected, { justifyContent: 'center' }]}
        onPress={() => setTimeNotSure(v => !v)}
        activeOpacity={0.8}
      >
        <Text style={[styles.optionLabel, { flex: 0, textAlign: 'center' }, timeNotSure && { color: COLORS.mainPurple }]}>
          Not sure
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>

          {/* Progress bar */}
          <View style={styles.progressRow}>
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View key={i} style={styles.progressSegmentBg}>
                <View style={[
                  styles.progressSegmentFill,
                  { width: i <= step ? '100%' : '0%' },
                ]} />
              </View>
            ))}
          </View>

          {/* Title */}
          <Text style={styles.title}>{STEP_TITLES[step]}</Text>
          <Text style={styles.subtitle}>{STEP_SUBTITLES[step]}</Text>

          {/* Content */}
          <View style={styles.contentArea}>
            {step === 0 && renderTimePicker()}
            {step === 1 && renderTagList('antecedents')}
            {step === 2 && renderTagList('situations')}
            {step === 3 && renderTagList('places')}
            {step === 4 && renderTagList('persons')}
            {step === 5 && renderTagList('consequences')}
          </View>

          {/* Button row */}
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.85}>
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.continueBtn, !canAdvance() && styles.continueBtnDisabled]}
              onPress={step < 5 ? goNext : handleSubmit}
              disabled={!canAdvance() || submitting}
              activeOpacity={0.8}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[styles.continueBtnText, !canAdvance() && styles.continueBtnTextDisabled]}>
                  {step < 5 ? 'Continue' : 'Save Log'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Skip link — always rendered to keep footer height consistent */}
          <TouchableOpacity
            style={styles.skipLink}
            onPress={step < 5 ? goNext : handleSubmit}
            disabled={step < 2}
            activeOpacity={0.6}
          >
            <Text style={[styles.skipLinkText, step < 2 && { opacity: 0 }]}>
              Skip this step
            </Text>
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>

      {/* Success modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="checkmark-circle" size={56} color={COLORS.mainPurple} style={{ alignSelf: 'center', marginBottom: 16 }} />
            <Text style={styles.successTitle}>Log Saved</Text>
            <Text style={styles.successMessage}>{successMessage}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={handleLogAnother} activeOpacity={0.8}>
                <Text style={styles.modalCancelText}>Log Another</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAdd} onPress={handleClose} activeOpacity={0.8}>
                <Text style={styles.modalAddText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Custom tag modal */}
      <Modal
        visible={showCustomModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCustomModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCustomModal(false)}
        >
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Add other option</Text>
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
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowCustomModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalAdd, !customTagInput.trim() && styles.modalAddDisabled]}
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
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 28,
  },
  progressSegmentBg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  progressSegmentFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: COLORS.mainPurple,
  },

  title: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: '#4A5565',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
  },

  contentArea: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 16,
  },

  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 68,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 36,
    paddingHorizontal: 24,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  optionCardSelected: {
    borderColor: COLORS.mainPurple,
    borderWidth: 2,
    backgroundColor: '#F3EEFF',
  },
  optionLabel: {
    flex: 1,
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#1E2939',
  },
  optionLabelSelected: {
    color: '#1E2939',
  },

  addCustomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 68,
    borderWidth: 1.5,
    borderColor: COLORS.mainPurple,
    borderRadius: 36,
    paddingHorizontal: 24,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    gap: 10,
    borderStyle: 'dashed',
  },
  addCustomLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.mainPurple,
  },

  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 8,
    paddingTop: 20,
  },
  backBtn: {
    width: 56,
    height: 56,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 22,
    color: '#1F2937',
  },
  continueBtn: {
    flex: 1,
    height: 56,
    backgroundColor: COLORS.mainPurple,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  continueBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 18,
    color: '#FFFFFF',
  },
  continueBtnTextDisabled: {
    color: '#9CA3AF',
  },
  skipLink: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingBottom: 12,
  },
  skipLinkText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#9CA3AF',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
  },
  successTitle: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: '#1E2939',
    textAlign: 'center',
    marginBottom: 10,
  },
  successMessage: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: '#1E2939',
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 36,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: '#1E2939',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalCancelText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#6B7280',
  },
  modalAdd: {
    flex: 1,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    backgroundColor: COLORS.mainPurple,
  },
  modalAddDisabled: {
    backgroundColor: '#E5E7EB',
  },
  modalAddText: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: '#fff',
  },

  introContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  introContent: {
    paddingBottom: 24,
  },
  introIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F3EEFF',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  introTitle: {
    fontFamily: FONTS.bold,
    fontSize: 24,
    color: '#1E2939',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: 36,
    paddingHorizontal: 8,
  },
  introFeatureList: {
    gap: 24,
  },
  introFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  introFeatureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3EEFF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  introFeatureText: {
    flex: 1,
    paddingTop: 4,
  },
  introFeatureLabel: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: '#1E2939',
    marginBottom: 4,
  },
  introFeatureDesc: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },
});
