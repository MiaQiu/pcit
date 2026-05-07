import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthService } from './AppContext';
import * as userStorage from '../lib/userStorage';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

interface CoachUnreadContextType {
  unreadCount: number;       // total AI + psych (for tab badge)
  psychUnreadCount: number;  // psychologist only (for Talk to Psychologist badge)
  markAiAsRead: (timestamp?: string) => Promise<void>;
  markPsychAsRead: (timestamp?: string) => Promise<void>;
  /** @deprecated use markAiAsRead */
  markAsRead: (timestamp?: string) => Promise<void>;
  /** Call after login so counts are immediately correct for the new user */
  reinitialize: (userId: string) => Promise<void>;
}

const CoachUnreadContext = createContext<CoachUnreadContextType>({
  unreadCount: 0,
  psychUnreadCount: 0,
  markAiAsRead: async () => {},
  markPsychAsRead: async () => {},
  markAsRead: async () => {},
  reinitialize: async () => {},
});


export const CoachUnreadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authService = useAuthService();
  const [aiUnreadCount, setAiUnreadCount]       = useState(0);
  const [psychUnreadCount, setPsychUnreadCount] = useState(0);
  const aiLastReadRef    = useRef<string>(new Date(0).toISOString());
  const psychLastReadRef = useRef<string>(new Date(0).toISOString());
  const currentUserIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const fetchUnread = useCallback(async () => {
    if (!currentUserIdRef.current) return;
    try {
      const [aiRes, psychRes] = await Promise.all([
        authService.authenticatedRequest(
          `${API_URL}/api/coach/unread?since=${encodeURIComponent(aiLastReadRef.current)}&thread=ai`
        ),
        authService.authenticatedRequest(
          `${API_URL}/api/coach/unread?since=${encodeURIComponent(psychLastReadRef.current)}&thread=psych`
        ),
      ]);
      if (!aiRes.ok || !psychRes.ok) return;
      const [aiData, psychData] = await Promise.all([aiRes.json(), psychRes.json()]);
      if (!mountedRef.current) return;
      if (typeof aiData.count === 'number')    setAiUnreadCount(aiData.count);
      if (typeof psychData.count === 'number') setPsychUnreadCount(psychData.count);
      // When no stored read-time exists, seed it with last-message + 2 days so stale
      // conversations don't show as unread on a fresh device / cleared storage.
      if (aiData.lastMessageAt && aiLastReadRef.current === new Date(0).toISOString()) {
        aiLastReadRef.current = aiData.lastMessageAt;
        await userStorage.setItem('@nora_coach_last_read_at', aiData.lastMessageAt);
      }
      if (psychData.lastMessageAt && psychLastReadRef.current === new Date(0).toISOString()) {
        psychLastReadRef.current = psychData.lastMessageAt;
        await userStorage.setItem('@nora_psych_last_read_at', psychData.lastMessageAt);
      }
    } catch {
      // silently ignore network/auth errors
    }
  }, [authService]);

  const markAiAsRead = useCallback(async (timestamp?: string) => {
    const ts = timestamp ?? new Date().toISOString();
    aiLastReadRef.current = ts;
    setAiUnreadCount(0);
    await userStorage.setItem('@nora_coach_last_read_at', ts);
  }, []);

  const markPsychAsRead = useCallback(async (timestamp?: string) => {
    const ts = timestamp ?? new Date().toISOString();
    psychLastReadRef.current = ts;
    setPsychUnreadCount(0);
    await userStorage.setItem('@nora_psych_last_read_at', ts);
  }, []);

  const reinitialize = useCallback(async (userId: string) => {
    currentUserIdRef.current = userId;
    aiLastReadRef.current    = new Date(0).toISOString();
    psychLastReadRef.current = new Date(0).toISOString();

    let [aiStored, psychStored] = await Promise.all([
      userStorage.getItem('@nora_coach_last_read_at'),
      userStorage.getItem('@nora_psych_last_read_at'),
    ]);

    // One-time migration: old keys used userId embedded in key name
    if (!aiStored) {
      aiStored = await AsyncStorage.getItem(`@nora_coach_last_read_at_${userId}`);
      if (!aiStored) aiStored = await AsyncStorage.getItem('@nora_coach_last_read_at');
      if (aiStored) await userStorage.setItem('@nora_coach_last_read_at', aiStored);
    }
    if (!psychStored) {
      psychStored = await AsyncStorage.getItem(`@nora_psych_last_read_at_${userId}`);
      if (!psychStored) psychStored = await AsyncStorage.getItem('@nora_psych_last_read_at');
      if (psychStored) await userStorage.setItem('@nora_psych_last_read_at', psychStored);
    }

    if (aiStored)    aiLastReadRef.current    = aiStored;
    if (psychStored) psychLastReadRef.current = psychStored;
    await fetchUnread();
  }, [fetchUnread]);

  useEffect(() => {
    mountedRef.current = true;
    // Initial load without a userId — counts stay 0 until reinitialize() is called after login

    const interval = setInterval(fetchUnread, 30_000);
    const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') fetchUnread();
    });

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [fetchUnread]);

  return (
    <CoachUnreadContext.Provider value={{
      unreadCount: aiUnreadCount + psychUnreadCount,
      psychUnreadCount,
      markAiAsRead,
      markPsychAsRead,
      markAsRead: markAiAsRead,
      reinitialize,
    }}>
      {children}
    </CoachUnreadContext.Provider>
  );
};

export const useCoachUnread = () => useContext(CoachUnreadContext);
