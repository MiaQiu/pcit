/**
 * HomeCardDetailScreen
 * Detail page for a CONTENT-type Home Card (see HomeScreen_v2's
 * SubActionCard) — styled like LessonViewerScreen_v2's chrome (close chevron
 * + identity row) but without the audio/playlist machinery, since this is
 * just admin-authored text, not a lesson.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LessonContentBlocks } from '../components/LessonContentBlocks';
import { formatLessonContentV2 } from '../utils/formatLessonContentV2';
import { COLORS, FONTS } from '../constants/assets';
import { LESSON_TEXT_DARK } from '../constants/lessonViewerColors';
import { useRecordingService } from '../contexts/AppContext';
import amplitudeService from '../services/amplitudeService';

interface HomeCardDetailScreenProps {
  route: {
    params: {
      cardId: string;
    };
  };
  navigation: any;
}

export const HomeCardDetailScreen: React.FC<HomeCardDetailScreenProps> = ({ route, navigation }) => {
  const { cardId } = route.params;
  const recordingService = useRecordingService();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    badgeText: string;
    badgeColor: string;
    detailTitle: string;
    detailContent: string;
    imageUrl: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    recordingService
      .getHomeCardDetail(cardId)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        amplitudeService.trackEvent('Home Card Detail Viewed', { cardId });
      })
      .catch((err) => {
        console.error('Failed to load home card detail:', err);
        if (!cancelled) setError(err.message || 'Failed to load content');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cardId]);

  const blocks = useMemo(() => formatLessonContentV2(detail?.detailContent || ''), [detail?.detailContent]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.mainPurple} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !detail) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Close"
          >
            <Ionicons name="chevron-down" size={24} color={COLORS.textDark} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Content not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Close"
        >
          <Ionicons name="chevron-down" size={24} color={COLORS.textDark} />
        </TouchableOpacity>
      </View>

      {detail.imageUrl && (
        <Image source={{ uri: detail.imageUrl }} style={styles.headerImage} resizeMode="cover" />
      )}

      <View style={styles.identityRow}>
        <View style={[styles.badge, { backgroundColor: detail.badgeColor }]}>
          <Text style={styles.badgeText}>{detail.badgeText}</Text>
        </View>
        <Text style={styles.title}>{detail.detailTitle}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LessonContentBlocks blocks={blocks} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontFamily: FONTS.regular,
    fontSize: 16,
    color: LESSON_TEXT_DARK,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#F3F4F6',
  },
  identityRow: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  badgeText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#fff',
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: LESSON_TEXT_DARK,
    lineHeight: 28,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
});
