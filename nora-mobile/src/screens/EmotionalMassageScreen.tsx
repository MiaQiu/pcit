/**
 * EmotionalMassageScreen
 * Multi-card carousel about emotional connection & parenting
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import amplitudeService from '../services/amplitudeService';
import Svg, {
  Path,
  Circle,
  Line,
  G,
  Rect,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 390);
const SVG_SIZE = CARD_WIDTH - 56; // card has 28px horizontal padding each side

const TOTAL_CARDS = 11;

// ─── Main Screen ──────────────────────────────────────────────────────────────

export const EmotionalMassageScreen: React.FC = () => {
  const [currentCard, setCurrentCard] = useState(0);
  const bounceY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    amplitudeService.trackScreenView('Emotional Massage');
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounceY, { toValue: -120, duration: 500, useNativeDriver: true }),
        Animated.timing(bounceY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ).start();
  }, [bounceY]);

  const goNext = () => {
    const next = Math.min(currentCard + 1, TOTAL_CARDS - 1);
    amplitudeService.trackEvent('Emotional Massage Card Viewed', { card: next });
    setCurrentCard(next);
  };
  const goPrev = () => {
    const prev = Math.max(currentCard - 1, 0);
    amplitudeService.trackEvent('Emotional Massage Card Viewed', { card: prev });
    setCurrentCard(prev);
  };

  return (
    <SafeAreaView style={sh.safeArea}>
      <ScrollView contentContainerStyle={sh.scrollContent} showsVerticalScrollIndicator={false}>
        {currentCard === 0 && <Card0 bounceY={bounceY} />}
        {currentCard === 1 && <Card1 />}
        {currentCard === 2 && <Card2 />}
        {currentCard === 3 && <Card3 />}
        {currentCard === 4 && <Card4 />}
        {currentCard === 5 && <Card5 />}
        {currentCard === 6 && <Card6 />}
        {currentCard === 7 && <Card7 />}
        {currentCard === 8 && <Card8 />}
        {currentCard === 9 && <Card9 />}
        {currentCard === 10 && <Card10 />}

        {/* Navigation row */}
        <View style={sh.navRow}>
          <TouchableOpacity
            onPress={goPrev}
            disabled={currentCard === 0}
            style={[sh.navArrow, currentCard === 0 && sh.navArrowDisabled]}
          >
            <Ionicons name="chevron-back" size={22} color={currentCard === 0 ? '#CCC' : '#1A1A1A'} />
          </TouchableOpacity>

          <View style={sh.dotsRow}>
            {Array.from({ length: TOTAL_CARDS }).map((_, i) => (
              <TouchableOpacity key={i} onPress={() => setCurrentCard(i)}>
                <View style={[sh.navDot, i === currentCard && sh.navDotActive]} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={goNext}
            disabled={currentCard === TOTAL_CARDS - 1}
            style={[sh.navArrow, currentCard === TOTAL_CARDS - 1 && sh.navArrowDisabled]}
          >
            <Ionicons name="chevron-forward" size={22} color={currentCard === TOTAL_CARDS - 1 ? '#CCC' : '#1A1A1A'} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ─── Card 0: 5-Minute Emotional Massage ──────────────────────────────────────

interface Card0Props { bounceY: Animated.Value; }

const Card0: React.FC<Card0Props> = ({ bounceY }) => (
  <View style={c0.card}>
    <View style={c0.blobTopRight} />
    <View style={c0.blobBottomLeft} />

    <View style={c0.content}>
      <View style={c0.headerBlock}>
        <Text style={c0.title}>
          The simple deposit:{'\n'}
          <Text style={c0.titleSub}>5-minute emotional massage</Text>
        </Text>
        <Text style={c0.lead}>
          Your daily 5-minute emotional massage is a{' '}
          <Text style={c0.bold}>powerful emotional deposit.</Text>
        </Text>
      </View>

      <View style={c0.listBlock}>
        <Text style={c0.whenLabel}>When you:</Text>
        {["follow your child's lead", 'give full attention', "don't teach or correct"].map((item, i) => (
          <View key={i} style={c0.listItem}>
            <View style={c0.bullet} />
            <Text style={c0.listItemText}>{item}</Text>
          </View>
        ))}
      </View>

      <View style={c0.footerBlock}>
        <Text style={c0.footerText}>
          You are adding directly to their{' '}
          <Text style={c0.bold}>emotional account.</Text> Even a few minutes can help:
        </Text>
      </View>
    </View>

    <View style={c0.illustrationContainer}>
      <Animated.View
        style={[c0.heartOverlay, { transform: [{ translateY: bounceY }] }]}
        pointerEvents="none"
      >
        <Svg viewBox="0 0 60 65" width={40} height={43}>
          <Path d="M30 10 Q37 0 44 10 Q52 22 30 45 Q8 22 16 10 Q23 0 30 10" fill="#D95D39" />
        </Svg>
      </Animated.View>

      <Svg viewBox="0 0 400 400" width={SVG_SIZE} height={SVG_SIZE}>
        <Path d="M50 350 Q200 330 350 350" fill="none" stroke="#1A1A1A" strokeWidth="1" opacity="0.1" strokeDasharray="10,5" />
        <G transform="translate(100, 180)">
          <Circle cx="100" cy="120" r="70" fill="#FF8D7E" opacity={0.9} />
          <G opacity={0.3} stroke="white" strokeWidth="4" strokeLinecap="round">
            <Line x1="80" y1="100" x2="100" y2="90" />
            <Line x1="85" y1="115" x2="105" y2="105" />
            <Line x1="90" y1="130" x2="110" y2="120" />
          </G>
          <Path d="M160 50 Q220 50 220 120 Q220 190 150 190" fill="none" stroke="#FF8D7E" strokeWidth="24" strokeLinecap="round" />
          <G transform="translate(85, 110)">
            <Path d="M0 0 Q5 5 10 0" fill="none" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
            <Path d="M20 0 Q25 5 30 0" fill="none" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
            <Path d="M10 15 Q15 22 20 15" fill="none" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          </G>
        </G>
        <Circle cx="320" cy="100" r="15" fill="#F8D7D0" />
        <Circle cx="60" cy="320" r="10" fill="#F8D7D0" opacity={0.6} />
      </Svg>
    </View>
  </View>
);

// ─── Card 1: Tantrums ─────────────────────────────────────────────────────────

const Card1: React.FC = () => (
  <View style={c1.card}>
    {/* Hand with bottle — absolute top-right, overflows and gets clipped */}
    <View style={c1.bottleWrap} pointerEvents="none">
      <Svg viewBox="0 0 200 300" width={200} height={300}>
        <Path d="M0 100 Q40 0 100 20 Q140 40 120 120 L130 250 Q100 280 60 250 Z" fill="#E0AC69" />
        <G transform="translate(60, 40) rotate(15)">
          <Rect x="0" y="20" width="50" height="100" rx="15" fill="white" stroke="#A5C9E1" strokeWidth="4" />
          <Path d="M5 40 Q25 35 45 40" stroke="#A5C9E1" strokeWidth="2" fill="none" />
          <Path d="M10 10 L40 10 L35 -10 L15 -10 Z" fill="#F9C7A1" />
        </G>
      </Svg>
    </View>

    {/* Text bullets */}
    <View style={c1.content}>
      <View style={c1.bulletRow}>
        <View style={c1.redDot} />
        <Text style={c1.bulletText}>
          Tantrums are <Text style={c1.boldUpper}>not bad behavior</Text>. They are{' '}
          <Text style={[c1.boldUpper, { color: '#DC2626' }]}>overloaded emotions</Text>{' '}
          in a small brain.
        </Text>
      </View>

      <View style={c1.bulletRow}>
        <View style={c1.redDot} />
        <Text style={c1.bulletText}>
          Kids don't behave badly when they <Text style={c1.boldUpper}>feel good</Text>. They
          struggle when they feel <Text style={c1.boldUpper}>overwhelmed, unseen</Text>, or{' '}
          <Text style={c1.boldUpper}>unable to cope</Text>.
        </Text>
      </View>
    </View>

    {/* Teddy bear — bottom, overflows down and gets clipped */}
    <View style={c1.teddyWrap} pointerEvents="none">
      <Svg viewBox="0 0 300 300" width={CARD_WIDTH} height={240}>
        <G transform="translate(100, 50)">
          <Circle cx="50" cy="50" r="45" fill="#B08D82" />
          <Circle cx="20" cy="20" r="15" fill="#B08D82" />
          <Circle cx="80" cy="20" r="15" fill="#B08D82" />
          <Circle cx="50" cy="110" r="55" fill="#B08D82" />
          <Circle cx="50" cy="60" r="15" fill="#FDF4D0" opacity={0.4} />
          <Path d="M45 60 L50 65 L55 60" fill="none" stroke="#4B2C20" strokeWidth="2" />
        </G>
        <Path d="M150 300 Q180 200 280 250 L300 300 Z" fill="#4B2C20" opacity={0.9} />
        <Path d="M220 230 Q250 210 280 250" fill="none" stroke="#E0AC69" strokeWidth="30" strokeLinecap="round" />
      </Svg>
    </View>
  </View>
);

// ─── Card 2: What to Do Now ───────────────────────────────────────────────────

const Card2: React.FC = () => (
  <View style={c2.card}>
    <View style={c2.content}>
      <View style={c2.headerBlock}>
        <Text style={c2.eyebrow}>The Path Forward</Text>
        <Text style={c2.title}>What to{'\n'}Do Now</Text>
      </View>

      <Text style={c2.lead}>
        The fastest way to help your child is{' '}
        <Text style={c2.notText}>not</Text> to explain more.
      </Text>

      <View style={c2.connectBox}>
        <Text style={c2.connectText}>It's to connect first.</Text>
      </View>
    </View>

    <View style={c2.svgWrap}>
      <Svg viewBox="0 0 400 300" width={SVG_SIZE} height={SVG_SIZE * 0.75}>
        <Defs>
          <LinearGradient id="bridgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#818CF8" />
            <Stop offset="100%" stopColor="#C084FC" />
          </LinearGradient>
        </Defs>
        <Circle cx="80" cy="220" r="50" fill="#1E1B4B" opacity={0.05} />
        <Circle cx="320" cy="180" r="40" fill="#1E1B4B" opacity={0.05} />
        <Path
          d="M80 220 Q200 100 320 180"
          fill="none"
          stroke="url(#bridgeGrad)"
          strokeWidth="8"
          strokeDasharray="1,15"
          strokeLinecap="round"
        />
        <Path
          d="M80 200 Q90 180 100 200 Q110 220 80 240 Q50 220 60 200 Q70 180 80 200"
          fill="#818CF8"
        />
        <G transform="translate(300, 150)">
          <Circle cx="20" cy="0" r="15" fill="#C084FC" />
          <Path d="M0 30 Q20 10 40 30" fill="none" stroke="#C084FC" strokeWidth="5" strokeLinecap="round" />
        </G>
      </Svg>
    </View>
  </View>
);

// ─── Card 3: The Practice ─────────────────────────────────────────────────────

const Card3: React.FC = () => (
  <View style={c3.card}>
    <View style={c3.blobTopRight} />

    <View style={c3.content}>
      <Text style={c3.title}>
        Try this today during your 5 mins Emotional Massage:
      </Text>

      {[
        'Follow their lead',
        "Don't teach or correct",
        'Just describe what they do',
        'Be fully present.',
      ].map((text, i) => (
        <View key={i} style={c3.listItem}>
          <View style={c3.bullet} />
          <Text style={c3.listItemText}>{text}</Text>
        </View>
      ))}
    </View>

    <View style={c3.svgWrap}>
      <Svg viewBox="0 0 400 300" width={SVG_SIZE} height={SVG_SIZE * 0.6}>
        <G transform="translate(150, 200)">
          <Rect x="0" y="30" width="40" height="40" fill="white" opacity={0.9} rx="4" />
          <Rect x="45" y="10" width="30" height="60" fill="white" opacity={0.7} rx="4" />
          <Circle cx="20" cy="10" r="15" fill="white" opacity={0.5} />
        </G>
        <G transform="translate(200, 100)">
          <Path d="M-80 0 Q0 -60 80 0 Q0 60 -80 0" fill="none" stroke="white" strokeWidth="2" opacity={0.3} />
          <Circle cx="0" cy="0" r="30" fill="none" stroke="white" strokeWidth="4" />
          <Circle cx="0" cy="0" r="12" fill="white" />
          <Line x1="0" y1="40" x2="0" y2="80" stroke="white" strokeWidth="2" strokeDasharray="4,4" opacity={0.6} />
        </G>
      </Svg>
    </View>
  </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────

/** Shared screen / navigation styles */
const sh = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F3F0',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 20,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: CARD_WIDTH,
    paddingHorizontal: 4,
  },
  navArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  navArrowDisabled: {
    backgroundColor: '#F0F0F0',
    shadowOpacity: 0,
    elevation: 0,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  navDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D0D0',
  },
  navDotActive: {
    width: 20,
    backgroundColor: '#1A1A1A',
  },
});

/** Card 0 */
const c0 = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#F2E7DC',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  blobTopRight: {
    position: 'absolute',
    top: -40,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#F8D7D0',
    opacity: 0.5,
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: 100,
    left: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#F8D7D0',
    opacity: 0.35,
  },
  content: { gap: 24 },
  headerBlock: { gap: 14 },
  title: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#1A1A1A',
    textTransform: 'uppercase',
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  titleSub: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_700Bold',
    opacity: 0.8,
  },
  lead: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#1A1A1A',
    lineHeight: 24,
  },
  bold: { fontFamily: 'PlusJakartaSans_700Bold' },
  listBlock: { gap: 12 },
  whenLabel: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1A1A1A',
    opacity: 0.7,
    fontStyle: 'italic',
  },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D95D39',
    flexShrink: 0,
  },
  listItemText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#1A1A1A',
  },
  footerBlock: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(26,26,26,0.08)',
    paddingTop: 16,
  },
  footerText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#1A1A1A',
    lineHeight: 23,
  },
  illustrationContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  heartOverlay: {
    position: 'absolute',
    left: SVG_SIZE * 0.68,
    top: SVG_SIZE * 0.38,
    zIndex: 10,
  },
});

