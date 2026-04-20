import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthService } from './AppContext';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const STORAGE_KEY = '@nora_coach_last_read_at';

interface CoachUnreadContextType {
  unreadCount: number;
  markAsRead: (timestamp?: string) => Promise<void>;
}

const CoachUnreadContext = createContext<CoachUnreadContextType>({
  unreadCount: 0,
  markAsRead: async () => {},
});

export const CoachUnreadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authService = useAuthService();
  const [unreadCount, setUnreadCount] = useState(0);
  const lastReadAtRef = useRef<string>(new Date(0).toISOString());
  const mountedRef = useRef(true);

  const fetchUnread = useCallback(async () => {
    try {
      const r = await authService.authenticatedRequest(
        `${API_URL}/api/coach/unread?since=${encodeURIComponent(lastReadAtRef.current)}`
      );
      if (!r.ok) return;
      const data = await r.json();
      if (mountedRef.current && typeof data.count === 'number') {
        setUnreadCount(data.count);
      }
    } catch {
      // silently ignore network/auth errors
    }
  }, [authService]);

  const markAsRead = useCallback(async (timestamp?: string) => {
    const ts = timestamp ?? new Date().toISOString();
    lastReadAtRef.current = ts;
    setUnreadCount(0);
    await AsyncStorage.setItem(STORAGE_KEY, ts);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Read persisted lastReadAt, then fetch unread count
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) lastReadAtRef.current = stored;
      fetchUnread();
    });

    // Poll every 30s
    const interval = setInterval(fetchUnread, 30_000);

    // Re-fetch when app comes to foreground
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
    <CoachUnreadContext.Provider value={{ unreadCount, markAsRead }}>
      {children}
    </CoachUnreadContext.Provider>
  );
};

export const useCoachUnread = () => useContext(CoachUnreadContext);
