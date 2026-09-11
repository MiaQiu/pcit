/**
 * Level Up Modal
 * Duolingo-style full-screen celebration shown when a session's analysis
 * pushes the parent's skill level up (e.g. Level 1 -> Level 2). Detection of
 * "did this just happen" lives in the caller (ReportScreen_v2) — this
 * component only plays the animation for a given from/to level pair.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { FONTS, COLORS, SOUNDS } from '../constants/assets';
import { PARENT_SKILL_LEVEL_ICONS } from '../constants/parentSkillLevels';
import { useAnticipationBuzz } from '../hooks/useAnticipationBuzz';
import type { ParentSkillLevel } from '@nora/core';

const CONFETTI_COLORS = [COLORS.mainPurple, COLORS.tealAccent, '#CBA76A', COLORS.ellipseOrange, COLORS.ellipseCyan, COLORS.cardOrange];
const CONFETTI_COUNT = 16;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// How long the coin spins for.
const SPIN_DURATION_MS = 2600;

// Buzz starts a beat after the spin begins (avoids a jarring simultaneous
// snap at t=0) but is timed to stop exactly when the coin stops spinning.
const BUZZ_START_DELAY_MS = 140;
const BUZZ_DURATION_MS = SPIN_DURATION_MS - BUZZ_START_DELAY_MS;

// The coin "spins" via scaleX oscillation (1 -> 0 -> -1 -> 0 -> 1 per flip),
// not a real 3D rotateY+perspective transform — that combination rendered
// with a hard flat clipped edge instead of a smooth foreshortened ellipse on
// device (a known-flaky pairing under the native driver), and looked like
// content sliding rather than spinning. scaleX is a plain 2D transform with
// no perspective math, so it renders predictably everywhere; the same
// left-right squash-through-zero read as a coin flip long before 3D CSS
// transforms existed. Precomputed as a dense cosine-sampled curve (not just
// [1,-1,1] per flip) so `interpolate` has enough points to stay smooth
// through each zero-crossing rather than linearly cutting corners across it.
const FLIP_COUNT = 4;
const FLIP_SAMPLES_PER_TURN = 24;
const FLIP_INPUT_RANGE = Array.from(
  { length: FLIP_COUNT * FLIP_SAMPLES_PER_TURN + 1 },
  (_, i) => i / (FLIP_COUNT * FLIP_SAMPLES_PER_TURN)
);
const FLIP_OUTPUT_RANGE = FLIP_INPUT_RANGE.map((t) => Math.cos(2 * Math.PI * FLIP_COUNT * t));

// Fixed spots around the badge for the twinkle sparkles that flash when the
// new level lands.
const SPARKLE_POSITIONS = [
  { top: -4, right: 6 },
  { bottom: 2, left: -8 },
  { top: 30, left: -14 },
];

interface ConfettiPiece {
  left: number;
  color: string;
  isCircle: boolean;
  size: number;
  delay: number;
  duration: number;
  rotateDirection: number;
  fall: Animated.Value;
  opacity: Animated.Value;
}

function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, () => ({
    left: Math.random() * 92,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    isCircle: Math.random() > 0.5,
    size: 6 + Math.random() * 6,
    delay: Math.random() * 450,
    duration: 1500 + Math.random() * 900,
    rotateDirection: Math.random() > 0.5 ? 1 : -1,
    fall: new Animated.Value(0),
    opacity: new Animated.Value(1),
  }));
}

interface LevelUpModalProps {
  visible: boolean;
  fromLevel: ParentSkillLevel;
  toLevel: ParentSkillLevel;
  onDismiss: () => void;
}

export const LevelUpModal: React.FC<LevelUpModalProps> = ({ visible, fromLevel, toLevel, onDismiss }) => {
  const { t } = useTranslation();
  const { startBuzz, stopBuzz } = useAnticipationBuzz();

  // Callers (e.g. ReportScreen_v2) pass an inline, unmemoized onDismiss —
  // read it via a ref inside the animation effect below instead of listing
  // it as a dependency, so a parent re-render while the modal is visible
  // can't restart the whole animation sequence mid-flight.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgePulse = useRef(new Animated.Value(1)).current;
  const badgeSpin = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const oldContentOpacity = useRef(new Animated.Value(1)).current;
  const oldContentScale = useRef(new Animated.Value(1)).current;
  const newContentOpacity = useRef(new Animated.Value(0)).current;
  const newContentScale = useRef(new Animated.Value(0.4)).current;
  const shineTranslate = useRef(new Animated.Value(0)).current;
  const sparkles = useRef(
    [0, 1, 2].map(() => ({ scale: new Animated.Value(0), opacity: new Animated.Value(0) }))
  ).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(14)).current;

  // Landing flourish — fires once the coin's flip actually finishes and
  // settles, not at the start of the pop like everything else above.
  const landingBounce = useRef(new Animated.Value(1)).current;
  const landingFlashScale = useRef(new Animated.Value(0)).current;
  const landingFlashOpacity = useRef(new Animated.Value(0)).current;
  const landingRingScale = useRef(new Animated.Value(0)).current;
  const landingRingOpacity = useRef(new Animated.Value(0)).current;

  const confetti = useRef<ConfettiPiece[]>(makeConfetti()).current;

  useEffect(() => {
    if (!visible) return;

    // Reset everything so the sequence replays cleanly on every level-up.
    backdropOpacity.setValue(0);
    badgeScale.setValue(0);
    badgePulse.setValue(1);
    badgeSpin.setValue(0);
    ringScale.setValue(0);
    ringOpacity.setValue(0);
    oldContentOpacity.setValue(1);
    oldContentScale.setValue(1);
    newContentOpacity.setValue(0);
    newContentScale.setValue(0.4);
    shineTranslate.setValue(0);
    sparkles.forEach((s) => {
      s.scale.setValue(0);
      s.opacity.setValue(0);
    });
    titleOpacity.setValue(0);
    titleTranslateY.setValue(14);
    landingBounce.setValue(1);
    landingFlashScale.setValue(0);
    landingFlashOpacity.setValue(0);
    landingRingScale.setValue(0);
    landingRingOpacity.setValue(0);
    confetti.forEach((piece) => {
      piece.fall.setValue(0);
      piece.opacity.setValue(1);
    });

    let soundRef: Audio.Sound | null = null;
    const playPopSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(SOUNDS.Win, { shouldPlay: true, volume: 0.8 });
        soundRef = sound;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) sound.unloadAsync();
        });
      } catch (err) {
        // Best-effort — a silent celebration is still a celebration.
      }
    };

    // Intro (backdrop fade + badge pop-in + a beat to let it register) runs
    // first; sound/haptics/burst-visuals all fire together off its
    // completion callback, so they land exactly on the pop instead of at
    // t=0 (a `playPopSound()` fired alongside `.start()` on the whole
    // sequence would play ~900ms before anything visually happens).
    const introSequence = Animated.sequence([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(badgeScale, { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
      Animated.delay(450),
    ]);

    // Drives the coin's scaleX flip (FLIP_INPUT_RANGE/FLIP_OUTPUT_RANGE
    // above) through FLIP_COUNT flips at a CONSTANT rate. Kept OUTSIDE
    // popParallel (with its own .start() below) so its completion callback
    // fires exactly when the coin actually settles, independent of
    // popParallel's other members — that's the "landing" flourish trigger.
    // Linear, not eased: the flip's own cosine shape already provides all the
    // "fast in the middle, slow at the ends" character a real coin has, so an
    // additional easing curve on top would double up and distort the pacing.
    const spinAnimation = Animated.timing(badgeSpin, {
      toValue: 1,
      duration: SPIN_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });

    const popParallel = Animated.parallel([
        // Shockwave ring burst at the moment the level flips.
        Animated.timing(ringScale, { toValue: 1.7, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(ringOpacity, { toValue: 0.6, duration: 80, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0, duration: 470, useNativeDriver: true }),
        ]),
        // Old level content drops away.
        Animated.parallel([
          Animated.timing(oldContentOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(oldContentScale, { toValue: 0.6, duration: 200, useNativeDriver: true }),
        ]),
        // New level content pops in with overshoot, slightly after the old fades.
        Animated.sequence([
          Animated.delay(120),
          Animated.parallel([
            Animated.timing(newContentOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
            Animated.spring(newContentScale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
          ]),
        ]),
        // Shine sweeps across the coin right as the new number lands.
        Animated.sequence([
          Animated.delay(160),
          Animated.timing(shineTranslate, { toValue: 1, duration: 480, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        // A few sparkles twinkle around the coin at the same moment.
        ...sparkles.map((s, i) =>
          Animated.sequence([
            Animated.delay(160 + i * 90),
            Animated.parallel([
              Animated.sequence([
                Animated.timing(s.opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
                Animated.timing(s.opacity, { toValue: 0, duration: 340, useNativeDriver: true }),
              ]),
              Animated.sequence([
                Animated.spring(s.scale, { toValue: 1, tension: 120, friction: 6, useNativeDriver: true }),
                Animated.timing(s.scale, { toValue: 0, duration: 260, useNativeDriver: true }),
              ]),
            ]),
          ])
        ),
        // Badge itself pulses to sell the impact.
        Animated.sequence([
          Animated.delay(100),
          Animated.timing(badgePulse, { toValue: 1.15, duration: 140, useNativeDriver: true }),
          Animated.timing(badgePulse, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]),
        // Confetti rains down, staggered per-piece.
        ...confetti.map((piece) =>
          Animated.sequence([
            Animated.delay(piece.delay),
            Animated.parallel([
              Animated.timing(piece.fall, { toValue: 1, duration: piece.duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
              Animated.sequence([
                Animated.delay(piece.duration * 0.6),
                Animated.timing(piece.opacity, { toValue: 0, duration: piece.duration * 0.4, useNativeDriver: true }),
              ]),
            ]),
          ])
        ),
        Animated.sequence([
          Animated.delay(150),
          Animated.parallel([
            Animated.timing(titleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.spring(titleTranslateY, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
          ]),
        ]),
    ]);

    let buzzStartTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let autoDismissTimeoutId: ReturnType<typeof setTimeout> | null = null;

    introSequence.start(() => {
      playPopSound();
      buzzStartTimeoutId = setTimeout(() => {
        startBuzz({
          duration: BUZZ_DURATION_MS,
          minDelay: 90,
          maxDelay: 25,
          // Core Haptics has no literal Hz control — `sharpness` is the closest
          // analog to "frequency" (low = dull rumble, high = crisp/buzzy).
          // Pushed higher throughout for a buzzier feel, not just at the end.
          startSharpness: 0.55,
          endSharpness: 1,
        });
      }, BUZZ_START_DELAY_MS);
      popParallel.start();

      spinAnimation.start(() => {
        // Landing flourish — the coin has actually settled on its final
        // face now, so this is the real "confirmed" reveal moment: a firm
        // haptic thunk, a bigger bounce than the earlier pulse, a second
        // (stronger) shockwave ring, and a quick white flash behind the badge.
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

        Animated.parallel([
          Animated.sequence([
            Animated.spring(landingBounce, { toValue: 1.35, tension: 220, friction: 6, useNativeDriver: true }),
            Animated.spring(landingBounce, { toValue: 1, tension: 180, friction: 9, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(landingFlashScale, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(landingFlashOpacity, { toValue: 0.9, duration: 60, useNativeDriver: true }),
              Animated.timing(landingFlashOpacity, { toValue: 0, duration: 320, useNativeDriver: true }),
            ]),
          ]),
          Animated.parallel([
            Animated.timing(landingRingScale, { toValue: 2.1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(landingRingOpacity, { toValue: 0.8, duration: 60, useNativeDriver: true }),
              Animated.timing(landingRingOpacity, { toValue: 0, duration: 440, useNativeDriver: true }),
            ]),
          ]),
        ]).start();

        // Auto-dismiss back to the screen underneath once the landing
        // flourish (longest piece: the ring burst, 500ms) has had time to
        // read, plus a short beat to actually see the final result.
        autoDismissTimeoutId = setTimeout(() => {
          onDismissRef.current();
        }, 900);
      });
    });

    return () => {
      soundRef?.unloadAsync();
      if (buzzStartTimeoutId) clearTimeout(buzzStartTimeoutId);
      if (autoDismissTimeoutId) clearTimeout(autoDismissTimeoutId);
      stopBuzz();
    };
  }, [visible, fromLevel, toLevel, startBuzz, stopBuzz]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Pressable style={styles.overlayPressable} onPress={onDismiss}>
      <Animated.View style={[styles.overlay, { opacity: backdropOpacity }]}>
        <LinearGradient colors={['#7C3AED', '#5B21B6']} style={StyleSheet.absoluteFill} />

        <View style={styles.confettiLayer} pointerEvents="none">
          {confetti.map((piece, i) => (
            <Animated.View
              key={i}
              style={[
                styles.confettiPiece,
                {
                  left: `${piece.left}%`,
                  width: piece.size,
                  height: piece.size,
                  backgroundColor: piece.color,
                  borderRadius: piece.isCircle ? piece.size / 2 : 2,
                  opacity: piece.opacity,
                  transform: [
                    {
                      translateY: piece.fall.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-40, SCREEN_HEIGHT + 40],
                      }),
                    },
                    {
                      rotate: piece.fall.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', `${piece.rotateDirection * 360}deg`],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.content}>
          <View style={styles.badgeWrap}>
            <Animated.View
              style={[
                styles.landingFlash,
                { opacity: landingFlashOpacity, transform: [{ scale: landingFlashScale }] },
              ]}
              pointerEvents="none"
            />
            <Animated.View
              style={[
                styles.ring,
                { opacity: ringOpacity, transform: [{ scale: ringScale }] },
              ]}
            />
            <Animated.View
              style={[
                styles.ring,
                { opacity: landingRingOpacity, transform: [{ scale: landingRingScale }] },
              ]}
            />
            <Animated.View
              style={[
                styles.badgeShadow,
                {
                  transform: [
                    {
                      scaleX: badgeSpin.interpolate({
                        inputRange: FLIP_INPUT_RANGE,
                        outputRange: FLIP_OUTPUT_RANGE,
                      }),
                    },
                    { scale: badgeScale },
                    { scale: badgePulse },
                    { scale: landingBounce },
                  ],
                },
              ]}
            >
              <LinearGradient colors={['#F5D890', '#CBA76A']} style={styles.badgeCircle}>
                <Animated.View
                  style={[
                    styles.badgeContent,
                    { opacity: oldContentOpacity, transform: [{ scale: oldContentScale }] },
                  ]}
                >
                  <Ionicons name={PARENT_SKILL_LEVEL_ICONS[fromLevel]} size={26} color="#FFFFFF" />
                  <Text style={styles.badgeNumber}>{fromLevel}</Text>
                </Animated.View>
                <Animated.View
                  style={[
                    styles.badgeContent,
                    styles.badgeContentOverlay,
                    { opacity: newContentOpacity, transform: [{ scale: newContentScale }] },
                  ]}
                >
                  <Ionicons name={PARENT_SKILL_LEVEL_ICONS[toLevel]} size={26} color="#FFFFFF" />
                  <Text style={styles.badgeNumber}>{toLevel}</Text>
                </Animated.View>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.shine,
                    {
                      opacity: newContentOpacity,
                      transform: [
                        { rotate: '10deg' },
                        {
                          translateX: shineTranslate.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-140, 140],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              </LinearGradient>
            </Animated.View>
            {sparkles.map((s, i) => (
              <Animated.View
                key={i}
                pointerEvents="none"
                style={[
                  styles.sparkle,
                  SPARKLE_POSITIONS[i],
                  { opacity: s.opacity, transform: [{ scale: s.scale }] },
                ]}
              >
                <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              </Animated.View>
            ))}
          </View>

          <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] }}>
            <Text style={styles.title}>{t('reportV2.levelUp.title')}</Text>
            <Text style={styles.subtitle}>{t('reportV2.levelUp.subtitle', { level: toLevel })}</Text>
          </Animated.View>
        </View>
      </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlayPressable: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  confettiPiece: {
    position: 'absolute',
    top: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  badgeWrap: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 28,
  },
  ring: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  landingFlash: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#FFFFFF',
  },
  badgeShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  badgeCircle: {
    width: 116,
    height: 116,
    borderRadius: 58,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  badgeContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeContentOverlay: {
    position: 'absolute',
  },
  badgeNumber: {
    fontFamily: FONTS.bold,
    fontSize: 32,
    color: '#FFFFFF',
    marginTop: 2,
  },
  shine: {
    position: 'absolute',
    top: -60,
    left: '50%',
    width: 36,
    height: 240,
    marginLeft: -18,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  sparkle: {
    position: 'absolute',
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 30,
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#E9D5FF',
    textAlign: 'center',
    marginTop: 6,
  },
});