/** Card 1 */
const c1 = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FEF9D7',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingTop: 190,
    paddingBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  bottleWrap: {
    position: 'absolute',
    top: -16,
    right: -40,
    zIndex: 0,
  },
  content: {
    gap: 28,
    zIndex: 1,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  redDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#DC2626',
    marginTop: 5,
    flexShrink: 0,
  },
  bulletText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#1A1A1A',
    lineHeight: 26,
    flex: 1,
  },
  boldUpper: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textTransform: 'uppercase',
  },
  teddyWrap: {
    marginTop: 24,
    marginLeft: -28,
    marginBottom: -48,
  },
});

/** Card 2 */
const c2 = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#E0E7FF',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  content: { gap: 20 },
  headerBlock: { gap: 4 },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#6366F1',
  },
  title: {
    fontSize: 38,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textTransform: 'uppercase',
    lineHeight: 42,
    color: '#1E1B4B',
  },
  lead: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1E1B4B',
    lineHeight: 30,
  },
  notText: {
    color: '#4F46E5',
  },
  connectBox: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    padding: 28,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'white',
  },
  connectText: {
    fontSize: 26,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#4338CA',
  },
  svgWrap: {
    alignItems: 'center',
    marginTop: 8,
  },
});

/** Card 3 */
const c3 = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#F97316',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  blobTopRight: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#FBBF24',
    opacity: 0.3,
  },
  content: { gap: 14 },
  title: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: 'white',
    lineHeight: 32,
    marginBottom: 6,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(0,0,0,0.1)',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FDE047',
    flexShrink: 0,
  },
  listItemText: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'white',
  },
  svgWrap: {
    alignItems: 'center',
    marginTop: 20,
  },
});

