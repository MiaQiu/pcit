import './src/i18n';
import React, { useContext, useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text, AppState, Platform } from 'react-native';
import { NavigationContainer, NavigationContainerRefContext, useNavigation, useNavigationContainerRef, DefaultTheme } from '@react-navigation/native';
import { I18nextProvider } from 'react-i18next';
import i18n, { loadSavedLanguage } from './src/i18n';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_400Regular_Italic,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_700Bold_Italic,
} from '@expo-google-fonts/plus-jakarta-sans';
import crashlytics from '@react-native-firebase/crashlytics';
import Purchases from 'react-native-purchases';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppProvider } from './src/contexts/AppContext';
import { CoachUnreadProvider } from './src/contexts/CoachUnreadContext';
import { OnboardingProvider } from './src/contexts/OnboardingContext';
import { UploadProcessingProvider } from './src/contexts/UploadProcessingContext';
import { LessonPlayerProvider } from './src/contexts/LessonPlayerContext';
import { SubscriptionProvider } from './src/contexts/SubscriptionContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootStackNavigationProp } from './src/navigation/types';
import { NetworkStatusBar } from './src/components/NetworkStatusBar';
import { GlobalLessonAudioBar } from './src/components/GlobalLessonAudioBar';
import { ToastProvider, useToast } from './src/components/ToastManager';
import { clearBadge, setupAndroidNotificationChannels } from './src/utils/notifications';
import * as userStorage from './src/lib/userStorage';
import amplitudeService from './src/services/amplitudeService';
import { getSafeRouteParams } from './src/utils/getSafeRouteParams';
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
      // Tapped from share-home-card.html's "Open App" button (nora://card/:cardId
      // or https://hinora.co/card/:cardId) — only resolves while the user is
      // already logged in, since this screen only exists in the authenticated
      // stack; a logged-out tap just opens the app normally.
      HomeCardDetail: { path: 'card/:cardId', parse: { cardId: String } },
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

// On Android, a remote push tapped while the app is backgrounded/killed can
// arrive with an empty content.data; the Expo payload is then only on the FCM
// message, JSON-encoded under remoteMessage.data.body
const getNotificationData = (notification: Notifications.Notification): Record<string, unknown> => {
  const data = notification.request.content.data;
  if (data && Object.keys(data).length > 0) return data;

  const remoteData = (notification.request.trigger as any)?.remoteMessage?.data;
  if (typeof remoteData?.body === 'string') {
    try {
      return JSON.parse(remoteData.body);
    } catch {}
  }
  return data ?? {};
};

