/**
 * Processing Service
 * Orchestrates recording processing with retry logic and failure handling
 */
const fetch = require('node-fetch');
const prisma = require('./db.cjs');
const { analyzePCITCoding } = require('./pcitAnalysisService.cjs');
const { sendReportReadyNotification, sendPushNotificationToUser } = require('./pushNotifications.cjs');

// ============================================================================
// Phase Progression Helper
// ============================================================================

/**
 * Check and update user's phase to DISCIPLINE if conditions are met:
 * 1. Completed Day 15 of CONNECT phase
 * 2. Ever achieved a score of 100 in any session
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Returns true if phase was advanced, false otherwise
 */
async function checkAndUpdateUserPhase(userId) {
  try {
    // Get user's current phase
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { currentPhase: true }
    });

    // If already in DISCIPLINE phase, no need to check
    if (user.currentPhase === 'DISCIPLINE') {
      return false;
    }

    // Check if user has ever achieved a mastery score of 80+ in any session
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        overallScore: { not: null }
      },
      select: { overallScore: true }
    });

    const hasMasteryScore = sessions.some(session => (session.overallScore || 0) >= 80);

    if (!hasMasteryScore) {
      return false; // Never achieved 80 mastery score yet
    }

    // Mastery achieved - update user to DISCIPLINE phase
    await prisma.user.update({
      where: { id: userId },
      data: { currentPhase: 'DISCIPLINE' }
    });

    console.log(`✅ User ${userId} advanced to DISCIPLINE phase (achieved 80 mastery score)`);
    return true;
  } catch (error) {
    console.error('Error checking/updating user phase:', error);
    return false;
  }
}

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

    // Check if user should advance to DISCIPLINE phase
    try {
      const userPhase = await prisma.user.findUnique({
        where: { id: userId },
        select: { currentPhase: true, pushToken: true }
      });

      if (userPhase?.currentPhase === 'CONNECT') {
        const phaseAdvanced = await checkAndUpdateUserPhase(userId);

        // If phase advanced, send celebration notification
        if (phaseAdvanced && userPhase.pushToken) {
          try {
            await sendReportReadyNotification(
              userPhase.pushToken,
              '🎉 Congratulations!',
              'You\'ve advanced to the Discipline Phase! New lessons are now available.',
              { type: 'PHASE_ADVANCED', phase: 'DISCIPLINE' }
            );
            console.log(`📱 Sent phase advancement notification to user ${userId}`);
          } catch (notifError) {
            console.error('Failed to send phase advancement notification:', notifError);
          }
        }
      }
    } catch (error) {
      console.error('Error checking user phase:', error);
    }

  } catch (error) {
    console.error(`❌ [PROCESSING-ERROR] Session ${sessionId.substring(0, 8)} - Attempt ${attemptNumber + 1} failed:`, error.message);

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
  checkAndUpdateUserPhase
};