// ─── Card 4: Brain Lighthouse ─────────────────────────────────────────────────

const Card4: React.FC = () => (
  <View style={c4.card}>
    <View style={c4.blobTopRight} />
    <View style={c4.content}>
      <View style={c4.headerBlock}>
        <Text style={c4.eyebrow}>Phase: Meltdown</Text>
        <Text style={c4.title}>During a{'\n'}tantrum</Text>
      </View>
      <Text style={c4.lead}>
        Your goal is <Text style={c4.notText}>not</Text> to fix behavior.
      </Text>
      <View style={c4.box}>
        <Text style={c4.boxText}>Help their brain come back online.</Text>
      </View>
    </View>
    <View style={c4.svgWrap}>
      <Svg viewBox="0 0 400 260" width={SVG_SIZE} height={SVG_SIZE * 0.6}>
        <Path d="M80 240 Q200 220 320 240 L300 254 Q200 260 100 254 Z" fill="#204E59" opacity={0.08} />
        <G transform="translate(160, 30)">
          <Rect x="30" y="60" width="36" height="110" fill="#4DA1B0" opacity={0.3} rx="5" />
          <Path d="M20 60 L76 60 L48 28 Z" fill="#204E59" opacity={0.22} />
          <Path d="M48 44 L-80 -10 L180 -10 Z" fill="white" opacity={0.22} />
          <Circle cx="48" cy="44" r="13" fill="white" opacity={0.65} />
          <Circle cx="48" cy="44" r="6" fill="#4DA1B0" opacity={0.7} />
        </G>
      </Svg>
    </View>
  </View>
);

