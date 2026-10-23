/**
 * Module Chat Screen
 * "Check in with your coach" for a Learn module, opened from
 * LearnModuleScreen_v2. Starts as a copy of CoachChatScreen (AI parenting
 * coach — calls backend /api/coach/chat, Gemini via LLM gateway);
 * module-specific changes go here so the main coach chat is unaffected.
 *
 * Sends moduleKey with each message, so the server answers with the module's
 * scoped coach (server/prompts/coach-screentime.txt). Tapping a suggested
 * strategy sends "I'd like to talk about …", which starts the coach's
 * strategy check-in; the coach's quick replies (OPTIONS line) show as chips
 * under its latest message and send on tap.
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
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Keyboard,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as userStorage from '../lib/userStorage';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../navigation/types';
import { useModulePlan } from './LearnModulePlanView';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { useAuthService } from '../contexts/AppContext';
import { useCoachUnread } from '../contexts/CoachUnreadContext';
import { useTranslation } from 'react-i18next';
import amplitudeService from '../services/amplitudeService';
import { TrackedTouchable } from '../components/TrackedTouchable';
import { reportError } from '../utils/reportError';
import { parseQuickReplies } from '../utils/chatQuickReplies';
import { MarkdownText } from '../utils/MarkdownText';

const PSYCH_REQUESTED_KEY = '@nora_psych_requested';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Message cache (past 2 days including today) ──────────────────────────────

const CACHE_KEY = '@nora_coach_messages_cache';

async function loadMessageCache(): Promise<Message[]> {
  try {
    const raw = await userStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveMessageCache(messages: Message[]): Promise<void> {
  try {
    if (messages.length === 0) {
      await userStorage.setItem(CACHE_KEY, JSON.stringify([]));
      return;
    }
    const timestamps = messages.map(m => m.createdAt ? new Date(m.createdAt).getTime() : 0);
    const latest = Math.max(...timestamps);
    const cutoff = latest - 24 * 60 * 60 * 1000;
    const toSave = messages.filter(m => m.createdAt && new Date(m.createdAt).getTime() >= cutoff);
    await userStorage.setItem(CACHE_KEY, JSON.stringify(toSave));
  } catch {}
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'model' | 'psychologist' | 'user_psych';
  text: string;
  createdAt?: string;
  // A fixed app line (greeting, check-in opening), not written by the coach.
  scripted?: boolean;
}

// Saved messages have server UUIDs; optimistic ('opt-…') and local error
// messages don't, and can't be bookmarked.
const SERVER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isBookmarkable = (m: Message) => m.role === 'model' && !m.scripted && SERVER_ID_RE.test(m.id);

// ─── Animated status dots ─────────────────────────────────────────────────────

const AnimatedStatusText: React.FC<{ text: string; style: object }> = ({ text, style }) => {
  const [dots, setDots] = useState(0);
  const base = text.replace(/\.+$/, '');

  useEffect(() => {
    setDots(0);
    const id = setInterval(() => setDots(d => (d + 1) % 4), 400);
    return () => clearInterval(id);
  }, [text]);

  return <Text style={style}>{base}{'...'.slice(0, dots)}</Text>;
};

// ─── Bubble ───────────────────────────────────────────────────────────────────

// onToggleBookmark is set only for the coach's own replies.
const Bubble: React.FC<{ message: Message; bookmarked?: boolean; onToggleBookmark?: () => void }> = ({ message, bookmarked, onToggleBookmark }) => {
  const { t } = useTranslation();
  const isUser = message.role === 'user';
  const isPsychologist = message.role === 'psychologist';
  const text = isUser ? message.text : parseQuickReplies(message.text).text;
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowModel]}>
      {!isUser && (
        <View style={[styles.avatarWrap, isPsychologist && styles.avatarWrapPsych]}>
          {isPsychologist
            ? <Ionicons name="person" size={14} color="#fff" />
            : <Text style={styles.avatarN}>N</Text>}
        </View>
      )}
      <View style={{ maxWidth: '78%' }}>
        {isPsychologist && (
          <Text style={styles.psychLabel}>{t('coachChat.psychologist')}</Text>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleModel]}>
          {isUser ? (
            <Text style={[styles.bubbleText, styles.bubbleTextUser]}>{text}</Text>
          ) : (
            // The coach writes **bold** for scripts and key words.
            <MarkdownText style={StyleSheet.flatten([styles.bubbleText, styles.bubbleTextModel])} boldFontFamily={FONTS.bold}>
              {text}
            </MarkdownText>
          )}
        </View>
        {onToggleBookmark && (
          <TouchableOpacity
            style={styles.bookmarkButton}
            onPress={onToggleBookmark}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={t(bookmarked ? 'moduleChat.bookmarks.remove' : 'moduleChat.bookmarks.add')}
          >
            <Ionicons
              name={bookmarked ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={bookmarked ? COLORS.mainPurple : '#9CA3AF'}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// A message that's only a greeting gets a fixed reply (no LLM call).
const GREETING_RE = /^(hi+|hello|hey+|hiya|yo|good (morning|afternoon|evening)|你好|您好|嗨|哈[囉啰喽]|早安|早上好|午安|晚上好)(\s*(there|nora|諾拉|诺拉))?[\s!.~,，。！～]*$/i;

// ─── Screen ───────────────────────────────────────────────────────────────────

export const ModuleChatScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { moduleKey, draft } = useRoute<RouteProp<RootStackParamList, 'ModuleChat'>>().params;
  const authService = useAuthService();
  const { t, i18n } = useTranslation();
  const { markAiAsRead, psychUnreadCount } = useCoachUnread();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const latestServerTsRef = useRef<string | undefined>(undefined);
  const optimisticIndexRef = useRef<number>(0);
  const pinToBottomRef = useRef(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [chattedThisVisit, setChattedThisVisit] = useState(false);
  // When the latest module session with a ready report was recorded — offers
  // "Chat about latest session" if it's newer than the last chat message.
  const [latestSessionAt, setLatestSessionAt] = useState<string | null>(null);
  // Ids of the bookmarked coach replies.
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [input, setInput] = useState(draft ?? '');
  const [showHumanModal, setShowHumanModal] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submittingHuman, setSubmittingHuman] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [psychRequested, setPsychRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [parentName, setParentName] = useState('');
  const [childName, setChildName] = useState('');

  // Ideas: the strategies suggested in the parent's last module report
  // (subtitle = its description; tapping starts a check-in on it). Before any
  // report, screen-time starters (tapping sends them).
  const { suggestedStrategies } = useModulePlan(moduleKey);
  const childLabel = childName || t('coachChat.yourChild');
  const SUGGESTION_IMAGES = [
    require('../../assets/images/green-energy.png'),
    require('../../assets/images/air-heater.png'),
    require('../../assets/images/rating.png'),
    require('../../assets/images/planning.png'),
  ];
  const SUGGESTIONS = suggestedStrategies.length > 0
    ? suggestedStrategies.map((strategy, i) => ({
        image: SUGGESTION_IMAGES[i % SUGGESTION_IMAGES.length],
        title: strategy.name,
        subtitle: strategy.description,
        prompt: t('moduleChat.strategyPrompt', { strategy: strategy.name }),
        isStrategy: true,
      }))
    : (['wontStop', 'planNext', 'whyHard', 'recording'] as const).map((key, i) => {
        const prompt = t(`moduleChat.firstTime.suggestions.${key}.prompt`, { childName: childLabel });
        return {
          image: SUGGESTION_IMAGES[i],
          title: t(`moduleChat.firstTime.suggestions.${key}.title`),
          subtitle: prompt,
          prompt,
          isStrategy: false,
        };
      });

  const scrollToEnd = useCallback((animated = true) => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 100);
  }, []);

  // Load psych-requested flag on mount
  useEffect(() => {
    userStorage.getItem(PSYCH_REQUESTED_KEY).then(v => {
      if (v === 'true') setPsychRequested(true);
    });
    amplitudeService.trackEvent('Chat Opened', { chat: 'ai_coach' });
  }, []);

  // Open the keyboard on entry — once the slide-up transition has finished,
  // so focusing doesn't stutter the animation.
  useEffect(() => {
    const unsubscribe = navigation.addListener('transitionEnd', (e: { data?: { closing?: boolean } }) => {
      if (!e.data?.closing) inputRef.current?.focus();
    });
    return unsubscribe;
  }, [navigation]);

  // Clear AI unread badge on exit
  useEffect(() => {
    return () => { markAiAsRead(latestServerTsRef.current); };
  }, [markAiAsRead]);

  useEffect(() => {
    authService.authenticatedRequest(`${API_URL}/api/learn-modules/${moduleKey}/latest-session`)
      .then(r => r.json())
      .then((data: { session: { createdAt: string; status: string } | null }) => {
        if (data.session?.status === 'ready') setLatestSessionAt(data.session.createdAt);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bookmarks — reloaded on focus, as the parent can remove them on the
  // bookmarks screen.
  useFocusEffect(useCallback(() => {
    authService.authenticatedRequest(`${API_URL}/api/coach/bookmarks?moduleKey=${moduleKey}`)
      .then(r => r.json())
      .then((data: { bookmarks: Array<{ messageId: string | null }> }) => {
        setBookmarkedIds(new Set(data.bookmarks.flatMap(b => (b.messageId ? [b.messageId] : []))));
      })
      .catch(() => {});
  }, [authService, moduleKey]));

  const toggleBookmark = useCallback(async (messageId: string) => {
    const wasBookmarked = bookmarkedIds.has(messageId);
    const setBookmarked = (on: boolean) => setBookmarkedIds(prev => {
      const next = new Set(prev);
      if (on) next.add(messageId); else next.delete(messageId);
      return next;
    });
    setBookmarked(!wasBookmarked);
    amplitudeService.trackEvent(wasBookmarked ? 'Chat Bookmark Removed' : 'Chat Bookmark Added', { chat: 'module_coach', moduleKey });
    try {
      const response = wasBookmarked
        ? await authService.authenticatedRequest(`${API_URL}/api/coach/bookmarks/${messageId}`, { method: 'DELETE' })
        : await authService.authenticatedRequest(`${API_URL}/api/coach/bookmarks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId, moduleKey }),
          });
      if (!response.ok) throw new Error(`Server error ${response.status}`);
    } catch (err) {
      setBookmarked(wasBookmarked);
      reportError(err, 'ModuleChatScreen.toggleBookmark');
    }
  }, [bookmarkedIds, authService, moduleKey]);

  // Load history (cache-first), then long-poll for new messages
  useEffect(() => {
    let cancelled = false;
    let since = '';

    async function init() {
      // 1. Load cache — display instantly
      const [cached, user] = await Promise.all([
        loadMessageCache(),
        authService.getCurrentUser().catch(() => null),
      ]);
      if (cancelled) return;

      if (user) {
        setParentName(user.name?.split(' ')[0] ?? '');
        setChildName(user.childName ?? '');
      }

      if (cached.length > 0) {
        setMessages(cached);
        since = cached[cached.length - 1].createdAt!;
      }

      // 2. Fetch messages newer than last cached (or full history if no cache)
      try {
        const historyUrl = since
          ? `${API_URL}/api/coach/history?since=${encodeURIComponent(since)}`
          : `${API_URL}/api/coach/history`;
        const r = await authService.authenticatedRequest(historyUrl);
        const data: { messages: Array<{ id: string; role: string; text: string; createdAt: string }> } = await r.json();
        if (cancelled) return;

        if (data.messages?.length > 0) {
          const incoming = data.messages as Array<Message & { createdAt: string }>;
          setMessages(prev => {
            const base = prev.length === 0 ? cached : prev;
            const existingIds = new Set(base.map(m => m.id));
            const merged = [...base, ...incoming.filter(m => !existingIds.has(m.id))];
            saveMessageCache(merged);
            return merged.length > 0 ? merged : prev;
          });
          const lastTs = incoming[incoming.length - 1].createdAt;
          since = lastTs;
          latestServerTsRef.current = lastTs;
          markAiAsRead(lastTs);
        } else if (cached.length > 0) {
          latestServerTsRef.current = since;
          markAiAsRead(since);
        } else {
          // No cache and no server messages: a first-time parent (no report
          // yet) gets Nora's opening message, written from their onboarding
          // answers. The server skips it otherwise; then show the guide.
          const opener = await fetchOpener();
          if (cancelled) return;
          if (opener) {
            setMessages([opener]);
            saveMessageCache([opener]);
            since = opener.createdAt!;
            latestServerTsRef.current = since;
            markAiAsRead(since);
          } else {
            setShowGuide(true);
            pinToBottomRef.current = false;
            setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: false }), 50);
          }
        }
      } catch {
        if (cached.length === 0) {
          setShowGuide(true);
          pinToBottomRef.current = false;
          setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: false }), 50);
        }
      }

      if (!cancelled) {
        setHistoryLoaded(true);
        startPolling();
      }
    }

    async function fetchOpener(): Promise<Message | null> {
      setLoading(true);
      try {
        const r = await authService.authenticatedRequest(`${API_URL}/api/coach/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ moduleKey, locale: i18n.language }),
        });
        if (!r.ok) return null;
        const data: { message?: Message } = await r.json();
        if (data.message) amplitudeService.trackEvent('Chat Opener Shown', { chat: 'module_coach', moduleKey });
        return data.message ?? null;
      } catch {
        return null;
      } finally {
        setLoading(false);
        setStatusText(null);
      }
    }

    // 3. Long-poll loop — holds until server pushes or 25s timeout
    function startPolling() {
      if (cancelled) return;
      authService.authenticatedRequest(
        `${API_URL}/api/coach/events?since=${encodeURIComponent(since)}`
      )
        .then(r => r.json())
        .then((data: { messages: Array<{ id?: string; role?: string; text: string; createdAt?: string; type?: string }> }) => {
          if (cancelled) return;
          if (data.messages && data.messages.length > 0) {
            const statusEvent = data.messages.find(m => m.type === 'status');
            const realMessages = data.messages.filter(m => m.type !== 'status') as Message[];

            if (statusEvent) setStatusText(statusEvent.text);

            if (realMessages.length > 0) {
              setStatusText(null);
              setMessages(prev => {
                // Strip optimistic messages now that server confirms the real ones
                const base = prev.filter(m => !m.id.startsWith('opt-'));
                const existingIds = new Set(base.map(m => m.id));
                const newOnes = realMessages.filter(m => !existingIds.has(m.id!));
                if (newOnes.length === 0) return prev;
                const updated = [...base, ...newOnes];
                saveMessageCache(updated);
                return updated;
              });
              const lastTs = realMessages[realMessages.length - 1].createdAt!;
              since = lastTs;
              latestServerTsRef.current = lastTs;
              markAiAsRead(lastTs);
            }
          }
        })
        .catch(() => {})
        .finally(() => startPolling());
    }

    init();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The keyboard stays up while chatting (sending doesn't dismiss it; the
  // parent closes it by dragging the list). When it opens, keep the latest
  // message just above it.
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (pinToBottomRef.current && !showGuide) scrollToEnd();
    });
    return () => sub.remove();
  }, [showGuide, scrollToEnd]);

  // Shows outgoing messages optimistically (replaced by the real ones when the
  // long-poll delivers them). The list stays pinned to the bottom like a
  // normal chat (no sliding the new message up to the top).
  const showOutgoing = useCallback((outgoing: Array<Pick<Message, 'role' | 'text'>>) => {
    setShowGuide(false);
    pinToBottomRef.current = true;
    setChattedThisVisit(true);

    const stamp = Date.now();
    const optimistic: Message[] = outgoing.map((m, i) => ({
      id: `opt-${stamp}-${i}`,
      role: m.role,
      text: m.text,
      createdAt: new Date(stamp + i).toISOString(),
    }));
    setMessages(prev => {
      optimisticIndexRef.current = prev.length;
      return [...prev, ...optimistic];
    });
    scrollToEnd();
    return optimistic.map(m => m.id);
  }, [scrollToEnd]);

  const sendText = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) return;

    amplitudeService.trackEvent('Chat Message Sent', { chat: 'module_coach', moduleKey });
    setLoading(true);
    const [optimisticId] = showOutgoing([{ role: 'user', text }]);

    try {
      const response = await authService.authenticatedRequest(
        `${API_URL}/api/coach/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, locale: i18n.language, moduleKey }),
        }
      );

      if (!response.ok) throw new Error(`Server error ${response.status}`);
      // Messages (user + AI) are delivered via the long-poll loop when publish() fires
    } catch (err) {
      amplitudeService.trackEvent('Chat Send Error', { chat: 'module_coach', moduleKey, error: err instanceof Error ? err.message : String(err) });
      setMessages(prev => [
        ...prev.filter(m => m.id !== optimisticId),
        { id: Date.now().toString(), role: 'model', text: t('coachChat.errorConnection') },
      ]);
      scrollToEnd();
    } finally {
      setLoading(false);
      setStatusText(null);
    }
  }, [loading, showOutgoing, scrollToEnd, authService, moduleKey, i18n.language, t]);

  // Fixed chat turns (no LLM): saved to the history via /api/coach/scripted,
  // so the coach continues from them on the parent's next message.
  const sendScripted = useCallback(async (turns: Array<Pick<Message, 'role' | 'text'>>) => {
    if (loading) return;
    const optimisticIds = showOutgoing(turns);
    try {
      const response = await authService.authenticatedRequest(
        `${API_URL}/api/coach/scripted`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: turns }),
        }
      );
      if (!response.ok) throw new Error(`Server error ${response.status}`);
    } catch (err) {
      amplitudeService.trackEvent('Chat Send Error', { chat: 'module_coach', moduleKey, scripted: true, error: err instanceof Error ? err.message : String(err) });
      setMessages(prev => [
        ...prev.filter(m => !optimisticIds.includes(m.id)),
        { id: Date.now().toString(), role: 'model', text: t('coachChat.errorConnection') },
      ]);
      scrollToEnd();
    }
  }, [loading, showOutgoing, scrollToEnd, authService, moduleKey, t]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    if (GREETING_RE.test(text)) {
      amplitudeService.trackEvent('Chat Greeting Answered', { chat: 'module_coach', moduleKey });
      // Before any report there are no strategies to ask about yet.
      const reply = t(suggestedStrategies.length > 0 ? 'moduleChat.greetingReply' : 'moduleChat.firstTime.greetingReply',
        { name: parentName, childName: childLabel });
      // Without a name: "Hi !" → "Hi!" (en) / "你好" stays as is (zh).
      sendScripted([{ role: 'user', text }, { role: 'model', text: reply.replace(/^Hi !/, 'Hi!') }]);
      return;
    }
    sendText(input);
  }, [input, loading, sendText, sendScripted, parentName, childLabel, suggestedStrategies.length, moduleKey, t]);

  // Chips under the coach's latest message: its OPTIONS line, or the fixed
  // options of its offer (OFFER line — special play time).
  const visibleMessages = messages.filter(m => m.role !== 'psychologist' && m.role !== 'user_psych');
  const lastMessage = visibleMessages[visibleMessages.length - 1];
  const lastReply = !loading && !showGuide && lastMessage?.role === 'model' ? parseQuickReplies(lastMessage.text) : null;
  const offerYes = t('moduleChat.specialPlay.yes');
  const offerMore = t('moduleChat.specialPlay.moreInfo');
  const offerNo = t('moduleChat.specialPlay.notNow');
  const specialPlayOffer = lastReply?.offer === 'special_play';
  const quickReplies = specialPlayOffer ? [offerYes, offerMore, offerNo] : lastReply?.options ?? [];

  // Strategy check-in, opening round — fixed lines, no LLM: tapping a strategy
  // asks whether they've tried it (two chips); each chip gets a fixed
  // follow-up asking for details. The parent's typed answer goes to the coach
  // (see STRATEGY CHECK-IN in server/prompts/coach-screentime.txt).
  const checkInTried = t('moduleChat.checkIn.tried');
  const checkInClarify = t('moduleChat.checkIn.clarify');
  const checkInReplies: Record<string, string> = {
    [checkInTried]: t('moduleChat.checkIn.triedReply', { childName: childName || t('coachChat.yourChild') }),
    [checkInClarify]: t('moduleChat.checkIn.clarifyReply'),
  };
  // Waiting for the parent's details after a fixed follow-up — no strategy row.
  const awaitingDetails = lastMessage?.role === 'model' && Object.values(checkInReplies).includes(lastMessage.text);
  // Once the chat has history the welcome ideas are gone — offer the
  // suggested strategies as a chip row above the input instead.
  const showStrategyRow = !showGuide && !loading && !awaitingDetails && quickReplies.length === 0 && suggestedStrategies.length > 0;

  const sendStrategy = useCallback((name: string, source: string) => {
    amplitudeService.trackEvent('Chat Suggestion Used', { chat: 'module_coach', moduleKey, suggestion: name, source });
    sendScripted([
      { role: 'user', text: t('moduleChat.strategyPrompt', { strategy: name }) },
      { role: 'model', text: `${t('moduleChat.checkIn.question', { strategy: name })}\nOPTIONS: ${checkInTried} | ${checkInClarify}` },
    ]);
  }, [moduleKey, sendScripted, t, checkInTried, checkInClarify]);

  // "Chat about latest session": on entry, when a session was recorded after
  // the last chat message (or there's no chat yet). Gone once they send anything.
  const showLatestSessionChip = historyLoaded && !!latestSessionAt && !chattedThisVisit && !loading
    && !(lastMessage?.createdAt && new Date(lastMessage.createdAt) > new Date(latestSessionAt));
  const latestSessionChip = showLatestSessionChip ? (
    <TouchableOpacity
      style={styles.latestChip}
      onPress={() => {
        amplitudeService.trackEvent('Chat Latest Session Used', { chat: 'module_coach', moduleKey });
        sendText(t('moduleChat.latestSessionPrompt'));
      }}
      activeOpacity={0.8}
    >
      <Ionicons name="sparkles" size={16} color="#fff" />
      <Text style={styles.latestChipText}>{t('moduleChat.latestSessionLabel')}</Text>
    </TouchableOpacity>
  ) : null;

  // Special play time offer, "Yes, add it" / "Not now": saved first (yes adds
  // the Play time card to Today), then a fixed reply — no LLM. "Tell me more
  // first" goes to the coach, which explains and offers again.
  const answerSpecialPlayOffer = useCallback(async (option: string, response: 'accepted' | 'declined') => {
    if (loading) return;
    amplitudeService.trackEvent('Special Play Offer Answered', { chat: 'module_coach', moduleKey, response, via: 'chip' });
    setLoading(true);
    try {
      const res = await authService.authenticatedRequest(`${API_URL}/api/learn-modules/${moduleKey}/special-play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
    } catch (err) {
      reportError(err, 'ModuleChatScreen.answerSpecialPlayOffer');
      Alert.alert(t('common.error'), t('coachChat.errorConnection'));
      return;
    } finally {
      setLoading(false);
    }
    const reply = response === 'accepted'
      ? t('moduleChat.specialPlay.addedReply', { childName: childName || t('coachChat.yourChild') })
      : t('moduleChat.specialPlay.declinedReply');
    sendScripted([{ role: 'user', text: option }, { role: 'model', text: reply }]);
  }, [loading, authService, moduleKey, childName, sendScripted, t]);

  const handleQuickReply = useCallback((option: string) => {
    amplitudeService.trackEvent('Chat Quick Reply Used', { chat: 'module_coach', moduleKey, option });
    if (specialPlayOffer && option === offerYes) return answerSpecialPlayOffer(option, 'accepted');
    if (specialPlayOffer && option === offerNo) return answerSpecialPlayOffer(option, 'declined');
    const fixedReply = checkInReplies[option];
    if (fixedReply) {
      sendScripted([{ role: 'user', text: option }, { role: 'model', text: fixedReply }]);
    } else {
      sendText(option);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey, sendScripted, sendText, checkInTried, checkInClarify, childName, specialPlayOffer, offerYes, offerNo, answerSpecialPlayOffer]);

  const handleRequestHuman = useCallback(() => {
    amplitudeService.trackEvent('Coach Chat Human Request Tapped');
    if (psychRequested) {
      navigation.navigate('PsychologistChat');
    } else {
      setAgreedToTerms(false);
      setShowHumanModal(true);
    }
  }, [psychRequested, navigation]);

  const handleSubmitHuman = useCallback(async () => {
    if (!agreedToTerms) return;
    setSubmittingHuman(true);
    try {
      const user = await authService.getCurrentUser();
      await authService.authenticatedRequest(
        `${API_URL}/api/support/request`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            description: 'Parent is requesting to speak with a human child psychologist via the Nora Coach chat.',
          }),
        }
      );
      setShowHumanModal(false);
      await userStorage.setItem(PSYCH_REQUESTED_KEY, 'true');
      setPsychRequested(true);
      amplitudeService.trackEvent('Psychologist Requested', {});
      navigation.navigate('PsychologistChat');
    } catch (err) {
      reportError(err, 'ModuleChatScreen.ModuleChatScreen');
      amplitudeService.trackEvent('Psychologist Request Error', { error: err instanceof Error ? err.message : String(err) });
      Alert.alert(t('common.error'), t('coachChat.errorSendRequest'));
    } finally {
      setSubmittingHuman(false);
    }
  }, [agreedToTerms, authService, navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TrackedTouchable analyticsId="Back" onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-down" size={26} color={COLORS.textDark} />
        </TrackedTouchable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('coachChat.headerTitle')}</Text>
          <Text style={styles.headerSub}>{t('coachChat.headerSub')}</Text>
        </View>
        {/* "Talk to a psychologist" is hidden in the module chat (it's the only
            entry to the psychologist request modal below). Bookmarks instead —
            the same width as the back arrow keeps the title centered. */}
        <TrackedTouchable
          analyticsId="Module Chat Bookmarks"
          onPress={() => navigation.navigate('ModuleChatBookmarks', { moduleKey })}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel={t('moduleChat.bookmarks.title')}
        >
          <Ionicons name="bookmarks-outline" size={24} color={COLORS.textDark} style={styles.headerSpacer} />
        </TrackedTouchable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={showGuide ? [] : visibleMessages}
          keyExtractor={m => m.id}
          renderItem={({ item }) => (
            <Bubble
              message={item}
              bookmarked={bookmarkedIds.has(item.id)}
              onToggleBookmark={isBookmarkable(item) ? () => toggleBookmark(item.id) : undefined}
            />
          )}
          extraData={bookmarkedIds}
          ListHeaderComponent={showGuide ? (
            <View style={styles.guideContainer}>
              <Video
                source={require('../../assets/images/Dragon_anime2.mov')}
                style={styles.guideVideo}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping
                isMuted
              />
              {/* Welcome text introduces the ideas below: the last session's
                  strategies, or (before any report) the coach chat's greeting. */}
              {latestSessionChip}
              {suggestedStrategies.length > 0 ? (
                <Text style={[styles.guideTitle, styles.suggestedTitle]}>{t('moduleChat.suggestedLabel')}</Text>
              ) : (
                <>
                  <Text style={styles.guideTitle}>
                    {parentName ? t('coachChat.greetingWithName', { name: parentName }) : t('coachChat.greetingDefault')}
                  </Text>
                  <Text style={styles.guideSubtitle}>
                    {t('moduleChat.firstTime.guideSubtitle', { childName: childLabel })}
                  </Text>
                </>
              )}
              <View style={styles.suggestionsGrid}>
                {SUGGESTIONS.map(s => (
                  <TouchableOpacity
                    key={s.title}
                    style={styles.suggestionCard}
                    onPress={() => {
                      if (s.isStrategy) {
                        sendStrategy(s.title, 'welcome');
                        return;
                      }
                      amplitudeService.trackEvent('Chat Suggestion Used', { chat: 'module_coach', moduleKey, suggestion: s.title });
                      sendText(s.prompt);
                    }}
                    activeOpacity={0.75}
                  >
                    <Image source={s.image} style={styles.suggestionIcon} />
                    <View style={styles.suggestionText}>
                      <Text style={styles.suggestionCardTitle}>{s.title}</Text>
                      <Text style={styles.suggestionCardSubtitle}>{s.subtitle}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
          // Messages stack up from the input bar, not down from the header.
          contentContainerStyle={[styles.messageList, !showGuide && styles.messageListBottom]}
          // Taps on chips/cards work with the keyboard up; dragging the list closes it.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onContentSizeChange={() => {
            if (pinToBottomRef.current && !showGuide) scrollToEnd(false);
          }}
          maintainVisibleContentPosition={showGuide ? undefined : { minIndexForVisible: 0 }}
          ListFooterComponent={
            <>
              {!showGuide && latestSessionChip}
              {quickReplies.length > 0 && (
                <View style={styles.quickReplies}>
                  {quickReplies.map(option => (
                    <TouchableOpacity
                      key={option}
                      style={styles.quickReplyChip}
                      onPress={() => handleQuickReply(option)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.quickReplyText}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {loading && (
                <View style={styles.typingRow}>
                  <View style={styles.avatarWrap}>
                    <Text style={styles.avatarN}>N</Text>
                  </View>
                  <View style={styles.typingBubble}>
                    {statusText
                      ? <AnimatedStatusText text={statusText} style={styles.statusText} />
                      : <ActivityIndicator size="small" color={COLORS.mainPurple} />
                    }
                  </View>
                </View>
              )}
            </>
          }
        />

        {/* Suggested strategies, once the welcome ideas are gone */}
        {showStrategyRow && (
          <View style={styles.strategyRow}>
            <Text style={styles.strategyRowLabel}>{t('moduleChat.strategiesLabel')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.strategyRowChips}
              keyboardShouldPersistTaps="handled"
            >
              {suggestedStrategies.map(strategy => (
                <TouchableOpacity
                  key={strategy.name}
                  style={styles.strategyChip}
                  onPress={() => sendStrategy(strategy.name, 'strategy_row')}
                  activeOpacity={0.75}
                >
                  <Text style={styles.strategyChipText} numberOfLines={1}>{strategy.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('coachChat.inputPlaceholder')}
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TrackedTouchable analyticsId="Send"
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </TrackedTouchable>
        </View>
      </KeyboardAvoidingView>

      {/* Talk to a Psychologist modal — inline T&C view switching */}
      <Modal
        visible={showHumanModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowHumanModal(false); setShowTerms(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, showTerms && { maxHeight: '85%' }]}>
            {showTerms ? (
              /* ── T&C view ── */
              <>
                <View style={styles.termsHeader}>
                  <TrackedTouchable analyticsId="Close Terms" onPress={() => setShowTerms(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="arrow-back" size={22} color={COLORS.textDark} />
                  </TrackedTouchable>
                  <Text style={[styles.modalTitle, { marginBottom: 0, flex: 1, marginLeft: 10 }]}>{t('coachChat.terms.title')}</Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <Text style={styles.termsSection}>{t('coachChat.terms.section1Title')}</Text>
                  <Text style={styles.termsBody}>{t('coachChat.terms.section1Body')}</Text>

                  <Text style={styles.termsSection}>{t('coachChat.terms.section2Title')}</Text>
                  <Text style={styles.termsBody}>{t('coachChat.terms.section2Body')}</Text>
                  <Text style={styles.termsBullet}>{t('coachChat.terms.section2Bullet1')}</Text>
                  <Text style={styles.termsBullet}>{t('coachChat.terms.section2Bullet2')}</Text>
                  <Text style={styles.termsBullet}>{t('coachChat.terms.section2Bullet3')}</Text>
                  <Text style={styles.termsBullet}>{t('coachChat.terms.section2Bullet4')}</Text>

                  <Text style={styles.termsSection}>{t('coachChat.terms.section3Title')}</Text>
                  <Text style={styles.termsBody}>{t('coachChat.terms.section3Body')}</Text>

                  <Text style={styles.termsSection}>{t('coachChat.terms.section4Title')}</Text>
                  <Text style={styles.termsBody}>{t('coachChat.terms.section4Body')}</Text>

                  <Text style={styles.termsSection}>{t('coachChat.terms.section5Title')}</Text>
                  <Text style={styles.termsBody}>{t('coachChat.terms.section5Body')}</Text>

                  <Text style={styles.termsSection}>{t('coachChat.terms.section6Title')}</Text>
                  <Text style={styles.termsBody}>{t('coachChat.terms.section6Body')}</Text>
                </ScrollView>

                <View style={styles.modalActions}>
                  <TrackedTouchable analyticsId="coachChat.iUnderstand" style={styles.modalConfirm} onPress={() => setShowTerms(false)} activeOpacity={0.8}>
                    <Text style={styles.modalConfirmText}>{t('coachChat.iUnderstand')}</Text>
                  </TrackedTouchable>
                </View>
              </>
            ) : (
              /* ── Request view ── */
              <>
                <Text style={styles.modalTitle}>{t('coachChat.talkToPsychologist')}</Text>
                <Text style={styles.modalBody}>{t('coachChat.psychologistReplyTime')}</Text>

                {/* Terms checkbox */}
                <TrackedTouchable analyticsId="coachChat.agreeToTerms"
                  style={styles.checkRow}
                  onPress={() => setAgreedToTerms(v => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                    {agreedToTerms && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                  <Text style={styles.checkLabel}>{t('coachChat.agreeToTerms')}</Text>
                </TrackedTouchable>
                <TrackedTouchable analyticsId="coachChat.readTerms" onPress={() => setShowTerms(true)} activeOpacity={0.7} style={styles.termsLink}>
                  <Text style={styles.checkLabelLink}>{t('coachChat.readTerms')}</Text>
                </TrackedTouchable>

                {/* Actions */}
                <View style={styles.modalActions}>
                  <TrackedTouchable analyticsId="common.cancel"
                    style={styles.modalCancel}
                    onPress={() => { setShowHumanModal(false); setShowTerms(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
                  </TrackedTouchable>
                  <TrackedTouchable analyticsId="coachChat.sendRequest"
                    style={[styles.modalConfirm, (!agreedToTerms || submittingHuman) && styles.modalConfirmDisabled]}
                    onPress={handleSubmitHuman}
                    disabled={!agreedToTerms || submittingHuman}
                    activeOpacity={0.8}
                  >
                    {submittingHuman
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.modalConfirmText}>{t('coachChat.sendRequest')}</Text>
                    }
                  </TrackedTouchable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  humanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3EEFF',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  humanBtnText: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: COLORS.mainPurple,
  },
  psychBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    marginLeft: 2,
  },
  psychBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: FONTS.bold,
    lineHeight: 13,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: { width: 26, textAlign: 'right' },
  bookmarkButton: { alignSelf: 'flex-start', marginTop: 4, marginLeft: 6 },
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

  // Messages
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  messageListBottom: {
    flexGrow: 1,
    justifyContent: 'flex-end',
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
  bubbleRowModel: {
    justifyContent: 'flex-start',
  },
  avatarWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.mainPurple,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarWrapPsych: {
    backgroundColor: '#0EA5E9',
  },
  avatarN: {
    color: '#fff',
    fontSize: 14,
    fontFamily: FONTS.bold,
    lineHeight: 17,
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
  bubbleModel: {
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
  bubbleTextModel: {
    fontFamily: FONTS.regular,
    color: COLORS.textDark,
  },

  // Typing
  typingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  typingBubble: {
    backgroundColor: '#F3F4F6',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  statusText: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
  },

  // Input bar
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
    backgroundColor: COLORS.mainPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },

  // Talk to Psychologist modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textDark,
    marginBottom: 10,
  },
  modalBody: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 21,
    marginBottom: 20,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: COLORS.mainPurple,
    borderColor: COLORS.mainPurple,
  },
  checkLabel: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: COLORS.textDark,
    lineHeight: 19,
  },
  checkLabelLink: {
    fontFamily: FONTS.semiBold,
    color: COLORS.mainPurple,
  },
  termsLink: {
    marginTop: -12,
    marginBottom: 20,
    marginLeft: 32,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  modalCancelText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#6B7280',
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 18,
    borderRadius: 100,
    backgroundColor: COLORS.mainPurple,
    alignItems: 'center',
  },
  modalConfirmDisabled: {
    backgroundColor: '#D1D5DB',
  },
  modalConfirmText: {
    fontFamily: FONTS.semiBold,
    fontSize: 15,
    color: '#fff',
  },

  // T&C modal
  termsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  termsSection: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    color: COLORS.textDark,
    marginTop: 16,
    marginBottom: 6,
  },
  termsBody: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 4,
  },
  termsBullet: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 20,
    paddingLeft: 8,
  },

  // Guide (empty state)
  guideContainer: {
    paddingHorizontal: 8,
    paddingTop: 20,
    paddingBottom: 8,
  },
  guideVideo: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 12,
  },
  guideTitle: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  // No subtitle under it, so it carries the gap before the ideas itself.
  suggestedTitle: { marginBottom: 20 },


  // ── "Chat about latest session" ──
  latestChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.mainPurple,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
  },
  latestChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: '#fff',
  },
  guideSubtitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textDark, 
    textAlign: 'center',
    lineHeight: 25,
    marginBottom: 24,
  },
  // One idea per row: icon on the left, title + prompt on the right.
  suggestionsGrid: {
    gap: 10,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  suggestionText: { flex: 1, gap: 2 },
  suggestionCardTitle: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.textDark,
    lineHeight: 18,
  },
  suggestionCardSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 17,
  },

  // ── Quick replies (under the coach's latest message, aligned with its bubble) ──
  quickReplies: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginLeft: 36, // avatar 28 + gap 8
    marginBottom: 12,
  },
  quickReplyChip: {
    borderWidth: 1.5,
    borderColor: COLORS.mainPurple,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  quickReplyText: {
    fontFamily: FONTS.semiBold,
    fontSize: 14,
    color: COLORS.mainPurple,
  },

  // ── Suggested strategies row (above the input) ──
  strategyRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#fff',
  },
  strategyRowLabel: {
    fontFamily: FONTS.semiBold,
    fontSize: 12,
    color: '#6B7280',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  strategyRowChips: {
    gap: 8,
    paddingHorizontal: 16,
  },
  strategyChip: {
    maxWidth: 240,
    backgroundColor: '#F1EBFB',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  strategyChipText: {
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    color: COLORS.mainPurple,
  },
});
