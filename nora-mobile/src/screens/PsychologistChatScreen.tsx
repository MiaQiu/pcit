/**
 * Psychologist Chat Screen
 * Direct messaging thread between the parent and the Nora psychologist team.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import * as userStorage from '../lib/userStorage';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { useAuthService } from '../contexts/AppContext';
import { useCoachUnread } from '../contexts/CoachUnreadContext';
import { useTranslation } from 'react-i18next';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

const CACHE_KEY = '@nora_psych_messages_cache';

function twoDaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface Message {
  id: string;
  role: 'user_psych' | 'psychologist';
  text: string;
  createdAt?: string;
}

async function loadCache(): Promise<Message[]> {
  try {
    const raw = await userStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const msgs: Message[] = JSON.parse(raw);
    const cutoff = twoDaysAgo();
    return msgs.filter(m => m.createdAt && new Date(m.createdAt) >= cutoff);
  } catch {
    return [];
  }
}

async function saveCache(messages: Message[]): Promise<void> {
  try {
    const cutoff = twoDaysAgo();
    const toSave = messages.filter(m => m.createdAt && new Date(m.createdAt) >= cutoff);
    await userStorage.setItem(CACHE_KEY, JSON.stringify(toSave));
  } catch {}
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

const Bubble: React.FC<{ message: Message }> = ({ message }) => {
  const { t } = useTranslation();
  const isUser = message.role === 'user_psych';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowPsych]}>
      {!isUser && (
        <View style={styles.avatarWrap}>
          <Ionicons name="person" size={14} color="#fff" />
        </View>
      )}
      <View style={{ maxWidth: '78%' }}>
        {!isUser && <Text style={styles.psychLabel}>{t('psychologistChat.psychologist')}</Text>}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubblePsych]}>
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextPsych]}>
            {message.text}
          </Text>
        </View>
      </View>
    </View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export const PsychologistChatScreen: React.FC = () => {
  const navigation = useNavigation();
  const authService = useAuthService();
  const { markPsychAsRead } = useCoachUnread();
  const { t } = useTranslation();

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const latestServerTsRef = useRef<string | undefined>(undefined);
  const pinToBottomRef = useRef(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const scrollToEnd = useCallback((animated = true) => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 100);
  }, []);

  // Auto-focus input on first entry
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  // Mark psych messages as read on unmount
  useEffect(() => {
    return () => { markPsychAsRead(latestServerTsRef.current); };
  }, [markPsychAsRead]);

  // Load history then long-poll
  useEffect(() => {
    let cancelled = false;
    let since = new Date().toISOString();

    async function init() {
      const cached = await loadCache();
      if (cancelled) return;

      if (cached.length > 0) {
        setMessages(cached);
        since = cached[cached.length - 1].createdAt!;
        const lastTs = cached[cached.length - 1].createdAt!;
        latestServerTsRef.current = lastTs;
        markPsychAsRead(lastTs);
      } else {
        since = twoDaysAgo().toISOString();
      }

      try {
        const r = await authService.authenticatedRequest(
          `${API_URL}/api/coach/history?since=${encodeURIComponent(since)}`
        );
        const data: { messages: Array<{ id: string; role: string; text: string; createdAt: string }> } = await r.json();
        if (cancelled) return;

        const incoming = (data.messages ?? []).filter(
          m => m.role === 'psychologist' || m.role === 'user_psych'
        ) as Message[];

        if (incoming.length > 0) {
          setMessages(prev => {
            const base = prev.length === 0 ? cached : prev;
            const existingIds = new Set(base.map(m => m.id));
            const merged = [...base, ...incoming.filter(m => !existingIds.has(m.id))];
            saveCache(merged);
            return merged;
          });
          const lastTs = incoming[incoming.length - 1].createdAt!;
          since = lastTs;
          latestServerTsRef.current = lastTs;
          markPsychAsRead(lastTs);
        }
      } catch {}

      if (!cancelled) startPolling();
    }

    function startPolling() {
      if (cancelled) return;
      authService.authenticatedRequest(
        `${API_URL}/api/coach/events?since=${encodeURIComponent(since)}`
      )
        .then(r => r.json())
        .then((data: { messages: Array<{ id?: string; role?: string; text: string; createdAt?: string; type?: string }> }) => {
          if (cancelled) return;
          const incoming = (data.messages ?? []).filter(
            m => m.type !== 'status' && (m.role === 'psychologist' || m.role === 'user_psych')
          ) as Message[];

          if (incoming.length > 0) {
            setMessages(prev => {
              const base = prev.filter(m => !m.id.startsWith('opt-'));
              const existingIds = new Set(base.map(m => m.id));
              const newOnes = incoming.filter(m => !existingIds.has(m.id!));
              if (newOnes.length === 0) return prev;
              const updated = [...base, ...newOnes];
              saveCache(updated);
              return updated;
            });
            const lastTs = incoming[incoming.length - 1].createdAt!;
            since = lastTs;
            latestServerTsRef.current = lastTs;
            markPsychAsRead(lastTs);
            if (pinToBottomRef.current) scrollToEnd();
          }
        })
        .catch(() => {})
        .finally(() => startPolling());
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll to end when messages update and we're pinned
  useEffect(() => {
    if (pinToBottomRef.current && messages.length > 0) scrollToEnd(false);
  }, [messages.length, scrollToEnd]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setSending(true);
    Keyboard.dismiss();
    pinToBottomRef.current = true;

    const optimisticId = `opt-${Date.now()}`;
    setMessages(prev => [...prev, { id: optimisticId, role: 'user_psych', text, createdAt: new Date().toISOString() }]);

    try {
      await authService.authenticatedRequest(
        `${API_URL}/api/coach/psych-message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        }
      );
      // Replace optimistic message with server-confirmed one via polling
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
    } finally {
      setSending(false);
    }
  }, [input, sending, authService]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-down" size={26} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('psychologistChat.headerTitle')}</Text>
          <Text style={styles.headerSub}>{t('psychologistChat.headerSub')}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={m => m.id}
          renderItem={({ item }) => <Bubble message={item} />}
          contentContainerStyle={[styles.messageList, messages.length === 0 && styles.emptyList]}
          onContentSizeChange={() => {
            if (pinToBottomRef.current) scrollToEnd(false);
          }}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="person" size={28} color="#fff" />
              </View>
              <Text style={styles.emptyTitle}>{t('psychologistChat.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('psychologistChat.emptyBody')}</Text>
            </View>
          }
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('psychologistChat.inputPlaceholder')}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="arrow-up" size={20} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    color: COLORS.textDark,
  },
  headerSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 40,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
  },
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
    gap: 8,
  },
  bubbleRowUser: {
    justifyContent: 'flex-end',
  },
  bubbleRowPsych: {
    justifyContent: 'flex-start',
  },
  avatarWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  psychLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 11,
    color: '#0EA5E9',
    marginBottom: 3,
    marginLeft: 2,
  },
  bubble: {
    maxWidth: '100%',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  bubbleUser: {
    backgroundColor: COLORS.mainPurple,
    borderBottomRightRadius: 4,
  },
  bubblePsych: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextUser: {
    fontFamily: FONTS.regular,
    color: '#fff',
  },
  bubbleTextPsych: {
    fontFamily: FONTS.regular,
    color: COLORS.textDark,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 15,
    color: COLORS.textDark,
    backgroundColor: '#F9FAFB',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 120,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
});
