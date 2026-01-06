import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Text, AppState } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import crashlytics from '@react-native-firebase/crashlytics';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AppProvider } from './src/contexts/AppContext';
import { OnboardingProvider } from './src/contexts/OnboardingContext';
import { UploadProcessingProvider } from './src/contexts/UploadProcessingContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { RootStackNavigationProp } from './src/navigation/types';
import { NetworkStatusBar } from './src/components/NetworkStatusBar';
import { ToastProvider } from './src/components/ToastManager';
import { clearBadge } from './src/utils/notifications';
import amplitudeService from './src/services/amplitudeService';

// Deep linking configuration
const linking = {
  prefixes: [Linking.createURL('/'), 'nora://', 'https://hinora.co'],
  config: {
    screens: {
      Onboarding: {
        screens: {
          ResetPassword: 'reset-password',
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

// Helper component that provides navigation to UploadProcessingProvider
const AppContent: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();

  const handleNavigateToHome = () => {
    navigation.navigate('MainTabs', { screen: 'Home' });
  };

  // Handle notification taps
  useEffect(() => {
    // Handle notification tap when app is in foreground or background
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[App] Notification tapped:', response);

      const data = response.notification.request.content.data;

      if (data.type === 'new_report' && data.recordingId) {
        console.log('[App] Navigating to report:', data.recordingId);
        // Navigate to the report screen
        navigation.navigate('Report', { recordingId: data.recordingId as string });
      }
    });

    return () => subscription.remove();
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
    <UploadProcessingProvider onNavigateToHome={handleNavigateToHome}>
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

  // Initialize Firebase Crashlytics
  useEffect(() => {
    // Enable crash reporting (even in development for testing)
    crashlytics().setCrashlyticsCollectionEnabled(true);
    console.log('Firebase Crashlytics initialized');
  }, []);

  // Initialize Amplitude Analytics
  useEffect(() => {
    amplitudeService.init();
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

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8C49D5" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AppProvider>
          <OnboardingProvider>
            <ToastProvider>
              <NavigationContainer linking={linking}>
                <AppContent />
              </NavigationContainer>
            </ToastProvider>
          </OnboardingProvider>
        </AppProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
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