const c4 = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#E0F2F7',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  blobTopRight: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'white',
    opacity: 0.4,
  },
  content: { gap: 20 },
  headerBlock: { gap: 6 },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 3,
    color: '#4DA1B0',
  },
  title: {
    fontSize: 38,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textTransform: 'uppercase',
    lineHeight: 42,
    color: '#204E59',
  },
  lead: {
    fontSize: 20,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#204E59',
    lineHeight: 28,
  },
  notText: {
    color: '#D95D39',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  box: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    padding: 22,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'white',
  },
  boxText: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontStyle: 'italic',
    color: '#204E59',
    lineHeight: 30,
  },
  svgWrap: { alignItems: 'center', marginTop: 8 },
});

// ─── Card 5: Storm Castle ─────────────────────────────────────────────────────

const Card5: React.FC = () => (
  <View style={c5.card}>
    <View style={c5.content}>
      <Text style={c5.title}>What's{'\n'}happening</Text>
      <Text style={c5.lead}>
        The thinking brain is <Text style={c5.redText}>"offline"</Text>
      </Text>
      {["they can't listen", "they can't learn", "they can't reason"].map((item, i) => (
        <View key={i} style={c5.stormItem}>
          <Text style={c5.stormEmoji}>⛈️</Text>
          <Text style={c5.stormText}>{item}</Text>
        </View>
      ))}
    </View>
    <View style={c5.svgWrap}>
      <Svg viewBox="0 0 400 220" width={SVG_SIZE} height={SVG_SIZE * 0.5}>
        <G transform="translate(110, 10)">
          <Path
            d="M30 90 Q10 90 8 70 Q6 50 28 48 Q32 28 58 25 Q82 5 108 24 Q128 24 130 46 Q150 48 150 70 Q150 90 128 90 Z"
            fill="#4338CA" opacity={0.12}
          />
          <Path d="M65 90 L46 138 L65 138 L46 186" fill="none" stroke="#EF4444" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity={0.55} />
          <Path d="M95 90 L80 128 L95 128 L80 166" fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity={0.35} />
        </G>
      </Svg>
    </View>
  </View>
);

