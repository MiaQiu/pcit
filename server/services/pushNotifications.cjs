/**
 * Push Notification Service
 * Sends push notifications using Expo Push Notification service
 */

const fetch = require('node-fetch');
const prisma = require('./db.cjs');

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Check if a push token is valid Expo push token format
 * @param {string} pushToken - The token to validate
 * @returns {boolean} - Whether the token is valid
 */
function isValidExpoPushToken(pushToken) {
  if (!pushToken || typeof pushToken !== 'string') {
    return false;
  }

  // Expo push tokens start with ExponentPushToken[...] or ExpoPushToken[...]
  return pushToken.startsWith('ExponentPushToken[') ||
         pushToken.startsWith('ExpoPushToken[');
}

/**
 * Send a push notification to a specific user
 * @param {string} userId - User ID to send notification to
 * @param {Object} notification - Notification content
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {Object} [notification.data] - Additional data to include
 * @param {string} [notification.sound] - Sound to play ('default' or null)
 * @param {number} [notification.badge] - Badge count
 * @returns {Promise<Object>} - Result of the push notification
 */
async function sendPushNotificationToUser(userId, notification) {
  try {
    console.log(`[PushNotifications] Sending notification to user ${userId.substring(0, 8)}`);

    // Get user's push token from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true, email: true }
    });

    if (!user) {
      console.log(`[PushNotifications] User ${userId.substring(0, 8)} not found`);
      return { success: false, error: 'User not found' };
    }

    if (!user.pushToken) {
      console.log(`[PushNotifications] User ${user.email} has no push token registered`);
      return { success: false, error: 'No push token registered' };
    }

    if (!isValidExpoPushToken(user.pushToken)) {
      console.log(`[PushNotifications] Invalid push token format for user ${user.email}`);
      return { success: false, error: 'Invalid push token format' };
    }

    // Send push notification via Expo Push API
    const result = await sendExpoPushNotification(user.pushToken, notification);

    console.log(`[PushNotifications] Notification sent to ${user.email}:`, result);

    return result;

  } catch (error) {
    console.error(`[PushNotifications] Error sending notification to user ${userId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a push notification via Expo Push Notification service
 * @param {string} pushToken - Expo push token
 * @param {Object} notification - Notification content
 * @returns {Promise<Object>} - Result of the push notification
 */
async function sendExpoPushNotification(pushToken, notification) {
  try {
    const message = {
      to: pushToken,
      sound: notification.sound !== undefined ? notification.sound : 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      badge: notification.badge,
      priority: 'high',
      // iOS-specific: ensure notification shows even when device is locked
      _displayInForeground: true,
    };

    const response = await fetch(EXPO_PUSH_API_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Expo Push API error: ${response.status}`);
    }

    const data = await response.json();

    // Check if there were any errors
    if (data.data && data.data[0]) {
      const ticketData = data.data[0];

      if (ticketData.status === 'error') {
        console.error('[PushNotifications] Expo push ticket error:', ticketData.message, ticketData.details);
        return {
          success: false,
          error: ticketData.message,
          details: ticketData.details
        };
      }

      return {
        success: true,
        ticket: ticketData.id,
        status: ticketData.status
      };
    }

    return { success: true, data };

  } catch (error) {
    console.error('[PushNotifications] Error sending Expo push notification:', error);
    throw error;
  }
}

/**
 * Send a "Report Ready" notification to a user
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @param {string} [sessionType] - Type of session (e.g., "play session")
 * @returns {Promise<Object>} - Result of the notification
 */
async function sendReportReadyNotification(userId, sessionId, sessionType = 'play session') {
  return sendPushNotificationToUser(userId, {
    title: 'Session Report Ready!',
    body: `Your ${sessionType} report is ready to view`,
    sound: 'default',
    badge: 1,
    data: {
      type: 'new_report',
      recordingId: sessionId,
      timestamp: Date.now()
    }
  });
}

/**
 * Register or update a user's push token
 * @param {string} userId - User ID
 * @param {string} pushToken - Expo push token
 * @returns {Promise<boolean>} - Whether the registration was successful
 */
async function registerPushToken(userId, pushToken) {
  try {
    console.log(`[PushNotifications] Registering push token for user ${userId.substring(0, 8)}`);

    if (!isValidExpoPushToken(pushToken)) {
      console.error(`[PushNotifications] Invalid push token format: ${pushToken}`);
      return false;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        pushToken,
        pushTokenUpdatedAt: new Date()
      }
    });

    console.log(`[PushNotifications] Push token registered successfully for user ${userId.substring(0, 8)}`);
    return true;

  } catch (error) {
    console.error(`[PushNotifications] Error registering push token for user ${userId}:`, error);
    return false;
  }
}

/**
 * Unregister a user's push token
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Whether the unregistration was successful
 */
async function unregisterPushToken(userId) {
  try {
    console.log(`[PushNotifications] Unregistering push token for user ${userId.substring(0, 8)}`);

    await prisma.user.update({
      where: { id: userId },
      data: {
        pushToken: null,
        pushTokenUpdatedAt: new Date()
      }
    });

    console.log(`[PushNotifications] Push token unregistered for user ${userId.substring(0, 8)}`);
    return true;

  } catch (error) {
    console.error(`[PushNotifications] Error unregistering push token for user ${userId}:`, error);
    return false;
  }
}

/**
 * Send a milestone celebration notification to a user
 * Only sends if developmentalVisible is enabled for that user
 * @param {string} userId - User ID
 * @param {{ status: string, category: string, title: string }[]} celebrations - Milestone celebrations
 * @returns {Promise<Object>} - Result of the notification
 */
async function sendMilestoneNotification(userId, celebrations) {
  if (!celebrations || celebrations.length === 0) return { success: false, error: 'No celebrations' };

  // Check if developmental milestones are visible for this user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { developmentalVisible: true }
  });

  if (!user || !user.developmentalVisible) {
    console.log(`[PushNotifications] Skipping milestone notification for user ${userId.substring(0, 8)} — developmental not visible`);
    return { success: false, error: 'Developmental milestones not visible' };
  }

  const first = celebrations[0];
  const isAchieved = first.status === 'ACHIEVED';
  const title = isAchieved ? 'Milestone Achieved!' : 'New Milestone Emerging!';
  const body = celebrations.length === 1
    ? `${first.title} (${first.category})`
    : `${first.title} and ${celebrations.length - 1} more`;

  return sendPushNotificationToUser(userId, {
    title,
    body,
    sound: 'default',
    data: {
      type: 'milestone',
      timestamp: Date.now()
    }
  });
}

module.exports = {
  sendPushNotificationToUser,
  sendReportReadyNotification,
  sendMilestoneNotification,
  registerPushToken,
  unregisterPushToken,
  isValidExpoPushToken
};
