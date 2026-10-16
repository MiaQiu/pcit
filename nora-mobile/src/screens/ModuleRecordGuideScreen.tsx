/**
 * ModuleRecordGuideScreen
 * The Screen Time module's illustrated recording guides, opened from the help
 * links on the module's practice card:
 * - howToRecord: five steps (when to start, lock the phone, handle it as
 *   usual, auto-stop at 30 min, get the report) and a "Start recording"
 *   button that goes back to the module screen and starts recording there
 *   (useModuleRecorder lives on that screen).
 * - whyRecord: what Nora gets from a real recording (child dynamics,
 *   actionable feedback), each with an example.
 * Copy lives in i18n under `learnV2.modules.<moduleKey>.recordGuides.<guide>`.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/assets';
import type { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import { TrackedTouchable } from '../components/TrackedTouchable';
import amplitudeService from '../services/amplitudeService';

const DINO = require('../../assets/images/modules/record_guide/dino.png');

export type RecordGuideKey = 'howToRecord' | 'whyRecord';

interface GuideStep {
  image: ReturnType<typeof require>;
  // Card tint and step-number circle colors (from the design).
  bg: string;
  badgeBg: string;
  numberColor: string;
  // Tint of the "Example" box (copy: steps.<n>.example); none = no box.
  exampleBg?: string;
  // Picture width / height (stacked layout only; side crops to the box).
  aspect?: number;
}

interface Guide {
  steps: GuideStep[];
  startButton: boolean;
  // side: picture in the card's left half, text on the right.
  // stacked: wide picture on top (number circle notched into its corner),
  // text below at full width.
  layout: 'side' | 'stacked';
  // Width of the header dino.
  dinoWidth: number;
}

const GUIDES: Record<RecordGuideKey, Guide> = {
  howToRecord: {
    startButton: true,
    layout: 'side',
    dinoWidth: 104,
    steps: [
      { image: require('../../assets/images/modules/record_guide/step1.jpg'), bg: '#F4F9F3', badgeBg: '#DDEFE3', numberColor: '#164C3F' },
      { image: require('../../assets/images/modules/record_guide/step2.jpg'), bg: '#F3F8FE', badgeBg: '#D8EAF8', numberColor: '#06324D' },
      { image: require('../../assets/images/modules/record_guide/step3.jpg'), bg: '#FFF8F0', badgeBg: '#FBEBCD', numberColor: '#846026' },
      { image: require('../../assets/images/modules/record_guide/step4.jpg'), bg: '#F3F8FE', badgeBg: '#D8EAF8', numberColor: '#06324D' },
      { image: require('../../assets/images/modules/record_guide/step5.jpg'), bg: '#FEEFF2', badgeBg: '#F9D9DE', numberColor: '#9B4A57' },
    ],
  },
  whyRecord: {
    startButton: false,
    layout: 'stacked',
    dinoWidth: 120,
    steps: [
      { image: require('../../assets/images/modules/record_guide/why_step1.jpg'), aspect: 625 / 264, bg: '#F2F9F5', badgeBg: '#D6EBE1', numberColor: '#0A373E', exampleBg: '#E8F4EF' },
      { image: require('../../assets/images/modules/record_guide/why_step2.jpg'), aspect: 625 / 249, bg: '#EFF7FD', badgeBg: '#D2E7F9', numberColor: '#43779E', exampleBg: '#E1F1FC' },
    ],
  },
};

const BG = '#FEFEFE'; // matches the dino art's background
const INK = '#0F3D35';
const MUTED = '#6B7280';
const CTA = '#15443A';
const EXAMPLE_ACCENT = '#248160'; // pin icon + "Example:" label
const DINO_ASPECT = 197 / 248;
const HEADER_GAP = 14; // below the header
const STEP_GAP = 10;   // above each step box

export const ModuleRecordGuideScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'ModuleRecordGuide'>>();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { moduleKey, guide, canRecord = true } = route.params;
  const { steps, startButton, layout, dinoWidth } = GUIDES[guide];
  // Title/subtitle stay clear of the dino (it overhangs the right edge by 8).
  const dinoStyle = { width: dinoWidth, height: dinoWidth * DINO_ASPECT };
  const titleClear = { paddingRight: dinoWidth - 20 };
  const subtitleClear = { paddingRight: dinoWidth - 12 };
  const base = `learnV2.modules.${moduleKey}.recordGuides.${guide}`;

  const startRecording = () => {
    amplitudeService.trackEvent('Learn Module Record Guide Start Tapped', { moduleKey });
    // Back to the module screen (already under this one), which starts recording.
    navigation.popTo('LearnModule', { moduleKey, startRecordingAt: Date.now() }, { merge: true });
  };

  const renderExample = (step: GuideStep, n: number) => step.exampleBg && (
    <View style={[styles.example, { backgroundColor: step.exampleBg }]}>
      <View style={styles.exampleLabelRow}>
        <Ionicons name="pin" size={16} color={EXAMPLE_ACCENT} />
        <Text style={styles.exampleLabel}>{t(`${base}.exampleLabel`)}</Text>
      </View>
      <Text style={styles.exampleBody}>{t(`${base}.steps.${n}.example`)}</Text>
    </View>
  );

  const renderSideStep = (step: GuideStep, i: number) => (
    <View key={i} style={[styles.step, { backgroundColor: step.bg }]}>
      {/* Left half: step number, then the picture filling the rest of the
          box's height. The wrapper sets the picture's size; it fills it,
          cropped (cover). */}
      <View style={styles.stepMedia}>
        <View style={[styles.badge, { backgroundColor: step.badgeBg }]}>
          <Text style={[styles.badgeText, { color: step.numberColor }]}>{i + 1}</Text>
        </View>
        <View style={styles.stepImageWrap}>
          <Image source={step.image} style={styles.stepImage} resizeMode="cover" />
        </View>
      </View>
      <View style={styles.stepText}>
        <Text style={styles.stepTitle}>{t(`${base}.steps.${i + 1}.title`)}</Text>
        <Text style={styles.stepBody}>{t(`${base}.steps.${i + 1}.body`)}</Text>
        {renderExample(step, i + 1)}
      </View>
    </View>
  );

  const renderStackedStep = (step: GuideStep, i: number) => (
    <View key={i} style={[styles.stackStep, { backgroundColor: step.bg }]}>
      {/* Sized by the wrapper: a static Image's style defaults to the
          asset's pixel dimensions, which would override aspectRatio. */}
      <View style={[styles.stackImageWrap, { aspectRatio: step.aspect }]}>
        <Image source={step.image} style={styles.stepImage} resizeMode="cover" />
      </View>
      {/* Over the picture's top-left corner; the card-colored ring cuts a notch. */}
      <View style={[styles.stackBadge, { backgroundColor: step.badgeBg, borderColor: step.bg }]}>
        <Text style={[styles.stackBadgeText, { color: step.numberColor }]}>{i + 1}</Text>
      </View>
      <Text style={styles.stackTitle}>{t(`${base}.steps.${i + 1}.title`)}</Text>
      <Text style={styles.stackBody}>{t(`${base}.steps.${i + 1}.body`)}</Text>
      {renderExample(step, i + 1)}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.navRow}>
        <TrackedTouchable analyticsId="Back"
          onPress={() => navigation.goBack()}
          style={styles.backCircle}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={18} color={COLORS.textDark} />
        </TrackedTouchable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image source={DINO} style={[styles.dino, dinoStyle]} resizeMode="contain" />
          {/* Two lines (break in the copy); shrinks a little rather than wrap to a third */}
          <Text style={[styles.title, titleClear]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
            {t(`${base}.title`)}
          </Text>
          <Text style={[styles.subtitle, subtitleClear]}>{t(`${base}.subtitle`)}</Text>
        </View>

        {steps.map(layout === 'stacked' ? renderStackedStep : renderSideStep)}
      </ScrollView>

      {startButton && canRecord && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TrackedTouchable analyticsId={`Learn Module ${moduleKey}: recordGuideStart`}
            style={styles.cta}
            onPress={startRecording}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>{t(`${base}.cta`)}</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TrackedTouchable>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  navRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  backCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { paddingHorizontal: 16, paddingBottom: 24 },

  // ── Header ──
  header: { position: 'relative', marginBottom: HEADER_GAP },
  // Bottom edge on the first step box's top edge.
  dino: { position: 'absolute', bottom: -(HEADER_GAP + STEP_GAP), right: -8 },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.6,
    color: INK,
  },
  subtitle: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: MUTED, marginTop: 8 },

  // ── Steps ──
  step: {
    flexDirection: 'row',
    // Stretch so the picture spans the box's height (set by the text).
    alignItems: 'stretch',
    minHeight: 124,
    gap: 12,
    borderRadius: 20,
    padding: 8,
    marginTop: STEP_GAP,
  },
  stepMedia: { width: '50%' },
  stepImageWrap: { flex: 1, borderRadius: 14, overflow: 'hidden', marginTop: 6 },
  stepImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  stepText: { flex: 1, justifyContent: 'center', paddingRight: 4, paddingVertical: 6 },
  // Above the picture, at the left.
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: FONTS.bold, fontSize: 12 },
  stepTitle: { fontFamily: FONTS.bold, fontSize: 16, lineHeight: 20, color: INK },
  stepBody: { fontFamily: FONTS.regular, fontSize: 13, lineHeight: 18, color: MUTED, marginTop: 4 },
  example: { borderRadius: 14, padding: 12, marginTop: 12 },
  exampleLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exampleLabel: { fontFamily: FONTS.bold, fontSize: 13, color: EXAMPLE_ACCENT },
  exampleBody: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: MUTED, marginTop: 4 },

  // ── Stacked steps ──
  stackStep: { borderRadius: 24, padding: 14, marginTop: STEP_GAP },
  stackImageWrap: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  stackBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackBadgeText: { fontFamily: FONTS.bold, fontSize: 20 },
  stackTitle: { fontFamily: FONTS.bold, fontSize: 22, lineHeight: 28, color: INK, marginTop: 14 },
  stackBody: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 21, color: MUTED, marginTop: 4 },

  // ── Footer ──
  footer: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: BG },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CTA,
    borderRadius: 999,
    paddingVertical: 17,
  },
  ctaText: { fontFamily: FONTS.bold, fontSize: 18, color: '#FFFFFF' },
});
