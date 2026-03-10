/**
 * Processing Service
 * Orchestrates recording processing with retry logic and failure handling
 */
const fetch = require('node-fetch');
const prisma = require('./db.cjs');
const { analyzePCITCoding, SessionQualityError } = require('./pcitAnalysisService.cjs');
const { sendReportReadyNotification, sendPushNotificationToUser, sendMilestonesUnlockedNotification } = require('./pushNotifications.cjs');

// ============================================================================
// Failure Notification Helper
// ============================================================================

/**
 * Notify user and team of a processing failure
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {Error} error - The error that occurred
 */
async function notifyProcessingFailure(sessionId, userId, error) {
  // Update session with permanent failure
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        analysisStatus: 'FAILED',
        analysisError: error.message || 'Unknown error occurred during processing',
        analysisFailedAt: new Date(),
        permanentFailure: true
      }
    });
    console.log(`✅ [PERMANENT-FAILURE] Database updated for session ${sessionId.substring(0, 8)}`);
  } catch (dbErr) {
    console.error(`❌ [DB-ERROR] Failed to save error to database:`, dbErr);
  }

  // Send push notification to inform user of failure
  console.log(`📱 [PUSH-NOTIFICATION] Sending failure notification for session ${sessionId.substring(0, 8)}`);
  try {
    const result = await sendPushNotificationToUser(userId, {
      title: 'Recording Processing Failed',
      body: 'We encountered an issue processing your recording. Please try again.',
      data: {
        type: 'report_failed',
        recordingId: sessionId,
        error: error.message
      }
    });
    if (result.success) {
      console.log(`✅ [PUSH-NOTIFICATION] Failure notification sent for session ${sessionId.substring(0, 8)}`);
    } else {
      console.log(`⚠️ [PUSH-NOTIFICATION] Failure notification failed for session ${sessionId.substring(0, 8)}:`, result.error);
    }
  } catch (pushError) {
    console.error(`❌ [PUSH-NOTIFICATION] Error sending failure notification for session ${sessionId.substring(0, 8)}:`, pushError);
  }

  // Auto-report to team
  await reportPermanentFailureToTeam(sessionId, error);
}

/**
 * Automatically report permanent processing failure to team
 * Sends Slack notification
 * @param {string} sessionId - Session ID
 * @param {Error} error - Error that caused failure
 */
