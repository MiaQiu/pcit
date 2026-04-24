import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthService } from './AppContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

const aiStorageKey    = (userId: string) => `@nora_coach_last_read_at_${userId}`;
const psychStorageKey = (userId: string) => `@nora_psych_last_read_at_${userId}`;

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
    } catch {
      // silently ignore network/auth errors
    }
  }, [authService]);

  const markAiAsRead = useCallback(async (timestamp?: string) => {
    const ts = timestamp ?? new Date().toISOString();
    aiLastReadRef.current = ts;
    setAiUnreadCount(0);
    if (currentUserIdRef.current) {
      await AsyncStorage.setItem(aiStorageKey(currentUserIdRef.current), ts);
    }
  }, []);

  const markPsychAsRead = useCallback(async (timestamp?: string) => {
    const ts = timestamp ?? new Date().toISOString();
    psychLastReadRef.current = ts;
    setPsychUnreadCount(0);
    if (currentUserIdRef.current) {
      await AsyncStorage.setItem(psychStorageKey(currentUserIdRef.current), ts);
    }
  }, []);

  const reinitialize = useCallback(async (userId: string) => {
    currentUserIdRef.current = userId;
    aiLastReadRef.current    = new Date(0).toISOString();
    psychLastReadRef.current = new Date(0).toISOString();
    const [aiStored, psychStored] = await Promise.all([
      AsyncStorage.getItem(aiStorageKey(userId)),
      AsyncStorage.getItem(psychStorageKey(userId)),
    ]);
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
