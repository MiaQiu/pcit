/**
 * GlobalLessonAudioBar
 * App-wide "now playing" strip for the shared lesson-narration player
 * (LessonPlayerContext). Rendered once at the app root (App.tsx) so that a
 * lesson started from anywhere — e.g. the "Learn more" link inside a coaching
 * report — always has a visible play/pause + stop control, even after the
 * user navigates away from the lesson viewer.
 *
 * Hidden while a focused screen already owns a player UI for the same track
 * (LearnScreen_v3's mini-player and LessonViewerScreen_v2's AudioPlayBar,
 * which flag it via player.setScreenOwnsPlayer) so the control never doubles
 * up.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/assets';
import { useLessonPlayer } from '../contexts/LessonPlayerContext';
import type { RootStackNavigationProp } from '../navigation/types';

export const GlobalLessonAudioBar: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation<RootStackNavigationProp>();
  const player = useLessonPlayer();

  if (!player.activeLessonId) return null;
  if (player.screenOwnsPlayer) return null;

  const title = player.activeLessonTitle || t('lessonPlayer.narrationPlaying');

  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom || 8 }]}>
      <TouchableOpacity
        style={styles.info}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('LessonViewerV2', { lessonId: player.activeLessonId! })}
      >
        <Ionicons name="musical-notes" size={16} color={COLORS.white} style={styles.noteIcon} />
        <View style={styles.textCol}>
          <Text style={styles.eyebrow}>{t('lessonPlayer.nowPlaying')}</Text>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => (player.isPlaying ? player.pause() : player.play())}
        disabled={player.isLoading}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={player.isPlaying ? 'Pause' : 'Play'}
      >
        {player.isLoading ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <Ionicons name={player.isPlaying ? 'pause' : 'play'} size={20} color={COLORS.white} />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.iconButton}
        onPress={() => player.clear()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={t('lessonPlayer.stop')}
      >
        <Ionicons name="close" size={22} color={COLORS.white} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9997,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 14,
    backgroundColor: COLORS.mainPurple,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 10,
  },
  info: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteIcon: {
    marginRight: 10,
  },
  textCol: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
  },
  title: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.white,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});
