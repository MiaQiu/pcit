/**
 * App Context
 * Provides @nora/core services to all screens and components
 */

import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { LessonService, AuthService } from '@nora/core';
import { SecureStoreAdapter } from '../lib/SecureStoreAdapter';

// Get API URL from environment variable or use default
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface AppContextType {
  lessonService: LessonService;
  authService: AuthService;
}

const AppContext = createContext<AppContextType | null>(null);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const services = useMemo(() => {
    const storage = new SecureStoreAdapter();

    // Initialize AuthService first
    const authService = new AuthService(storage, API_URL);

    // Initialize AuthService (load tokens from storage)
    authService.initialize().catch(err => {
      console.log('AuthService initialization (no tokens yet):', err);
    });

    // Initialize LessonService with getAccessToken callback
    const lessonService = new LessonService(
      storage,
      API_URL,
      async () => {
        // Since we removed auth requirement, return null for now
        // When auth is re-enabled, this will call authService.getAccessToken()
        return null;
      }
    );

    return {
      lessonService,
      authService,
    };
  }, []);

  return <AppContext.Provider value={services}>{children}</AppContext.Provider>;
};

/**
 * Hook to access services from anywhere in the app
 */
export const useServices = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useServices must be used within AppProvider');
  }
  return context;
};

/**
 * Individual service hooks for convenience
 */
export const useLessonService = () => {
  const { lessonService } = useServices();
  return lessonService;
};

export const useAuthService = () => {
  const { authService } = useServices();
  return authService;
};
