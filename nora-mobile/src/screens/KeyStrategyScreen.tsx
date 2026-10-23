/**
 * KeyStrategyScreen
 * Illustrated how-to for one key screen-time strategy, opened from the
 * Recommended Strategies card of a Day 1 module report: title + dino, a
 * picture with the strategy's step badge, "Why it works" and "What to say".
 * Copy lives in i18n under `moduleReport.keyStrategyScreens.<strategy>`;
 * strategies without an entry in SCREENS expand in place instead
 * (KeyStrategyList).
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/assets';
import type { RootStackNavigationProp, RootStackParamList } from '../navigation/types';
import type { KeyStrategyId } from '../constants/learnModules';
import { TrackedTouchable } from '../components/TrackedTouchable';
import { useScreenViewDuration } from '../hooks/useScreenViewDuration';

const DINO = require('../../assets/images/modules/record_guide/dino.png');
const DINO_ASPECT = 197 / 248;
const DINO_WIDTH = 150;

type CommunityIconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface SayOptionStyle {
  icon: CommunityIconName;
  color: string;
  bg: string;
  // Label color when it differs from the icon's.
  labelColor?: string;
}

interface StrategyScreen {
  // false: no dino (and no clock/stopwatch beside it) in the header.
  dino?: boolean;
  // Picture card with the step badge (copy: badge); none = no picture card.
  image?: ReturnType<typeof require>;
  imageAspect?: number;
  // Next to the dino: a stopwatch showing this time, this icon, or (neither) a clock icon.
  headerTimer?: string;
  headerIcon?: { name: CommunityIconName; color: string };
  // Icon after the picture badge's text.
  badgeIcon?: keyof typeof Ionicons.glyphMap;
  // What to say: plain lines (copy: say[]) or labeled options (copy:
  // sayIntro + options[].label/.text), one style per option.
  sayOptions?: SayOptionStyle[];
  // Below what to say: "pause and wait" line (copy: pause) or a Nora Tip (copy: tip).
  footer: 'pause' | 'tip';
}

// Strategies with their own screen.
export const SCREENS: Partial<Record<KeyStrategyId, StrategyScreen>> = {
  countdown: {
    dino: false,
    footer: 'pause',
  },
  timer: {
    dino: false,
    sayOptions: [
      { icon: 'timer-sand',        color: '#8C49D5', bg: '#F1E8FB' },
      { icon: 'bell-outline',      color: '#3E77A8', bg: '#E3EEFA' },
      { icon: 'handshake-outline', color: '#2F8F6B', bg: '#E1F2EA' },
    ],
    footer: 'tip',
  },
  bridging: {
    dino: false,
    sayOptions: [
      { icon: 'toy-brick',  color: '#E5533D', bg: '#F1F1F3', labelColor: '#8C49D5' },
      { icon: 'star',       color: '#F2B233', bg: '#FFF3D6', labelColor: '#8C49D5' },
    ],
    footer: 'tip',
  },
};

// Colors from the design.
const BG = '#FEFEFE';
const INK = '#0F3D35';
const MUTED = '#6B7280';
const PICTURE_CARD = '#EAF4EE';
const BADGE_BG = '#D6EBDD';
const WHY_BG = '#EDF5FD';
const WHY_ICON_BG = '#D8E9F9';
const WHY_ACCENT = '#3E77A8';
const SAY_BG = '#FDEFEE';
const SAY_ACCENT = '#D9615C';
const SAY_BUBBLE = '#6E9FD8';
const TIP_BG = '#FFF5E2';
const TIP_ACCENT = '#E39B2D';

export const KeyStrategyScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'KeyStrategy'>>();
  const { t } = useTranslation();
  const { strategy, childName } = route.params;
  useScreenViewDuration('KeyStrategy', { strategy });

  const screen = SCREENS[strategy];
  const showDino = screen?.dino !== false;
  const base = `moduleReport.keyStrategyScreens.${strategy}`;
  const name = childName || t('moduleReport.keyStrategyScreens.yourChild');
  const sayLines = t(`${base}.say`, { returnObjects: true }) as unknown as string[];
  const sayOptions = t(`${base}.options`, { returnObjects: true }) as unknown as { label: string; text: string }[];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header: title + subtitle on the left, dino with a clock on the right */}
        <View style={styles.header}>
          <TrackedTouchable analyticsId="Back" onPress={() => navigation.goBack()} style={styles.backCircle}
            activeOpacity={0.7} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={20} color={INK} />
          </TrackedTouchable>
          {showDino && (
          <View style={styles.dinoWrap}>
            <Image source={DINO} style={styles.dino} resizeMode="contain" />
            {screen?.headerTimer ? (
              <View style={styles.stopwatch}><Text style={styles.stopwatchText}>{screen.headerTimer}</Text></View>
            ) : screen?.headerIcon ? (
              <MaterialCommunityIcons name={screen.headerIcon.name} size={50} color={screen.headerIcon.color} style={styles.clock} />
            ) : (
              <Ionicons name="time-outline" size={48} color={SAY_BUBBLE} style={styles.clock} />
            )}
          </View>
          )}
          {/* Text clears the dino; full width without it */}
          <Text style={[styles.title, showDino && styles.titleClear]}>{t(`${base}.title`)}</Text>
          <Text style={[styles.subtitle, showDino && styles.subtitleClear]}>{t(`${base}.subtitle`, { childName: name })}</Text>
        </View>

        {/* Picture with the step badge */}
        {screen?.image && (
          <View style={styles.pictureCard}>
            <View style={[styles.pictureWrap, { aspectRatio: screen.imageAspect }]}>
              <Image source={screen.image} style={styles.picture} resizeMode="cover" />
            </View>
            <View style={styles.stepBadge}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
              <Text style={styles.stepBadgeText}>{t(`${base}.badge`)}</Text>
              {screen.badgeIcon && <Ionicons name={screen.badgeIcon} size={20} color="#2F8F6B" />}
            </View>
          </View>
        )}

        {/* Why it works */}
        {/* Icon + title on one row, text below at full width */}
        <View style={[styles.card, styles.stackedCard, { backgroundColor: WHY_BG }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: WHY_ICON_BG }]}>
              <MaterialCommunityIcons name="brain" size={28} color={WHY_ACCENT} />
            </View>
            <Text style={[styles.cardTitle, styles.cardHeaderTitle]}>{t('moduleReport.keyStrategyLabels.why')}</Text>
          </View>
          <Text style={[styles.cardBody, styles.cardBodyFull]}>{t(`${base}.why`, { childName: name })}</Text>
        </View>

        {/* What to say */}
        <View style={[styles.card, styles.sayCard]}>
          <View style={styles.sayHeader}>
            <View style={[styles.cardIcon, { backgroundColor: SAY_ACCENT }]}>
              <Ionicons name="chatbubble-ellipses" size={24} color="#FFFFFF" />
            </View>
            <Text style={[styles.cardTitle, styles.sayTitle]}>{t('moduleReport.keyStrategyLabels.whatToSay')}</Text>
          </View>
          {screen?.sayOptions ? (
            <>
              <Text style={styles.sayIntro}>{t(`${base}.sayIntro`)}</Text>
              {Array.isArray(sayOptions) && sayOptions.map((option, i) => {
                const optionStyle = screen.sayOptions![i % screen.sayOptions!.length];
                return (
                  <View key={i} style={styles.sayOption}>
                    <View style={[styles.sayOptionIcon, { backgroundColor: optionStyle.bg }]}>
                      <MaterialCommunityIcons name={optionStyle.icon} size={22} color={optionStyle.color} />
                    </View>
                    <View style={styles.sayOptionContent}>
                      <Text style={[styles.sayOptionLabel, { color: optionStyle.labelColor ?? optionStyle.color }]}>{option.label}</Text>
                      <Text style={styles.sayOptionText}>{`\u201C${option.text}\u201D`}</Text>
                    </View>
                  </View>
                );
              })}
            </>
          ) : (
            <View style={styles.sayBox}>
              {Array.isArray(sayLines) && sayLines.map((line, i) => (
                <View key={i} style={styles.sayLine}>
                  <Ionicons name="chatbubble-ellipses" size={20} color={SAY_BUBBLE} style={styles.sayLineIcon} />
                  <Text style={styles.sayText}>{`\u201C${line}\u201D`}</Text>
                </View>
              ))}
            </View>
          )}
          {screen?.footer === 'tip' ? (
            <View style={styles.tip}>
              <Ionicons name="bulb-outline" size={22} color={TIP_ACCENT} />
              <Text style={styles.tipText}>
                <Text style={styles.tipLabel}>{`${t('moduleReport.keyStrategyLabels.noraTip')}  `}</Text>
                {t(`${base}.tip`, { childName: name })}
              </Text>
            </View>
          ) : (
            <View style={styles.pauseRow}>
              <View style={styles.pauseIcon}><Ionicons name="pause" size={14} color="#FFFFFF" /></View>
              <Text style={styles.pauseText}>{t(`${base}.pause`)}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: { backgroundColor: BG, paddingBottom: 32, flexGrow: 1 },

  // ── Header ──
  header: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 6, overflow: 'hidden' },
  backCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  dinoWrap: { position: 'absolute', right: 6, top: 28 },
  dino: { width: DINO_WIDTH, height: DINO_WIDTH * DINO_ASPECT },
  clock: { position: 'absolute', right: -2, top: -14 },
  stopwatch: {
    position: 'absolute', right: -6, top: -12, width: 62, height: 62, borderRadius: 31,
    borderWidth: 4, borderColor: '#7FA7D8', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
  },
  stopwatchText: { fontFamily: FONTS.bold, fontSize: 14, color: '#1F3A5F' },
  title: { fontFamily: FONTS.bold, fontSize: 26, lineHeight: 31, letterSpacing: -0.4, color: INK },
  titleClear: { paddingRight: DINO_WIDTH - 24 },
  subtitle: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 22, color: MUTED, marginTop: 10 },
  subtitleClear: { paddingRight: DINO_WIDTH - 40 },

  // ── Picture ──
  pictureCard: { backgroundColor: PICTURE_CARD, borderRadius: 24, padding: 10, marginHorizontal: 16, marginTop: 16 },
  pictureWrap: { width: '100%', borderRadius: 18, overflow: 'hidden' },
  picture: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  stepBadge: {
    position: 'absolute', top: 20, right: 20, maxWidth: '58%',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 999, paddingVertical: 6, paddingLeft: 6, paddingRight: 14,
  },
  stepNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: BADGE_BG, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontFamily: FONTS.bold, fontSize: 15, color: INK },
  stepBadgeText: { flexShrink: 1, fontFamily: FONTS.bold, fontSize: 13, lineHeight: 17, color: INK },

  // ── Cards ──
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderRadius: 24, padding: 18, marginHorizontal: 16, marginTop: 14 },
  cardIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1 },
  stackedCard: { flexDirection: 'column', alignItems: 'stretch' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardHeaderTitle: { flex: 1 },
  cardBodyFull: { marginTop: 12 },
  cardTitle: { fontFamily: FONTS.bold, fontSize: 22, lineHeight: 28, color: INK },
  cardBody: { fontFamily: FONTS.regular, fontSize: 16, lineHeight: 24, color: MUTED, marginTop: 6 },

  sayCard: { flexDirection: 'column', alignItems: 'stretch', backgroundColor: SAY_BG },
  sayHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sayTitle: { flex: 1 },
  sayBox: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingVertical: 8, paddingHorizontal: 14, marginTop: 14 },
  sayLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8 },
  sayLineIcon: { marginTop: 2 },
  sayText: { flex: 1, fontFamily: FONTS.regular, fontSize: 17, lineHeight: 24, color: '#1F2937' },
  sayIntro: { fontFamily: FONTS.regular, fontSize: 15, lineHeight: 21, color: MUTED, marginTop: 10, marginBottom: 2 },
  sayOption: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginTop: 10 },
  sayOptionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sayOptionContent: { flex: 1 },
  sayOptionLabel: { fontFamily: FONTS.bold, fontSize: 14, lineHeight: 19 },
  sayOptionText: { fontFamily: FONTS.regular, fontSize: 16, lineHeight: 22, color: '#1F2937', marginTop: 2 },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: TIP_BG, borderRadius: 16, padding: 12, marginTop: 14 },
  tipText: { flex: 1, fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: MUTED, marginTop: 1 },
  tipLabel: { fontFamily: FONTS.bold, color: TIP_ACCENT },
  pauseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 14, paddingHorizontal: 4 },
  pauseIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: SAY_ACCENT, alignItems: 'center', justifyContent: 'center' },
  pauseText: { flex: 1, fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: MUTED, marginTop: 2 },
});
