/**
 * App Context
 * Provides @nora/core services to all screens and components
 */

import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { LessonService, AuthService } from '@nora/core';
import { SecureStoreAdapter } from '../lib/SecureStoreAdapter';

// Get API URL from environment variable or use default
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

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

    // Initialize LessonService
    const lessonService = new LessonService({
      baseUrl: API_URL,
      storage,
    });

    // Initialize AuthService
    const authService = new AuthService({
      baseUrl: API_URL,
      storage,
    });

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