// Helper component that provides navigation to UploadProcessingProvider
const AppContent: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const navigationContainer = useContext(NavigationContainerRefContext);
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

    navigation.navigate('ReportV3', { recordingId });
  };

  const handleReportReady = (_recordingId: string) => {
    // No-op: navigation is handled by reportCompletedTimestamp in RecordScreen
  };

  // Notification ids already routed, so a tap delivered to both the response
  // listener and getLastNotificationResponse() only navigates once
  const handledNotificationIds = useRef(new Set<string>());

  // True once the logged-in app is showing. Every root screen (MainTabs
  // included) is also registered under the login/onboarding stack, so check
  // that Onboarding is gone (login and onboarding both reset the root to
  // [MainTabs]) rather than that some screen name exists.
  const isInApp = () => {
    const state = navigationContainer?.getRootState();
    return !!state?.routeNames && !state.routes.some((route) => route.name === 'Onboarding');
  };

  // Run a tap's navigation once the logged-in app is showing. Before that
  // (loading spinner, force update, login, onboarding) a navigate is either
  // dropped or would skip past auth.
  const whenInApp = (run: () => void) => {
    if (isInApp()) {
      run();
      return;
    }
    const unsubscribe = navigationContainer?.addListener('state', () => {
      if (!isInApp()) return;
      unsubscribe?.();
      run();
    });
  };

  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    const notificationId = response.notification.request.identifier;
    if (handledNotificationIds.current.has(notificationId)) return;
    handledNotificationIds.current.add(notificationId);
    // Stop the native side from replaying this tap if AppContent remounts
    Notifications.clearLastNotificationResponse();

    console.log('[App] Notification tapped:', response);

    const data = getNotificationData(response.notification);
    const notificationType = (data.type || 'unknown') as string;

    // Track notification opened
    amplitudeService.trackNotificationOpened(notificationType);

    whenInApp(() => {
      if (data.type === 'new_report' || data.type === 'weekly_report') {
        // Land on Home, where the report surfaces on the home card. refreshAt
        // makes Home reload: if the user left the app on Home, this navigate
        // doesn't refocus it, so its focus-based reload never runs.
        console.log('[App] Navigating to Home for', data.type, data.recordingId ?? data.reportId);
        navigation.navigate('MainTabs', { screen: 'Home', params: { refreshAt: Date.now() } });
      } else if (data.type === 'milestones_unlocked') {
        console.log('[App] Navigating to Progress > Milestones section');
        navigation.navigate('MainTabs', { screen: 'Progress', params: { scrollToDevelopmental: true } });
      } else if (data.type === 'daily_session_reminder') {
        console.log('[App] Navigating to Record screen from daily reminder');
        navigation.navigate('MainTabs', { screen: 'Record' });
      }
    });
  };

  // Handle notification tap when app is in foreground or background
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    return () => subscription.remove();
  }, [navigation]);

  // Handle cold-start from a notification tap (app was killed): native emits
  // the launching tap before this listener exists, so read it back instead
  useEffect(() => {
    const response = Notifications.getLastNotificationResponse();
    if (response) handleNotificationResponse(response);
  }, []);

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
      <GlobalLessonAudioBar />
      <StatusBar style="dark" />
      <NetworkStatusBar />
    </UploadProcessingProvider>
  );
};

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_400Regular_Italic,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_700Bold_Italic,
  });
  const [langReady, setLangReady] = useState(false);
  const [rcReady, setRcReady] = useState(false);
  const navigationRef = useNavigationContainerRef();
  const routeNameRef = useRef<string | undefined>(undefined);

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

  // Initialize RevenueCat — must complete before SubscriptionProvider calls getCustomerInfo()
  useEffect(() => {
    const initRevenueCat = async () => {
      const rcApiKey = Platform.OS === 'android'
        ? REVENUECAT_CONFIG.apiKey.android
        : REVENUECAT_CONFIG.apiKey.ios;
      if (rcApiKey) {
        try {
          // Read saved user ID so returning users are never anonymous in RC
          const savedUserId = await AsyncStorage.getItem('@last_user_id');
          await Purchases.configure({
            apiKey: rcApiKey,
            appUserID: savedUserId ?? undefined,
          });

          if (__DEV__) {
            await Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
          }

          console.log('RevenueCat initialized:', savedUserId ? `user ${savedUserId}` : 'anonymous');
        } catch (error) {
          console.error('Error initializing RevenueCat:', error);
        } finally {
          setRcReady(true);
        }
      } else {
        setRcReady(true);
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
            <LessonPlayerProvider>
            <CoachUnreadProvider>
            <SubscriptionProvider rcReady={rcReady}>
              <OnboardingProvider>
                <ToastProvider>
                  <NavigationContainer
                    ref={navigationRef}
                    linking={linking}
                    theme={navigationTheme}
                    onReady={() => {
                      routeNameRef.current = navigationRef.getCurrentRoute()?.name;
                    }}
                    onStateChange={() => {
                      const previousRouteName = routeNameRef.current;
                      const currentRoute = navigationRef.getCurrentRoute();
                      const currentRouteName = currentRoute?.name;
                      if (currentRouteName && currentRouteName !== previousRouteName) {
                        amplitudeService.trackScreenView(currentRouteName, getSafeRouteParams(currentRoute?.params));
                      }
                      routeNameRef.current = currentRouteName;
                    }}
                  >
                    <AppContent />
                  </NavigationContainer>
                </ToastProvider>
              </OnboardingProvider>
            </SubscriptionProvider>
            </CoachUnreadProvider>
            </LessonPlayerProvider>
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
