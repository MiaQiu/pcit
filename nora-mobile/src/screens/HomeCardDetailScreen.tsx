/**
 * HomeCardDetailScreen
 * Detail page for a CONTENT-type Home Card (see HomeScreen_v2's
 * SubActionCard) — styled like LessonViewerScreen_v2's chrome (close chevron
 * + identity row) but without the audio/playlist machinery, since this is
 * just admin-authored content, not a lesson. The body is an admin-ordered
 * sequence of typed blocks (see HomeCardComponentData) rather than one big
 * blob of text.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Image, TextInput, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LessonContentBlocks } from '../components/LessonContentBlocks';
import { formatLessonContentV2 } from '../utils/formatLessonContentV2';
import { COLORS, FONTS } from '../constants/assets';
import { LESSON_TEXT_DARK, LESSON_TEXT_GREY } from '../constants/lessonViewerColors';
import { useRecordingService } from '../contexts/AppContext';
import amplitudeService from '../services/amplitudeService';

type HomeCardComponentType = 'TEXT' | 'IMAGE' | 'OPEN_DETAILS' | 'USER_INPUT';

interface HomeCardComponentData {
  id: string;
  type: HomeCardComponentType;
  text: string | null;
  imageUrl: string | null;
  linkedCardId: string | null;
  ctaLabel: string | null;
  inputLabel: string | null;
  inputPlaceholder: string | null;
  userAnswer?: string | null;
}

interface HomeCardDetailScreenProps {
  route: {
    params: {
      cardId: string;
    };
  };
  navigation: any;
}

const TextComponent: React.FC<{ text: string }> = ({ text }) => {
  const blocks = useMemo(() => formatLessonContentV2(text), [text]);
  return <LessonContentBlocks blocks={blocks} />;
};

const OpenDetailsComponent: React.FC<{ component: HomeCardComponentData; navigation: any }> = ({ component, navigation }) => (
  <TouchableOpacity
    style={styles.ctaRow}
    onPress={() => navigation.push('HomeCardDetail', { cardId: component.linkedCardId })}
    activeOpacity={0.7}
  >
    <Text style={styles.ctaLabel}>{component.ctaLabel || 'Learn more'}</Text>
    <Ionicons name="chevron-forward" size={18} color={COLORS.mainPurple} />
  </TouchableOpacity>
);

const UserInputComponent: React.FC<{ cardId: string; component: HomeCardComponentData }> = ({ cardId, component }) => {
  const recordingService = useRecordingService();
  const [answer, setAnswer] = useState(component.userAnswer || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!component.userAnswer);

  const handleSave = async () => {
    if (!answer.trim() || saving) return;
    setSaving(true);
    try {
      await recordingService.submitHomeCardInput(cardId, component.id, answer.trim());
      setSaved(true);
      amplitudeService.trackEvent('Home Card Input Saved', { cardId, componentId: component.id });
    } catch (err) {
      console.error('Failed to save home card input:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.inputBlock}>
      {!!component.inputLabel && <Text style={styles.inputLabel}>{component.inputLabel}</Text>}
      <TextInput
        style={styles.inputBox}
        value={answer}
        onChangeText={(text) => {
          setAnswer(text);
          setSaved(false);
        }}
        placeholder={component.inputPlaceholder || 'Type your answer...'}
        placeholderTextColor={LESSON_TEXT_GREY}
        multiline
      />
      <TouchableOpacity
        style={[styles.saveButton, (!answer.trim() || saving) && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!answer.trim() || saving}
      >
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : saved ? 'Saved' : 'Save'}</Text>
      </TouchableOpacity>
    </View>
  );
};

export const HomeCardDetailScreen: React.FC<HomeCardDetailScreenProps> = ({ route, navigation }) => {
  const { cardId } = route.params;
  const recordingService = useRecordingService();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    id: string;
    badgeText: string;
    badgeColor: string;
    detailTitle: string;
    imageUrl: string | null;
    components: HomeCardComponentData[];
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

  const handleShare = () => {
    if (!detail) return;
    amplitudeService.trackEvent('Home Card Shared', { cardId });
    const webUrl = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:3001';
    const shareUrl = `${webUrl}/share-home-card.html?card_id=${encodeURIComponent(cardId)}`;

    // `message` always carries the link as plain text: Android's Share module
    // ignores `url` entirely, and on iOS, passing url+message as two separate
    // items makes the sheet's "Copy" action write a serialized item instead
    // of plain text unless the link is also embedded in the message itself.
    Share.share({
      message: `${detail.detailTitle}\n\n${shareUrl}`,
      url: shareUrl,
    }).catch(() => {});
  };

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
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
          accessibilityLabel="Share"
        >
          <Ionicons name="share-outline" size={20} color={COLORS.textDark} />
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
        {detail.components.map((component) => {
          switch (component.type) {
            case 'TEXT':
              return <TextComponent key={component.id} text={component.text || ''} />;
            case 'IMAGE':
              return component.imageUrl ? (
                <View key={component.id} style={styles.imageRow}>
                  <Image source={{ uri: component.imageUrl }} style={styles.contentImage} resizeMode="cover" />
                </View>
              ) : null;
            case 'OPEN_DETAILS':
              return <OpenDetailsComponent key={component.id} component={component} navigation={navigation} />;
            case 'USER_INPUT':
              return <UserInputComponent key={component.id} cardId={cardId} component={component} />;
            default:
              return null;
          }
        })}
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
  shareButton: {
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
  imageRow: {
    marginBottom: 16,
  },
  contentImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: '#E5E6EA',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.mainPurple,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  ctaLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: COLORS.mainPurple,
  },
  inputBlock: {
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: LESSON_TEXT_DARK,
    marginBottom: 8,
  },
  inputBox: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: LESSON_TEXT_DARK,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  saveButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    backgroundColor: COLORS.mainPurple,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: '#fff',
  },
});