async function reportPermanentFailureToTeam(sessionId, error) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { User: true }
    });

    if (!session) {
      console.error(`❌ [AUTO-REPORT] Session ${sessionId} not found`);
      return;
    }

    // Send to Slack webhook if configured
    if (process.env.SLACK_ERROR_WEBHOOK_URL) {
      await fetch(process.env.SLACK_ERROR_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 *Permanent Processing Failure* - Session ${sessionId.substring(0, 8)}`,
          blocks: [
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*User:*\n${session.User.email}` },
                { type: 'mrkdwn', text: `*Session:*\n${sessionId}` }
              ]
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Error:*\n${error.message}` },
                { type: 'mrkdwn', text: `*Retry Attempts:*\n${(session.retryCount || 0) + 1}/3` }
              ]
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: session.audioUrl ? `*Audio:* <${session.audioUrl}|Download>` : '*Audio:* Not available'
              }
            },
            {
              type: 'context',
              elements: [
                { type: 'mrkdwn', text: `Duration: ${session.durationSeconds}s | Failed at: ${new Date().toLocaleString()}` }
              ]
            }
          ]
        })
      });

      console.log(`📧 [AUTO-REPORT] Sent failure report to team for session ${sessionId.substring(0, 8)}`);
    }
  } catch (reportError) {
    console.error('❌ [AUTO-REPORT-FAILED] Failed to report error to team:', reportError);
  }
}

/**
 * Handle a quality rejection — session is valid but unsuitable for analysis.
 * Marks the session as permanently failed with the user-facing reason.
 * Does NOT alert the team (this is expected behaviour, not a system bug).
 * @param {string} sessionId
 * @param {string} userId
 * @param {SessionQualityError} error
 */
async function notifyQualityRejection(sessionId, userId, error) {
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        analysisStatus: 'FAILED',
        analysisError: error.userMessage,
        analysisFailedAt: new Date(),
        permanentFailure: true
      }
    });
    console.log(`✅ [QUALITY-REJECTION] Database updated for session ${sessionId.substring(0, 8)}`);
  } catch (dbErr) {
    console.error(`❌ [DB-ERROR] Failed to save quality rejection to database:`, dbErr);
  }

  try {
    const result = await sendPushNotificationToUser(userId, {
      title: 'Recording Could Not Be Analyzed',
      body: error.userMessage,
      data: {
        type: 'report_failed',
        recordingId: sessionId,
        userMessage: error.userMessage
      }
    });
    if (result.success) {
      console.log(`✅ [QUALITY-REJECTION] Push notification sent for session ${sessionId.substring(0, 8)}`);
    } else {
      console.log(`⚠️ [QUALITY-REJECTION] Push notification failed for session ${sessionId.substring(0, 8)}:`, result.error);
    }
  } catch (pushError) {
    console.error(`❌ [QUALITY-REJECTION] Error sending push notification for session ${sessionId.substring(0, 8)}:`, pushError);
  }
}

// ============================================================================
// Processing with Retry
// ============================================================================

/**
 * Process recording with automatic retry logic
 * Retries up to 3 times before giving up
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {number} attemptNumber - Current attempt number (0-indexed)
 */
async function processRecordingWithRetry(sessionId, userId, attemptNumber = 0) {
  const maxAttempts = 3;
  const retryDelays = [0, 5000, 15000]; // 0s, 5s, 15s

  try {
    console.log(`🔄 [PROCESSING] Session ${sessionId.substring(0, 8)} - Attempt ${attemptNumber + 1}/${maxAttempts}`);

    // Update retry tracking in database
    if (attemptNumber > 0) {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          retryCount: attemptNumber,
          lastRetriedAt: new Date()
        }
      });
    }

    // Run the actual processing (PCIT analysis)
    await analyzePCITCoding(sessionId, userId);

    // Success! Log it
    console.log(`✅ [PROCESSING-SUCCESS] Session ${sessionId.substring(0, 8)} completed on attempt ${attemptNumber + 1}`);

    // Update status to COMPLETED
    await prisma.session.update({
      where: { id: sessionId },
      data: { analysisStatus: 'COMPLETED' }
    });

    // Send push notification to user that report is ready
    console.log(`📱 [PUSH-NOTIFICATION] Sending report ready notification for session ${sessionId.substring(0, 8)}`);
    try {
      const result = await sendReportReadyNotification(userId, sessionId, 'play session');
      if (result.success) {
        console.log(`✅ [PUSH-NOTIFICATION] Push notification sent successfully for session ${sessionId.substring(0, 8)}`);
      } else {
        console.log(`⚠️ [PUSH-NOTIFICATION] Push notification failed for session ${sessionId.substring(0, 8)}:`, result.error);
      }
    } catch (pushError) {
      console.error(`❌ [PUSH-NOTIFICATION] Error sending push notification for session ${sessionId.substring(0, 8)}:`, pushError);
      // Don't fail the whole process if push notification fails
    }

    // Check if this is the user's 5th completed session — schedule milestones unlock notification in 30 mins
    try {
      const completedCount = await prisma.session.count({
        where: { userId, analysisStatus: 'COMPLETED' }
      });
      if (completedCount === 5) {
        const THIRTY_MINUTES = 30 * 60 * 1000;
        console.log(`🎯 [MILESTONES-UNLOCKED] User ${userId.substring(0, 8)} just completed session 5 — scheduling unlock notification in 30 mins`);
        setTimeout(async () => {
          try {
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { childName: true } });
            await sendMilestonesUnlockedNotification(userId, user?.childName);
            console.log(`✅ [MILESTONES-UNLOCKED] Unlock notification sent for user ${userId.substring(0, 8)}`);
          } catch (err) {
            console.error(`❌ [MILESTONES-UNLOCKED] Error sending delayed unlock notification:`, err);
          }
        }, THIRTY_MINUTES);
      }
    } catch (milestoneNotifError) {
      console.error(`❌ [MILESTONES-UNLOCKED] Error scheduling milestones unlock notification:`, milestoneNotifError);
      // Non-critical — don't fail the process
    }

  } catch (error) {
    console.error(`❌ [PROCESSING-ERROR] Session ${sessionId.substring(0, 8)} - Attempt ${attemptNumber + 1} failed:`, error.message);

    // Quality rejections are not retryable — rethrow immediately
    if (error instanceof SessionQualityError) {
      throw error;
    }

    // Check if we should retry
    if (attemptNumber < maxAttempts - 1) {
      const delay = retryDelays[attemptNumber + 1];
      console.log(`⏳ [RETRY] Session ${sessionId.substring(0, 8)} - Retrying in ${delay}ms (attempt ${attemptNumber + 2}/${maxAttempts})`);

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry recursively
      return processRecordingWithRetry(sessionId, userId, attemptNumber + 1);
    }

    // All retries exhausted - throw error to be caught by caller
    throw error;
  }
}

module.exports = {
  processRecordingWithRetry,
  reportPermanentFailureToTeam,
  notifyProcessingFailure,
  notifyQualityRejection,
};