const c5 = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#F5F3FF',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  content: { gap: 14 },
  title: {
    fontSize: 38,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textTransform: 'uppercase',
    lineHeight: 42,
    color: '#4338CA',
  },
  lead: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#4338CA',
    lineHeight: 28,
  },
  redText: { color: '#EF4444' },
  stormItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'white',
  },
  stormEmoji: { fontSize: 20 },
  stormText: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#4338CA',
    opacity: 0.8,
  },
  svgWrap: { alignItems: 'center', marginTop: 8 },
});

// ─── Card 6: Common Mistake ───────────────────────────────────────────────────

const Card6: React.FC = () => (
  <View style={c6.card}>
    <View style={c6.content}>
      <Text style={c6.title}>Common{'\n'}mistake</Text>
      {['"Stop crying."', '"Calm down."', '"Use your words."'].map((item, i) => (
        <View key={i} style={c6.quoteBox}>
          <Text style={c6.quoteText}>{item}</Text>
        </View>
      ))}
      <Text style={c6.footnote}>
        👉 These require a child who is{' '}
        <Text style={c6.calmText}>already calm</Text>.
      </Text>
    </View>
  </View>
);

const c6 = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFF1F0',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  content: { gap: 16 },
  title: {
    fontSize: 38,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textTransform: 'uppercase',
    lineHeight: 42,
    color: '#991B1B',
  },
  quoteBox: {
    backgroundColor: 'rgba(255,255,255,0.45)',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'white',
    alignItems: 'center',
  },
  quoteText: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontStyle: 'italic',
    color: '#991B1B',
    textAlign: 'center',
  },
  footnote: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#991B1B',
    lineHeight: 26,
    marginTop: 8,
  },
  calmText: {
    color: '#F59E0B',
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});

