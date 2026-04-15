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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../constants/assets';
import { useAuthService } from '../contexts/AppContext';
import { useCoachUnread } from '../contexts/CoachUnreadContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'model' | 'psychologist';
  text: string;
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

const Bubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';
  const isPsychologist = message.role === 'psychologist';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowModel]}>
      {!isUser && (
        <View style={[styles.avatarWrap, isPsychologist && styles.avatarWrapPsych]}>
          <Ionicons name={isPsychologist ? 'person' : 'sparkles'} size={14} color="#fff" />
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export const CoachChatScreen: React.FC = () => {
  const navigation = useNavigation();
  const authService = useAuthService();
  const { markAsRead } = useCoachUnread();
  const flatListRef = useRef<FlatList>(null);

  const GREETING: Message = {
    id: '0',
    role: 'model',
    text: "Hi! I'm Nora, your parenting coach. How can I support you today? 💜",
  };

  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState('');
  const [showHumanModal, setShowHumanModal] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submittingHuman, setSubmittingHuman] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  // Clear unread badge when entering the chat screen
  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  // Load full history on mount, then long-poll for new messages
  useEffect(() => {
    let cancelled = false;
    let since = new Date().toISOString();

    // 1. Initial history load
    authService.authenticatedRequest(`${API_URL}/api/coach/history`)
      .then(r => r.json())
      .then((data: { messages: Array<{ id: string; role: string; text: string; createdAt: string }> }) => {
        if (cancelled) return;
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages as Message[]);
          since = data.messages[data.messages.length - 1].createdAt;
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) startPolling();
      });

    // 2. Long-poll loop — holds until server pushes or 25s timeout
    function startPolling() {
      if (cancelled) return;
      authService.authenticatedRequest(
        `${API_URL}/api/coach/events?since=${encodeURIComponent(since)}`
      )
        .then(r => r.json())
        .then((data: { messages: Array<{ id: string; role: string; text: string; createdAt: string }> }) => {
          if (cancelled) return;
          if (data.messages && data.messages.length > 0) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const newOnes = (data.messages as Message[]).filter(m => !existingIds.has(m.id));
              return newOnes.length > 0 ? [...prev, ...newOnes] : prev;
            });
            since = data.messages[data.messages.length - 1].createdAt;
          }
        })
        .catch(() => {})
        .finally(() => startPolling()); // immediately reconnect
    }

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    scrollToEnd();

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
      const data = await response.json();

      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: data.reply,
      };
      setMessages(prev => [...prev, modelMsg]);
    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: 'Something went wrong. Please check your connection and try again.',
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
      scrollToEnd();
    }
  }, [input, loading, messages, scrollToEnd, authService]);

  const handleRequestHuman = useCallback(() => {
    setAgreedToTerms(false);
    setShowHumanModal(true);
  }, []);

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
      Alert.alert('Request Sent', 'Our psychologist team has been notified and will reach out to you soon.');
    } catch {
      Alert.alert('Error', 'Failed to send request. Please try again.');
    } finally {
      setSubmittingHuman(false);
    }
  }, [agreedToTerms, authService]);

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
          data={messages}
          keyExtractor={m => m.id}
          renderItem={({ item }) => <Bubble message={item} />}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={scrollToEnd}
        />

        {/* Typing indicator */}
        {loading && (
          <View style={styles.typingRow}>
            <View style={styles.avatarWrap}>
              <Ionicons name="sparkles" size={14} color="#fff" />
            </View>
            <View style={styles.typingBubble}>
              <ActivityIndicator size="small" color={COLORS.mainPurple} />
            </View>
          </View>
        )}

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
});
