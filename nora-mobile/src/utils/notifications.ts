/**
 * Notification Utilities
 * Helper functions for managing push notifications
 */

import * as Notifications from 'expo-notifications';
import { Platform, AppState } from 'react-native';
import amplitudeService from '../services/amplitudeService';

// Configure notification handler
try {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // Only set badge if app is NOT in active/foreground state
      const appState = AppState.currentState;
      const shouldSetBadge = appState !== 'active';

      console.log(`[Notifications] Received notification with app state: ${appState}, shouldSetBadge: ${shouldSetBadge}`);

      // Track notification received
      const notificationType = notification.request.content.data?.type || 'unknown';
      amplitudeService.trackNotificationReceived(notificationType as string);

      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge, // Only set badge when app is in background
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });
} catch (error) {
  console.warn('Notifications module not available:', error);
}

/**
 * Clear notification badge
 */
export const clearBadge = async (): Promise<void> => {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.error('Error clearing badge:', error);
  }
};

// Notification IDs for managing scheduled notifications
export const NOTIFICATION_IDS = {
  DAILY_LESSON_REMINDER: 'daily-lesson-reminder',
  PRACTICE_REMINDER: 'practice-reminder',
  WEEKLY_SUMMARY: 'weekly-summary',
};

/**
 * Request notification permissions from the user and register push token with backend
 * @param {string} [accessToken] - Optional access token to register push token with backend
 */
export const requestNotificationPermissions = async (accessToken?: string): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      // Track permission request
      amplitudeService.trackEvent('Notification Permission Requested', {});

      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;

      // Track permission result
      amplitudeService.trackNotificationPermission(finalStatus === 'granted');
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }

    // Get push token for remote notifications
    if (Platform.OS !== 'web') {
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PUBLIC_PROJECT_ID || 'your-project-id',
        });
        const pushToken = tokenData.data;
        console.log('[Notifications] Push token obtained:', pushToken.substring(0, 30) + '...');

        // Register push token with backend if access token is provided
        if (accessToken) {
          await registerPushTokenWithBackend(pushToken, accessToken);
        }
      } catch (error) {
        console.log('[Notifications] Failed to get push token:', error);
      }
    }

    return true;
  } catch (error) {
    console.error('[Notifications] Error requesting notification permissions:', error);
    return false;
  }
};

/**
 * Register push token with backend
 * @param {string} pushToken - Expo push token
 * @param {string} accessToken - User access token
 */