// ─── Card 7: Nebula Hug ───────────────────────────────────────────────────────

const Card7: React.FC = () => (
  <View style={c7.card}>
    <View style={c7.content}>
      <Text style={c7.title}>What helps</Text>
      <Text style={c7.eyebrow}>The art of co-regulation:</Text>
      {['stay close', 'stay calm', 'steady words'].map((item, i) => (
        <View key={i} style={c7.listItem}>
          <View style={c7.bullet} />
          <Text style={c7.listItemText}>{item}</Text>
        </View>
      ))}
      <View style={c7.quoteBox}>
        <Text style={c7.quoteText}>"I'm here. You're safe."</Text>
      </View>
    </View>
    <View style={c7.svgWrap}>
      <Svg viewBox="0 0 400 240" width={SVG_SIZE} height={SVG_SIZE * 0.52}>
        <Circle cx="200" cy="120" r="110" fill="#BBF7D0" opacity={0.2} />
        <G transform="translate(130, 60)">
          <Path d="M0 120 Q40 20 100 40 Q120 55 120 120 L120 190 Q60 205 0 190 Z" fill="#166534" opacity={0.07} />
          <G transform="translate(30, 55)">
            <Path d="M0 50 Q22 10 66 18 Q84 28 84 70 L84 130 Q42 138 0 130 Z" fill="#166534" opacity={0.13} />
            <Path d="M-8 68 Q24 86 56 66" fill="none" stroke="#166534" strokeWidth="7" strokeLinecap="round" opacity={0.25} />
          </G>
          <Circle cx="60" cy="88" r="4" fill="#166534" opacity={0.4} />
          <Circle cx="100" cy="128" r="2.5" fill="#166534" opacity={0.3} />
        </G>
      </Svg>
    </View>
  </View>
);

