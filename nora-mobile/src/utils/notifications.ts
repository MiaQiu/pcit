/**
 * Notification Utilities
 * Helper functions for managing push notifications
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Notification IDs for managing scheduled notifications
export const NOTIFICATION_IDS = {
  DAILY_LESSON_REMINDER: 'daily-lesson-reminder',
  PRACTICE_REMINDER: 'practice-reminder',
  WEEKLY_SUMMARY: 'weekly-summary',
};

/**
 * Request notification permissions from the user
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permissions not granted');
      return false;
    }

    // Get push token for future use (optional, for remote notifications)
    if (Platform.OS !== 'web') {
      try {
        const token = await Notifications.getExpoPushTokenAsync({
          projectId: 'your-project-id', // TODO: Replace with actual Expo project ID
        });
        console.log('Push token:', token.data);
      } catch (error) {
        console.log('Failed to get push token:', error);
      }
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
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
        priority: Notifications.AndroidNotificationPriority.HIGH,
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
export const sendNewReportNotification = async (sessionType?: string): Promise<void> => {
  try {
    const sessionLabel = sessionType || 'play session';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Session Report Ready!",
        body: `Your ${sessionLabel} report is ready to view`,
        sound: true,
        data: {
          type: 'new_report',
          timestamp: Date.now(),
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2, // Small delay to ensure report is fully processed
      },
    });

    console.log('New report notification scheduled');
  } catch (error) {
    console.error('Error sending new report notification:', error);
  }
};
