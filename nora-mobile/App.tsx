import './src/i18n';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text, AppState, Platform } from 'react-native';
import { NavigationContainer, useNavigation, DefaultTheme } from '@react-navigation/native';
import { I18nextProvider } from 'react-i18next';
import i18n, { loadSavedLanguage } from './src/i18n';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import crashlytics from '@react-native-firebase/crashlytics';
import Purchases from 'react-native-purchases';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppProvider } from './src/contexts/AppContext';
import { CoachUnreadProvider } from './src/contexts/CoachUnreadContext';
import { OnboardingProvider } from './src/contexts/OnboardingContext';
import { UploadProcessingProvider } from './src/contexts/UploadProcessingContext';
import { SubscriptionProvider } from './src/contexts/SubscriptionContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootStackNavigationProp } from './src/navigation/types';
import { NetworkStatusBar } from './src/components/NetworkStatusBar';
import { ToastProvider, useToast } from './src/components/ToastManager';
import { clearBadge, setupAndroidNotificationChannels } from './src/utils/notifications';
import * as userStorage from './src/lib/userStorage';
import amplitudeService from './src/services/amplitudeService';
import { REVENUECAT_CONFIG } from './src/config/revenuecat';
import { getTodaySingapore } from './src/utils/timezone';

// Deep linking configuration
const linking = {
  prefixes: [Linking.createURL('/'), 'nora://', 'https://hinora.co'],
  config: {
    screens: {
      Onboarding: {
        screens: {
          ResetPassword: 'reset-password',
          Login: { path: 'join', parse: { referralCode: String } },
        },
      },
      MainTabs: {
        screens: {
          Home: 'home',
          Record: 'record',
          Learn: 'learn',
          Progress: 'progress',
        },
      },
    },
  },
};

// Custom navigation theme with white background
const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#FFFDFF',
  },
};

// Helper component that provides navigation to UploadProcessingProvider
const AppContent: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { showToast } = useToast();

  const handleNavigateToHome = () => {
    navigation.navigate('MainTabs', { screen: 'Home' });
  };

  const handleNavigateToReport = async (recordingId: string) => {
    // Mark report as read before navigating
    // This ensures the NextActionCard updates correctly when user returns to Home screen
    const reportReadKey = `report_read_${getTodaySingapore()}`;
    await userStorage.setItem(reportReadKey, recordingId);
    console.log('[App] Marked report as read from alert:', reportReadKey, recordingId);

    navigation.navigate('Report', { recordingId });
  };

  const handleReportReady = (_recordingId: string) => {
    // No-op: navigation is handled by reportCompletedTimestamp in RecordScreen
  };

  // Handle notification taps
  useEffect(() => {
    // Handle notification tap when app is in foreground or background
    const subscription = Notifications.addNotificationResponseReceivedListener(async (response) => {
      console.log('[App] Notification tapped:', response);

      const data = response.notification.request.content.data;
      const notificationType = (data.type || 'unknown') as string;

      // Track notification opened
      amplitudeService.trackNotificationOpened(notificationType);

      if (data.type === 'new_report' && data.recordingId) {
        console.log('[App] Navigating to report:', data.recordingId);

        // Track report viewed from notification
        amplitudeService.trackReportViewed(
          data.recordingId as string,
          undefined, // Score not available in notification data
          {
            source: 'notification',
            notificationType: 'new_report',
          }
        );

        // Mark report as read before navigating
        // This ensures the NextActionCard updates correctly when user returns to Home screen
        const reportReadKey = `report_read_${getTodaySingapore()}`;
        await userStorage.setItem(reportReadKey, data.recordingId as string);
        console.log('[App] Marked report as read:', reportReadKey, data.recordingId);

        // Navigate to the report screen
        navigation.navigate('Report', { recordingId: data.recordingId as string });
      } else if (data.type === 'weekly_report' && data.reportId) {
        console.log('[App] Navigating to weekly report:', data.reportId);
        await userStorage.setItem(`weekly_report_dismissed_${data.reportId as string}`, 'true');
        navigation.navigate('WeeklyReport', { reportId: data.reportId as string });
      } else if (data.type === 'milestones_unlocked') {
        console.log('[App] Navigating to Progress > Milestones section');
        navigation.navigate('MainTabs', { screen: 'Progress', params: { scrollToDevelopmental: true } });
      } else if (data.type === 'daily_session_reminder') {
        console.log('[App] Navigating to Record screen from daily reminder');
        navigation.navigate('Record');
      }
    });

    return () => subscription.remove();
  }, [navigation]);

  // Handle cold-start from a notification tap (app was killed)
  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then(async (response) => {
      if (!response) return;
      const data = response.notification.request.content.data;
      if (data.type === 'weekly_report' && data.reportId) {
        console.log('[App] Cold-start: navigating to weekly report:', data.reportId);
        await userStorage.setItem(`weekly_report_dismissed_${data.reportId as string}`, 'true');
        navigation.navigate('WeeklyReport', { reportId: data.reportId as string });
      }
    });
  }, [navigation]);

  // Clear badge when app comes to foreground
  useEffect(() => {
    // Clear badge on app mount
    clearBadge();

    // Clear badge when app comes to foreground
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('[App] App came to foreground, clearing badge');
        clearBadge();
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <UploadProcessingProvider onNavigateToHome={handleNavigateToHome} onNavigateToReport={handleNavigateToReport} onReportReady={handleReportReady}>
      <RootNavigator />
      <StatusBar style="dark" />
      <NetworkStatusBar />
    </UploadProcessingProvider>
  );
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const [langReady, setLangReady] = useState(false);

  useEffect(() => {
    loadSavedLanguage().then(() => setLangReady(true));
  }, []);

  // Initialize Firebase Crashlytics
  useEffect(() => {
    // Enable crash reporting (even in development for testing)
    crashlytics().setCrashlyticsCollectionEnabled(true);
    console.log('Firebase Crashlytics initialized');
  }, []);

  // Set up Android notification channels (idempotent, safe on every launch)
  useEffect(() => {
    setupAndroidNotificationChannels();
  }, []);

  // Initialize Amplitude Analytics
  useEffect(() => {
    amplitudeService.init();
  }, []);

  // Initialize RevenueCat
  useEffect(() => {
    const initRevenueCat = async () => {
      if (Platform.OS === 'ios') {
        try {
          await Purchases.configure({
            apiKey: REVENUECAT_CONFIG.apiKey.ios,
          });

          // Enable debug logs in development
          if (__DEV__) {
            await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
          }

          console.log('RevenueCat initialized successfully');
        } catch (error) {
          console.error('Error initializing RevenueCat:', error);
        }
      }
    };

    initRevenueCat();
  }, []);

  // Handle font loading error
  if (fontError) {
    console.error('Font loading error:', fontError);
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error loading fonts</Text>
        <Text style={styles.errorDetails}>{fontError.message}</Text>
      </View>
    );
  }

  if (!fontsLoaded || !langReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8C49D5" />
      </View>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <AppProvider>
            <CoachUnreadProvider>
            <SubscriptionProvider>
              <OnboardingProvider>
                <ToastProvider>
                  <NavigationContainer linking={linking} theme={navigationTheme}>
                    <AppContent />
                  </NavigationContainer>
                </ToastProvider>
              </OnboardingProvider>
            </SubscriptionProvider>
            </CoachUnreadProvider>
          </AppProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </I18nextProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#DC2626',
    marginBottom: 8,
  },
  errorDetails: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});
