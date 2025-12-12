/**
 * App Context
 * Provides @nora/core services to all screens and components
 */

import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { LessonService, AuthService, RecordingService, SocialAuthService } from '@nora/core';
import { SecureStoreAdapter } from '../lib/SecureStoreAdapter';

// Get API URL from environment variable or use default
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface AppContextType {
  lessonService: LessonService;
  authService: AuthService;
  recordingService: RecordingService;
  socialAuthService: SocialAuthService;
}

const AppContext = createContext<AppContextType | null>(null);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const services = useMemo(() => {
    try {
      console.log('Initializing AppContext services...');
      console.log('API_URL:', API_URL);

      const storage = new SecureStoreAdapter();
      console.log('SecureStoreAdapter created');

      // Initialize AuthService first
      const authService = new AuthService(storage, API_URL);
      console.log('AuthService created');

      // Note: AuthService.initialize() will be called by RootNavigator
      // to check authentication status before navigation

      // Initialize LessonService with authService for automatic token refresh
      const lessonService = new LessonService(
        storage,
        API_URL,
        authService
      );
      console.log('LessonService created');

      // Initialize RecordingService
      const recordingService = new RecordingService(authService, API_URL);
      console.log('RecordingService created');

      // Initialize SocialAuthService
      const socialAuthService = new SocialAuthService(storage, API_URL);
      socialAuthService.initialize().catch(err => {
        console.log('SocialAuthService initialization warning:', err);
      });
      console.log('SocialAuthService created');

      console.log('All services initialized successfully');

      return {
        lessonService,
        authService,
        recordingService,
        socialAuthService,
      };
    } catch (error) {
      console.error('CRITICAL: Error initializing services:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw error;
    }
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

export const useRecordingService = () => {
  const { recordingService } = useServices();
  return recordingService;
};

export const useSocialAuthService = () => {
  const { socialAuthService } = useServices();
  return socialAuthService;
};