const c7 = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#F0FDF4',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  content: { gap: 12 },
  title: {
    fontSize: 38,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textTransform: 'uppercase',
    lineHeight: 42,
    color: '#166534',
    marginBottom: 2,
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#166534',
    opacity: 0.5,
    marginBottom: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(187,247,208,0.3)',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  bullet: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#166534',
    opacity: 0.3,
    flexShrink: 0,
  },
  listItemText: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
    textTransform: 'uppercase',
    color: '#166534',
  },
  quoteBox: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    padding: 18,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'white',
    marginTop: 4,
  },
  quoteText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontStyle: 'italic',
    textAlign: 'center',
    color: '#166534',
  },
  svgWrap: { alignItems: 'center', marginTop: 8 },
});

// ─── Card 8: Key Shift ────────────────────────────────────────────────────────

const Card8: React.FC = () => (
  <View style={c8.card}>
    <View style={c8.content}>
      <View style={c8.headerBlock}>
        <Text style={c8.title}>Key shift</Text>
        <View style={c8.titleBar} />
      </View>
      <View style={c8.cardsBlock}>
        <View style={[c8.shiftCard, c8.shiftCardPrimary]}>
          <Text style={c8.shiftTextPrimary}>1. Connection first.</Text>
        </View>
        <View style={[c8.shiftCard, c8.shiftCardSecondary]}>
          <Text style={c8.shiftTextSecondary}>2. Correction later.</Text>
        </View>
      </View>
    </View>
    <View style={c8.svgWrap}>
      <Svg viewBox="0 0 400 180" width={SVG_SIZE} height={SVG_SIZE * 0.4}>
        <Path d="M200 160 Q110 100 110 64 Q110 24 200 24 Q290 24 290 64 Q290 100 200 160" fill="#D95D39" opacity={0.07} />
        <G transform="translate(158, 48)">
          <Path d="M42 0 Q84 36 84 116 L0 116 Q0 36 42 0" fill="#92400E" opacity={0.1} />
          <Circle cx="42" cy="14" r="22" fill="#92400E" opacity={0.07} />
        </G>
      </Svg>
    </View>
  </View>
);

const c8 = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFBEB',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  content: { gap: 32 },
  headerBlock: { gap: 8 },
  title: {
    fontSize: 48,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textTransform: 'uppercase',
    lineHeight: 50,
    letterSpacing: -1,
    color: '#92400E',
  },
  titleBar: {
    width: 64,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#92400E',
  },
  cardsBlock: { gap: 16 },
  shiftCard: { padding: 22, borderRadius: 32 },
  shiftCardPrimary: {
    backgroundColor: '#D95D39',
    transform: [{ rotate: '-2deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  shiftCardSecondary: {
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(146,64,14,0.2)',
    transform: [{ rotate: '1deg' }],
  },
  shiftTextPrimary: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontStyle: 'italic',
    color: 'white',
  },
  shiftTextSecondary: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontStyle: 'italic',
    color: '#92400E',
    opacity: 0.5,
  },
  svgWrap: { alignItems: 'center', marginTop: 8 },
});

// ─── Card 9: Stairway to Calm ─────────────────────────────────────────────────

