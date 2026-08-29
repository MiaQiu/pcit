/**
 * GetReadySectionScreen
 * Full-content detail page for one GetReadyToPlayScreen row (e.g. "Toys to
 * Use", "How to Start"). Pushed from the row's onPress instead of expanding
 * in place, so long sections (with images) get a full page rather than a
 * cramped inline accordion.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/assets';
import { GetReadySectionBody } from '../components/GetReadySectionBody';
import { useLessonService } from '../contexts/AppContext';
import type { RootStackParamList } from '../navigation/types';
import type { DemoVideo } from '@nora/core';

interface GetReadySectionScreenProps {
  route: {
    params: RootStackParamList['GetReadySection'];
  };
}

// "How to Play" pairs its short encouragement text with the same Demo
// Videos content shown on the Learn tab (see LearnScreen_v2's
// DemoVideosSection) — the first active video in admin display order, so
// parents can watch a real Special Time session instead of just reading
// about one.
const DemoVideoPlayer: React.FC = () => {
  const lessonService = useLessonService();
  const { i18n } = useTranslation();
  const videoRef = useRef<Video>(null);
  const [video, setVideo] = useState<DemoVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  // expo-av's built-in poster tap-to-play doesn't reliably register when the
  // player sits inside a ScrollView, so we drive the first play ourselves
  // via the ref and hide our overlay once playback has actually started —
  // native controls take over from there.
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    lessonService
      .getDemoVideos(i18n.language)
      .then(({ demoVideos }) => {
        if (!cancelled) setVideo(demoVideos[0] ?? null);
      })
      .catch((err) => {
        console.error('[GetReadySectionScreen] Failed to load demo videos:', err);
        if (!cancelled) setFetchError(err?.message || 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lessonService, i18n.language]);

  if (loading) {
    return (
      <View style={[styles.videoWrap, styles.videoLoading]}>
        <ActivityIndicator color={COLORS.mainPurple} />
      </View>
    );
  }
  if (fetchError) {
    return (
      <View style={[styles.videoWrap, styles.videoLoading]}>
        <Text style={styles.videoErrorText}>Couldn't load video list: {fetchError}</Text>
      </View>
    );
  }
  if (!video) {
    return (
      <View style={[styles.videoWrap, styles.videoLoading]}>
        <Text style={styles.videoErrorText}>No demo video is configured yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.videoBlock}>
      <Text style={styles.videoTitle}>{video.title}</Text>
      <View style={styles.videoWrap}>
        <Video
          ref={videoRef}
          source={{ uri: video.videoUrl }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls
          isMuted={false}
          volume={1.0}
          usePoster={!!video.thumbnailUrl}
          posterSource={video.thumbnailUrl ? { uri: video.thumbnailUrl } : undefined}
          posterStyle={styles.video}
          onPlaybackStatusUpdate={(status) => {
            if (status.isLoaded && status.isPlaying && !hasStarted) setHasStarted(true);
          }}
          onError={(err) => {
            console.error('[GetReadySectionScreen] Video playback error:', err, video.videoUrl);
            setPlaybackError(String(err));
          }}
        />
        {!hasStarted && (
          <TouchableOpacity
            style={styles.playOverlay}
            activeOpacity={0.8}
            onPress={async () => {
              try {
                await videoRef.current?.playAsync();
                setHasStarted(true);
              } catch (err) {
                console.error('[GetReadySectionScreen] playAsync failed:', err);
                setPlaybackError(String(err));
              }
            }}
          >
            <View style={styles.playButton}>
              <Ionicons name="play" size={28} color="#fff" />
            </View>
          </TouchableOpacity>
        )}
      </View>
      {!!playbackError && <Text style={styles.videoErrorText}>Playback error: {playbackError}</Text>}
    </View>
  );
};

export const GetReadySectionScreen: React.FC<GetReadySectionScreenProps> = ({ route }) => {
  const { sectionKey } = route.params;
  const navigation = useNavigation();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backCircle}
          activeOpacity={0.7}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={18} color={COLORS.textDark} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t(`getReadyToPlay.sections.${sectionKey}.title`)}</Text>
        <Text style={styles.subtitle}>{t(`getReadyToPlay.sections.${sectionKey}.subtitle`)}</Text>
        <View style={styles.bodyWrap}>
          <GetReadySectionBody body={t(`getReadyToPlay.sections.${sectionKey}.body`)} />
        </View>
        {sectionKey === 'howToPlay' && <DemoVideoPlayer />}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 28,
    lineHeight: 34,
    color: COLORS.textDark,
    marginTop: 8,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 17,
    lineHeight: 24,
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 20,
  },
  bodyWrap: {
    marginTop: 4,
  },
  videoBlock: {
    marginTop: 8,
  },
  videoTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 16,
    color: COLORS.textDark,
    marginBottom: 10,
  },
  videoWrap: {
    position: 'relative',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  videoLoading: {
    marginTop: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoErrorText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 8,
  },
});