export const registerPushTokenWithBackend = async (pushToken: string, accessToken: string): Promise<boolean> => {
  try {
    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
    console.log('[Notifications] Registering push token with backend...');

    const response = await fetch(`${API_URL}/api/auth/push-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ pushToken }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Notifications] Failed to register push token:', errorData);
      return false;
    }

    const data = await response.json();
    console.log('[Notifications] Push token registered successfully:', data);
    return true;
  } catch (error) {
    console.error('[Notifications] Error registering push token with backend:', error);
    return false;
  }
};

/**
 * Unregister push token from backend
 * @param {string} accessToken - User access token
 */
export const unregisterPushTokenFromBackend = async (accessToken: string): Promise<boolean> => {
  try {
    const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
    console.log('[Notifications] Unregistering push token from backend...');

    const response = await fetch(`${API_URL}/api/auth/push-token`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Notifications] Failed to unregister push token:', errorData);
      return false;
    }

    console.log('[Notifications] Push token unregistered successfully');
    return true;
  } catch (error) {
    console.error('[Notifications] Error unregistering push token from backend:', error);
    return false;
  }
};

/**
 * Schedule a daily notification at a specific time
 */
export const scheduleDailyNotification = async (
  id: string,
  title: string,
  body: string,
  hour: number,
  minute: number
): Promise<string | null> => {
  try {
    // Cancel existing notification with this ID
    await cancelNotification(id);

    // Schedule new notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        badge: 1,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        // iOS-specific: ensure notification shows even when device is locked
        interruptionLevel: 'active' as any,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour,
        minute,
        repeats: true,
      },
      identifier: id,
    });

    console.log(`Scheduled daily notification: ${id} at ${hour}:${minute}`);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling daily notification:', error);
    return null;
  }
};

/**
 * Schedule a notification after a certain number of seconds
 */
export const scheduleNotificationAfter = async (
  id: string,
  title: string,
  body: string,
  seconds: number
): Promise<string | null> => {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        badge: 1,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        // iOS-specific: ensure notification shows even when device is locked
        interruptionLevel: 'active' as any,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
      },
      identifier: id,
    });

    console.log(`Scheduled notification: ${id} after ${seconds} seconds`);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
};

/**
 * Cancel a specific notification by ID
 */
export const cancelNotification = async (id: string): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
    console.log(`Canceled notification: ${id}`);
  } catch (error) {
    console.error('Error canceling notification:', error);
  }
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Canceled all scheduled notifications');
  } catch (error) {
    console.error('Error canceling all notifications:', error);
  }
};

/**
 * Get all scheduled notifications
 */
export const getScheduledNotifications = async (): Promise<Notifications.NotificationRequest[]> => {
  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    return notifications;
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return [];
  }
};

/**
 * Parse time string (HH:mm) to hour and minute
 */
export const parseTime = (timeString: string): { hour: number; minute: number } => {
  const [hourStr, minuteStr] = timeString.split(':');
  return {
    hour: parseInt(hourStr, 10),
    minute: parseInt(minuteStr, 10),
  };
};

/**
 * Schedule daily lesson reminder
 */
export const scheduleDailyLessonReminder = async (timeString: string): Promise<string | null> => {
  const { hour, minute } = parseTime(timeString);

  return scheduleDailyNotification(
    NOTIFICATION_IDS.DAILY_LESSON_REMINDER,
    "Time for today's lesson!",
    "Take a few minutes to learn something new with Nora",
    hour,
    minute
  );
};

/**
 * Cancel daily lesson reminder
 */
export const cancelDailyLessonReminder = async (): Promise<void> => {
  return cancelNotification(NOTIFICATION_IDS.DAILY_LESSON_REMINDER);
};

/**
 * Send an immediate test notification
 */
export const sendTestNotification = async (): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Test Notification",
        body: "Notifications are working!",
        sound: true,
        badge: 1,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        // iOS-specific: ensure notification shows even when device is locked
        interruptionLevel: 'active' as any,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
      },
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
  }
};

/**
 * Send notification when a new session report is ready
 */
export const sendNewReportNotification = async (sessionType?: string, recordingId?: string): Promise<void> => {
  try {
    console.log('[Notifications] sendNewReportNotification called with sessionType:', sessionType, 'recordingId:', recordingId);

    // Check notification permissions first
    const { status } = await Notifications.getPermissionsAsync();
    console.log('[Notifications] Current permission status:', status);

    if (status !== 'granted') {
      console.log('[Notifications] Notifications not granted, cannot send notification');
      return;
    }

    const sessionLabel = sessionType || 'play session';
    console.log('[Notifications] Scheduling notification for:', sessionLabel);

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Session Report Ready!",
        body: `Your ${sessionLabel} report is ready to view`,
        sound: true,
        badge: 1,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        // iOS-specific: ensure notification shows even when device is locked
        interruptionLevel: 'active' as any, // 'active' lights up screen and plays sound
        data: {
          type: 'new_report',
          recordingId: recordingId,
          timestamp: Date.now(),
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2, // Small delay to ensure report is fully processed
      },
    });

    console.log('[Notifications] New report notification scheduled successfully with ID:', notificationId);
  } catch (error) {
    console.error('[Notifications] Error sending new report notification:', error);
    throw error; // Re-throw so calling code knows it failed
  }
};