const Card9: React.FC = () => (
  <View style={c9.card}>
    <View style={c9.content}>
      <Text style={c9.title}>What to expect</Text>
      <Text style={c9.subtitle}>Recovery is a gradual climb.</Text>
      {['meltdowns get shorter', 'recovery gets faster'].map((item, i) => (
        <View key={i} style={c9.listItem}>
          <Text style={c9.star}>✨</Text>
          <Text style={c9.listItemText}>{item}</Text>
        </View>
      ))}
      <View style={c9.box}>
        <Text style={c9.boxText}>
          Cooperation improves{'\n'}AFTER connection.
        </Text>
      </View>
    </View>
    <View style={c9.svgWrap}>
      <Svg viewBox="0 0 400 240" width={SVG_SIZE} height={SVG_SIZE * 0.52}>
        <G transform="translate(30, 220)">
          <Rect x="0" y="-20" width="60" height="20" fill="#C2410C" opacity={0.1} rx="3" />
          <Rect x="60" y="-50" width="60" height="20" fill="#C2410C" opacity={0.18} rx="3" />
          <Rect x="120" y="-80" width="60" height="20" fill="#C2410C" opacity={0.26} rx="3" />
          <Rect x="180" y="-110" width="60" height="20" fill="#C2410C" opacity={0.34} rx="3" />
          <Rect x="240" y="-140" width="60" height="20" fill="#C2410C" opacity={0.42} rx="3" />
          <Circle cx="300" cy="-160" r="18" fill="white" opacity={0.5} />
          <Circle cx="300" cy="-160" r="10" fill="#C2410C" opacity={0.2} />
        </G>
      </Svg>
    </View>
  </View>
);

const c9 = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFF7ED',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  content: { gap: 14 },
  title: {
    fontSize: 38,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textTransform: 'uppercase',
    lineHeight: 42,
    color: '#C2410C',
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_700Bold',
    fontStyle: 'italic',
    color: '#C2410C',
    opacity: 0.65,
  },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  star: { fontSize: 22 },
  listItemText: {
    fontSize: 18,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#C2410C',
  },
  box: {
    backgroundColor: '#C2410C',
    padding: 20,
    borderRadius: 24,
    marginTop: 6,
  },
  boxText: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: 'white',
    lineHeight: 24,
  },
  svgWrap: { alignItems: 'center', marginTop: 8 },
});

// ─── Card 10: Mindful Mirror ──────────────────────────────────────────────────

const Card10: React.FC = () => (
  <View style={c10.card}>
    <View style={c10.content}>
      <Text style={c10.title}>Try this next</Text>
      <View style={c10.reflectBlock}>
        <Text style={c10.reflectLabel}>Pause and reflect:</Text>
        <View style={c10.reflectBox}>
          <Text style={c10.reflectText}>
            "Am I trying to teach, or help them calm?"
          </Text>
        </View>
      </View>
      <Text style={c10.presence}>
        Presence is the most powerful tool you own.
      </Text>
    </View>
    <View style={c10.svgWrap}>
      <Svg viewBox="0 0 400 220" width={SVG_SIZE} height={SVG_SIZE * 0.48}>
        <Circle cx="200" cy="110" r="90" fill="#99F6E4" opacity={0.12} />
        <G transform="translate(162, 70)">
          <Path d="M0 80 Q20 24 40 80" fill="#0F766E" opacity={0.15} />
          <Circle cx="20" cy="28" r="14" fill="#0F766E" opacity={0.1} />
          <Path d="M8 52 Q28 68 48 52" fill="none" stroke="#0F766E" strokeWidth="4" strokeLinecap="round" opacity={0.18} />
        </G>
        <Circle cx="320" cy="50" r="12" fill="#99F6E4" opacity={0.3} />
        <Circle cx="70" cy="170" r="8" fill="#99F6E4" opacity={0.25} />
      </Svg>
    </View>
  </View>
);

const c10 = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#F0FDFA',
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  content: { gap: 24 },
  title: {
    fontSize: 38,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textTransform: 'uppercase',
    lineHeight: 42,
    color: '#0F766E',
  },
  reflectBlock: { gap: 10 },
  reflectLabel: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: '#0F766E',
    opacity: 0.4,
  },
  reflectBox: {
    backgroundColor: 'white',
    padding: 28,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#99F6E4',
  },
  reflectText: {
    fontSize: 22,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 30,
    color: '#0F766E',
  },
  presence: {
    fontSize: 19,
    fontFamily: 'PlusJakartaSans_700Bold',
    textAlign: 'center',
    color: '#0F766E',
    opacity: 0.65,
    lineHeight: 26,
  },
  svgWrap: { alignItems: 'center', marginTop: 4 },
});
