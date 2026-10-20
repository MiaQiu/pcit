/**
 * ModuleChatBookmarksScreen
 * The coach replies the parent bookmarked in a Learn module chat (bookmark
 * under a reply in ModuleChatScreen), newest first. Opened from the bookmarks
 * icon in the chat's header; tapping a card's bookmark removes it.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { COLORS, FONTS } from '../constants/assets';
import type { RootStackParamList } from '../navigation/types';
import { useAuthService } from '../contexts/AppContext';
import { TrackedTouchable } from '../components/TrackedTouchable';
import amplitudeService from '../services/amplitudeService';
import { reportError } from '../utils/reportError';
import { parseQuickReplies } from '../utils/chatQuickReplies';
import { MarkdownText } from '../utils/MarkdownText';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const MUTED = '#6B7280';

interface Bookmark {
  id: string;
  text: string;
  messageCreatedAt: string;
}

export const ModuleChatBookmarksScreen: React.FC = () => {
  const navigation = useNavigation();
  const { moduleKey } = useRoute<RouteProp<RootStackParamList, 'ModuleChatBookmarks'>>().params;
  const authService = useAuthService();
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'en' ? 'en-US' : i18n.language;
  const [bookmarks, setBookmarks] = useState<Bookmark[] | null>(null);
  const [error, setError] = useState(false);

  useFocusEffect(useCallback(() => {
    amplitudeService.trackEvent('Chat Bookmarks Opened', { chat: 'module_coach', moduleKey });
    authService.authenticatedRequest(`${API_URL}/api/coach/bookmarks?moduleKey=${moduleKey}`)
      .then(r => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        return r.json();
      })
      .then((data: { bookmarks: Bookmark[] }) => {
        setBookmarks(data.bookmarks);
        setError(false);
      })
      .catch(err => {
        reportError(err, 'ModuleChatBookmarksScreen.load');
        setError(true);
      });
  }, [authService, moduleKey]));

  const remove = useCallback((bookmark: Bookmark) => {
    Alert.alert(t('moduleChat.bookmarks.removeTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('moduleChat.bookmarks.removeConfirm'),
        style: 'destructive',
        onPress: async () => {
          const before = bookmarks;
          setBookmarks(prev => prev?.filter(b => b.id !== bookmark.id) ?? null);
          amplitudeService.trackEvent('Chat Bookmark Removed', { chat: 'module_coach', moduleKey, from: 'bookmarks' });
          try {
            const response = await authService.authenticatedRequest(`${API_URL}/api/coach/bookmarks/${bookmark.id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(`Server error ${response.status}`);
          } catch (err) {
            reportError(err, 'ModuleChatBookmarksScreen.remove');
            setBookmarks(before);
            Alert.alert(t('common.error'), t('moduleChat.bookmarks.removeError'));
          }
        },
      },
    ]);
  }, [bookmarks, authService, moduleKey, t]);

  const renderItem = ({ item }: { item: Bookmark }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarN}>N</Text>
        </View>
        <Text style={styles.date}>
          {new Date(item.messageCreatedAt).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
        <TouchableOpacity
          onPress={() => remove(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={t('moduleChat.bookmarks.remove')}
        >
          <Ionicons name="bookmark" size={20} color={COLORS.mainPurple} />
        </TouchableOpacity>
      </View>
      <MarkdownText style={styles.cardText} boldFontFamily={FONTS.bold}>
        {parseQuickReplies(item.text).text}
      </MarkdownText>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TrackedTouchable analyticsId="Back"
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          accessibilityLabel="Back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={COLORS.textDark} />
        </TrackedTouchable>
        <Text style={styles.headerTitle}>{t('moduleChat.bookmarks.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {bookmarks === null ? (
        <View style={styles.center}>
          {error
            ? <Text style={styles.emptyBody}>{t('moduleChat.bookmarks.loadError')}</Text>
            : <ActivityIndicator color={COLORS.mainPurple} />}
        </View>
      ) : (
        <FlatList
          data={bookmarks}
          keyExtractor={b => b.id}
          renderItem={renderItem}
          contentContainerStyle={bookmarks.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="bookmarks-outline" size={40} color={MUTED} />
              <Text style={styles.emptyTitle}>{t('moduleChat.bookmarks.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('moduleChat.bookmarks.emptyBody')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
  },
  headerSpacer: { width: 24 },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.mainPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarN: { fontFamily: FONTS.bold, fontSize: 12, color: '#FFFFFF' },
  date: { flex: 1, fontFamily: FONTS.regular, fontSize: 13, color: MUTED },
  cardText: {
    fontFamily: FONTS.regular,
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.textDark,
  },
  emptyContainer: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: 17, color: COLORS.textDark, marginTop: 4 },
  emptyBody: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 21, color: MUTED, textAlign: 'center' },
});
