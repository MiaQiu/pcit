import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthService } from './AppContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const AI_STORAGE_KEY    = '@nora_coach_last_read_at';
const PSYCH_STORAGE_KEY = '@nora_psych_last_read_at';

interface CoachUnreadContextType {
  unreadCount: number;       // total AI + psych (for tab badge)
  psychUnreadCount: number;  // psychologist only (for Talk to Psychologist badge)
  markAiAsRead: (timestamp?: string) => Promise<void>;
  markPsychAsRead: (timestamp?: string) => Promise<void>;
  /** @deprecated use markAiAsRead */
  markAsRead: (timestamp?: string) => Promise<void>;
}

const CoachUnreadContext = createContext<CoachUnreadContextType>({
  unreadCount: 0,
  psychUnreadCount: 0,
  markAiAsRead: async () => {},
  markPsychAsRead: async () => {},
  markAsRead: async () => {},
});

export const CoachUnreadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authService = useAuthService();
  const [aiUnreadCount, setAiUnreadCount]       = useState(0);
  const [psychUnreadCount, setPsychUnreadCount] = useState(0);
  const aiLastReadRef    = useRef<string>(new Date(0).toISOString());
  const psychLastReadRef = useRef<string>(new Date(0).toISOString());
  const mountedRef = useRef(true);

  const fetchUnread = useCallback(async () => {
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
    await AsyncStorage.setItem(AI_STORAGE_KEY, ts);
  }, []);

  const markPsychAsRead = useCallback(async (timestamp?: string) => {
    const ts = timestamp ?? new Date().toISOString();
    psychLastReadRef.current = ts;
    setPsychUnreadCount(0);
    await AsyncStorage.setItem(PSYCH_STORAGE_KEY, ts);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    Promise.all([
      AsyncStorage.getItem(AI_STORAGE_KEY),
      AsyncStorage.getItem(PSYCH_STORAGE_KEY),
    ]).then(([aiStored, psychStored]) => {
      if (aiStored)    aiLastReadRef.current    = aiStored;
      if (psychStored) psychLastReadRef.current = psychStored;
      fetchUnread();
    });

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
    }}>
      {children}
    </CoachUnreadContext.Provider>
  );
};

export const useCoachUnread = () => useContext(CoachUnreadContext);
