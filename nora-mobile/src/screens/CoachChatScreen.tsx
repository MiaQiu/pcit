/**
 * Coach Chat Screen
 * AI parenting coach — calls backend /api/coach/chat (Gemini via LLM gateway)
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
  SafeAreaView,
  Alert,
  Modal,
  ScrollView,
  Keyboard,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video, ResizeMode } from 'expo-av';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { useAuthService } from '../contexts/AppContext';
import { useCoachUnread } from '../contexts/CoachUnreadContext';

const PSYCH_REQUESTED_KEY = '@nora_psych_requested';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Message cache (past 2 days including today) ──────────────────────────────

const CACHE_KEY = '@nora_coach_messages_cache';

function twoDaysAgo(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 2);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function loadMessageCache(): Promise<Message[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const msgs: Message[] = JSON.parse(raw);
    const cutoff = twoDaysAgo();
    return msgs.filter(m => m.createdAt && new Date(m.createdAt) >= cutoff);
  } catch {
    return [];
  }
}

async function saveMessageCache(messages: Message[]): Promise<void> {
  try {
    const cutoff = twoDaysAgo();
    const toSave = messages.filter(m => m.createdAt && new Date(m.createdAt) >= cutoff);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(toSave));
  } catch {}
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'model' | 'psychologist' | 'user_psych';
  text: string;
  createdAt?: string;
}

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

const Bubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';
  const isPsychologist = message.role === 'psychologist';
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
          <Text style={styles.psychLabel}>Psychologist</Text>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleModel]}>
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextModel]}>
            {message.text}
          </Text>
        </View>
      </View>
    </View>
  );
};

// ─── Guide suggestions (shown when chat is empty) ────────────────────────────

const SUGGESTIONS = [
  { image: require('../../assets/images/green-energy.png'), title: 'Understand My Child',    prompt: 'Why is my child acting this way?' },
  { image: require('../../assets/images/air-heater.png'), title: 'What Should I Do Now',   prompt: 'What do I do in this situation?' },
  { image: require('../../assets/images/rating.png'), title: 'Parent with Confidence', prompt: 'Am I handling this the right way?' },
  { image: require('../../assets/images/planning.png'), title: 'My Nora Plan',         prompt: 'Explain my coaching tips & what to focus on' },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export const CoachChatScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const authService = useAuthService();
  const { markAiAsRead, psychUnreadCount } = useCoachUnread();
  const flatListRef = useRef<FlatList>(null);
  const latestServerTsRef = useRef<string | undefined>(undefined);
  const optimisticIndexRef = useRef<number>(0);
  const prevContentHeightRef = useRef(0);
  const pinToBottomRef = useRef(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [showHumanModal, setShowHumanModal] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submittingHuman, setSubmittingHuman] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [psychRequested, setPsychRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [flatListHeight, setFlatListHeight] = useState(600);
  const [showSpacer, setShowSpacer] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [parentName, setParentName] = useState('');
  const [childName, setChildName] = useState('');

  const scrollToEnd = useCallback((animated = true) => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 100);
  }, []);

  // Load psych-requested flag on mount
  useEffect(() => {
    AsyncStorage.getItem(PSYCH_REQUESTED_KEY).then(v => {
      if (v === 'true') setPsychRequested(true);
    });
  }, []);

  // Clear AI unread badge on exit
  useEffect(() => {
    return () => { markAiAsRead(latestServerTsRef.current); };
  }, [markAiAsRead]);

  // Load history (cache-first), then long-poll for new messages
  useEffect(() => {
    let cancelled = false;
    let since = new Date().toISOString();

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
      } else {
        since = twoDaysAgo().toISOString();
      }

      // 2. Fetch only messages newer than last cached from server
      try {
        const r = await authService.authenticatedRequest(
          `${API_URL}/api/coach/history?since=${encodeURIComponent(since)}`
        );
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
          // No cache and no server messages — show the guide
          setShowGuide(true);
          pinToBottomRef.current = false;
          setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: false }), 50);
        }
      } catch {
        if (cached.length === 0) {
          setShowGuide(true);
          pinToBottomRef.current = false;
          setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: false }), 50);
        }
      }

      if (!cancelled) startPolling();
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

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);
    Keyboard.dismiss();

    setShowGuide(false);

    // Stop auto-pinning to bottom; we'll control scroll manually from here
    pinToBottomRef.current = false;

    // scrollTarget = top of where the new message will appear.
    // If spacer is already shown, prevContentHeightRef includes its height — subtract it.
    const scrollTarget = Math.max(0, prevContentHeightRef.current - (showSpacer ? flatListHeight : 0) - 16);
    if (!showSpacer) setShowSpacer(true); // persist for the whole session — never remove

    const optimisticId = `opt-${Date.now()}`;
    const optimisticMsg: Message = { id: optimisticId, role: 'user', text, createdAt: new Date().toISOString() };
    setMessages(prev => {
      optimisticIndexRef.current = prev.length;
      return [...prev, optimisticMsg];
    });
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: scrollTarget, animated: true });
    }, 150);

    try {
      const response = await authService.authenticatedRequest(
        `${API_URL}/api/coach/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        }
      );

      if (!response.ok) throw new Error(`Server error ${response.status}`);
      // Messages (user + AI) are delivered via the long-poll loop when publish() fires
    } catch {
      setMessages(prev => [
        ...prev.filter(m => m.id !== optimisticId),
        { id: Date.now().toString(), role: 'model', text: 'Something went wrong. Please check your connection and try again.' },
      ]);
      scrollToEnd();
    } finally {
      setLoading(false);
      setStatusText(null);
    }
  }, [input, loading, scrollToEnd, authService]);

  const handleRequestHuman = useCallback(() => {
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
      await AsyncStorage.setItem(PSYCH_REQUESTED_KEY, 'true');
      setPsychRequested(true);
      navigation.navigate('PsychologistChat');
    } catch {
      Alert.alert('Error', 'Failed to send request. Please try again.');
    } finally {
      setSubmittingHuman(false);
    }
  }, [agreedToTerms, authService, navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-down" size={26} color={COLORS.textDark} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Nora Coach</Text>
          <Text style={styles.headerSub}>AI Parenting Coach</Text>
        </View>
        <TouchableOpacity onPress={handleRequestHuman} activeOpacity={0.7} style={styles.humanBtn}>
          <Ionicons name="person-circle-outline" size={16} color={COLORS.mainPurple} />
          <Text style={styles.humanBtnText}>Talk to a Psychologist</Text>
          {psychUnreadCount > 0 && (
            <View style={styles.psychBadge}>
              <Text style={styles.psychBadgeText}>{psychUnreadCount > 9 ? '9+' : psychUnreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={showGuide ? [] : messages.filter(m => m.role !== 'psychologist' && m.role !== 'user_psych')}
          keyExtractor={m => m.id}
          renderItem={({ item }) => <Bubble message={item} />}
          ListHeaderComponent={showGuide ? (
            <View style={styles.guideContainer}>
              <Video
                source={require('../../assets/images/Dragon_anime.mov')}
                style={styles.guideVideo}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay
                isLooping
                isMuted
              />
              <Text style={styles.guideTitle}>
                {parentName ? `Hi ${parentName}!` : 'Hi there!'}
              </Text>
              <Text style={styles.guideSubtitle}>
                {`Let's support ${childName || 'your child'} today.\nHere's a few ideas for you:`}
              </Text>
              <View style={styles.suggestionsGrid}>
                {SUGGESTIONS.map(s => (
                  <TouchableOpacity
                    key={s.title}
                    style={styles.suggestionCard}
                    onPress={() => setInput(s.prompt)}
                    activeOpacity={0.75}
                  >
                    <Image source={s.image} style={styles.suggestionIcon} />
                    <Text style={styles.suggestionCardTitle}>{s.title}</Text>
                    <Text style={styles.suggestionCardSubtitle}>{s.prompt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}
          contentContainerStyle={styles.messageList}
          onLayout={(e) => setFlatListHeight(e.nativeEvent.layout.height)}
          onContentSizeChange={(_, h) => {
            if (pinToBottomRef.current && !showGuide) scrollToEnd(false);
            prevContentHeightRef.current = h;
          }}
          maintainVisibleContentPosition={showGuide ? undefined : { minIndexForVisible: 0 }}
          ListFooterComponent={
            <>
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
              {showSpacer && <View style={{ height: flatListHeight }} />}
            </>
          }
        />

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask Nora anything…"
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up" size={20} color="#fff" />
          </TouchableOpacity>
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
                  <TouchableOpacity onPress={() => setShowTerms(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="arrow-back" size={22} color={COLORS.textDark} />
                  </TouchableOpacity>
                  <Text style={[styles.modalTitle, { marginBottom: 0, flex: 1, marginLeft: 10 }]}>Terms and Conditions</Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <Text style={styles.termsSection}>1. Purpose</Text>
                  <Text style={styles.termsBody}>
                    By requesting to speak with a psychologist, you are asking Nora to connect you with a qualified child psychologist from our team. This service is provided to offer additional professional support beyond the AI coaching available in the app.
                  </Text>

                  <Text style={styles.termsSection}>2. Information We Share</Text>
                  <Text style={styles.termsBody}>
                    To enable the psychologist to provide you with informed, personalised support, the following information will be shared with them:
                  </Text>
                  <Text style={styles.termsBullet}>- Your name and email address</Text>
                  <Text style={styles.termsBullet}>- Your child's name, age, and gender</Text>
                  <Text style={styles.termsBullet}>- Your child's behavioural assessment results, including primary and secondary concerns identified during onboarding</Text>
                  <Text style={styles.termsBullet}>- Your Nora Coach chat history</Text>
                  <Text style={styles.termsBullet}>- A summary of your recent emotional massage session activity</Text>

                  <Text style={styles.termsSection}>3. How It Is Used</Text>
                  <Text style={styles.termsBody}>
                    This information is used solely for the purpose of your consultation. The psychologist will review it before reaching out so that they can provide relevant, context-aware guidance without requiring you to repeat background information.
                  </Text>

                  <Text style={styles.termsSection}>4. Confidentiality</Text>
                  <Text style={styles.termsBody}>
                    All information shared is kept strictly confidential within our clinical team. It will not be disclosed to third parties, sold, or used for marketing purposes. Our team operates under professional confidentiality obligations consistent with child psychology practice standards.
                  </Text>

                  <Text style={styles.termsSection}>5. Response Time</Text>
                  <Text style={styles.termsBody}>
                    Our psychologist team will contact you via email within 2 business days. This service is not intended for emergencies. If you or your child are in immediate distress, please contact your local emergency services or a crisis helpline.
                  </Text>

                  <Text style={styles.termsSection}>6. Your Consent</Text>
                  <Text style={styles.termsBody}>
                    By ticking the checkbox and submitting this request, you confirm that you have read and understood these terms and give your informed consent for the above information to be shared with our psychologist team.
                  </Text>
                </ScrollView>

                <TouchableOpacity style={styles.modalConfirm} onPress={() => setShowTerms(false)} activeOpacity={0.8}>
                  <Text style={styles.modalConfirmText}>I Understand</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* ── Request view ── */
              <>
                <Text style={styles.modalTitle}>Talk to a Psychologist</Text>
                <Text style={styles.modalBody}>
                  Our child psychologist team will be notified and will reach out to you shortly via email.
                </Text>

                {/* Terms checkbox */}
                <TouchableOpacity
                  style={styles.checkRow}
                  onPress={() => setAgreedToTerms(v => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                    {agreedToTerms && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                  <Text style={styles.checkLabel}>
                    I agree to the Terms and Conditions and consent to sharing my information with our psychologist team.
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowTerms(true)} activeOpacity={0.7} style={styles.termsLink}>
                  <Text style={styles.checkLabelLink}>Read Terms and Conditions</Text>
                </TouchableOpacity>

                {/* Actions */}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancel}
                    onPress={() => { setShowHumanModal(false); setShowTerms(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalConfirm, (!agreedToTerms || submittingHuman) && styles.modalConfirmDisabled]}
                    onPress={handleSubmitHuman}
                    disabled={!agreedToTerms || submittingHuman}
                    activeOpacity={0.8}
                  >
                    {submittingHuman
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.modalConfirmText}>Send Request</Text>
                    }
                  </TouchableOpacity>
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
    paddingVertical: 13,
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
  guideSubtitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    color: COLORS.textDark, 
    textAlign: 'center',
    lineHeight: 25,
    marginBottom: 24,
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  suggestionCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  suggestionIcon: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
    marginBottom: 4,
  },
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
});
