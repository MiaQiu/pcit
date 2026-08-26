/**
 * Level Up Modal
 * Duolingo-style full-screen celebration shown when a session's analysis
 * pushes the parent's skill level up (e.g. Level 1 -> Level 2). Detection of
 * "did this just happen" lives in the caller (ReportScreen_v2) — this
 * component only plays the animation for a given from/to level pair.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useTranslation } from 'react-i18next';
import { FONTS, COLORS, SOUNDS } from '../constants/assets';
import { PARENT_SKILL_LEVEL_KEYS } from '../constants/parentSkillLevels';
import type { ParentSkillLevel } from '@nora/core';

// Mirrors PARENT_SKILL_LEVELS' icon choices in ProfileReportScreen.tsx, kept
// local here since this modal only needs the icon (not the rest of that
// screen's ladder metadata).
const LEVEL_ICONS: Record<ParentSkillLevel, keyof typeof Ionicons.glyphMap> = {
  1: 'happy-outline',
  2: 'star-outline',
  3: 'locate-outline',
  4: 'chatbubble-outline',
  5: 'flag-outline',
  6: 'shield-checkmark-outline',
  7: 'trophy-outline',
};

const CONFETTI_COLORS = [COLORS.mainPurple, COLORS.tealAccent, '#CBA76A', COLORS.ellipseOrange, COLORS.ellipseCyan, COLORS.cardOrange];
const CONFETTI_COUNT = 16;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgePulse = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const oldContentOpacity = useRef(new Animated.Value(1)).current;
  const oldContentScale = useRef(new Animated.Value(1)).current;
  const newContentOpacity = useRef(new Animated.Value(0)).current;
  const newContentScale = useRef(new Animated.Value(0.4)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(14)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(14)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  const confetti = useRef<ConfettiPiece[]>(makeConfetti()).current;

  useEffect(() => {
    if (!visible) return;

    // Reset everything so the sequence replays cleanly on every level-up.
    backdropOpacity.setValue(0);
    badgeScale.setValue(0);
    badgePulse.setValue(1);
    ringScale.setValue(0);
    ringOpacity.setValue(0);
    oldContentOpacity.setValue(1);
    oldContentScale.setValue(1);
    newContentOpacity.setValue(0);
    newContentScale.setValue(0.4);
    titleOpacity.setValue(0);
    titleTranslateY.setValue(14);
    cardOpacity.setValue(0);
    cardTranslateY.setValue(14);
    buttonOpacity.setValue(0);
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

    Animated.sequence([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(badgeScale, { toValue: 1, tension: 55, friction: 7, useNativeDriver: true }),
      Animated.delay(450),
      Animated.parallel([
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
        Animated.sequence([
          Animated.delay(320),
          Animated.parallel([
            Animated.timing(cardOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.spring(cardTranslateY, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
          ]),
        ]),
        Animated.sequence([
          Animated.delay(500),
          Animated.timing(buttonOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]),
      ]),
    ]).start();

    playPopSound();

    return () => {
      soundRef?.unloadAsync();
    };
  }, [visible, fromLevel, toLevel]);

  const fromKey = PARENT_SKILL_LEVEL_KEYS[fromLevel];
  const toKey = PARENT_SKILL_LEVEL_KEYS[toLevel];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
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
                styles.ring,
                { opacity: ringOpacity, transform: [{ scale: ringScale }] },
              ]}
            />
            <Animated.View style={{ transform: [{ scale: badgeScale }, { scale: badgePulse }] }}>
              <LinearGradient colors={['#F5D890', '#CBA76A']} style={styles.badgeCircle}>
                <Animated.View
                  style={[
                    styles.badgeContent,
                    { opacity: oldContentOpacity, transform: [{ scale: oldContentScale }] },
                  ]}
                >
                  <Ionicons name={LEVEL_ICONS[fromLevel]} size={26} color="#FFFFFF" />
                  <Text style={styles.badgeNumber}>{fromLevel}</Text>
                </Animated.View>
                <Animated.View
                  style={[
                    styles.badgeContent,
                    styles.badgeContentOverlay,
                    { opacity: newContentOpacity, transform: [{ scale: newContentScale }] },
                  ]}
                >
                  <Ionicons name={LEVEL_ICONS[toLevel]} size={26} color="#FFFFFF" />
                  <Text style={styles.badgeNumber}>{toLevel}</Text>
                </Animated.View>
              </LinearGradient>
            </Animated.View>
          </View>

          <Animated.View style={{ opacity: titleOpacity, transform: [{ translateY: titleTranslateY }] }}>
            <Text style={styles.title}>{t('reportV2.levelUp.title')}</Text>
            <Text style={styles.subtitle}>{t('reportV2.levelUp.subtitle', { level: toLevel })}</Text>
          </Animated.View>

          <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] }]}>
            <Text style={styles.cardLabel}>{t('reportV2.levelUp.skillUnlocked')}</Text>
            <Text style={styles.cardTitle}>{t(`profileReport.levels.${toKey}.title`)}</Text>
            <Text style={styles.cardSkill}>{t(`profileReport.levels.${toKey}.skill`)}</Text>
          </Animated.View>

          <Animated.View style={{ opacity: buttonOpacity, width: '100%' }}>
            <TouchableOpacity style={styles.continueButton} onPress={onDismiss} activeOpacity={0.85}>
              <Text style={styles.continueButtonText}>{t('reportV2.levelUp.continueButton')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
  badgeCircle: {
    width: 116,
    height: 116,
    borderRadius: 58,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 22,
    width: '100%',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 28,
  },
  cardLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.tealAccent,
  },
  cardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: COLORS.textDark,
    marginTop: 8,
  },
  cardSkill: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  continueButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  continueButtonText: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.mainPurple,
  },
});
