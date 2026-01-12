/**
 * Recording Upload Routes
 * Handles audio recording uploads from mobile app
 */
const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const fetch = require('node-fetch');
const FormData = require('form-data');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const prisma = require('../services/db.cjs');
const storage = require('../services/storage-s3.cjs');
const { requireAuth } = require('../middleware/auth.cjs');
const { createAnonymizedRequest } = require('../utils/anonymization.cjs');
const { sendReportReadyNotification } = require('../services/pushNotifications.cjs');
const {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  UploadError,
  ProcessingError,
  AppError
} = require('../utils/errors.cjs');

const router = express.Router();

// ============================================================================
// Phase Progression Helper
// ============================================================================

/**
 * Check and update user's phase to DISCIPLINE if conditions are met:
 * 1. Completed Day 15 of CONNECT phase
 * 2. Ever achieved a score of 100 in any session
 * @returns {Promise<boolean>} - Returns true if phase was advanced, false otherwise
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

    // Check if Day 15 of CONNECT is completed
    const connectDay15 = await prisma.lesson.findFirst({
      where: {
        phase: 'CONNECT',
        dayNumber: 15
      }
    });

    if (!connectDay15) {
      return false; // Day 15 doesn't exist
    }

    const day15Progress = await prisma.userLessonProgress.findUnique({
      where: {
        userId_lessonId: {
          userId,
          lessonId: connectDay15.id
        }
      }
    });

    if (!day15Progress || day15Progress.status !== 'COMPLETED') {
      return false; // Day 15 not completed yet
    }

    // Check if user has ever achieved a score of 100 in any session
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        overallScore: { not: null }
      },
      select: { overallScore: true }
    });

    const hasHundredScore = sessions.some(session => (session.overallScore || 0) >= 100);

    if (!hasHundredScore) {
      return false; // Never achieved 100 score yet
    }

    // Both conditions met - update user to DISCIPLINE phase
    await prisma.user.update({
      where: { id: userId },
      data: { currentPhase: 'DISCIPLINE' }
    });

    console.log(`✅ User ${userId} advanced to DISCIPLINE phase (Day 15 completed + achieved 100 score)`);
    return true; // Phase was advanced!
  } catch (error) {
    console.error('Error checking/updating user phase:', error);
    return false;
  }
}

// ============================================================================
// Helper Functions for Utterance Management
// ============================================================================

/**
 * @typedef {Object} UtteranceData
 * @property {string} speaker - Speaker ID (e.g., 'speaker_0')
 * @property {string} text - Utterance text
 * @property {number} start - Start time in seconds
 * @property {number} end - End time in seconds
 * @property {string} [role] - 'adult' or 'child' (added after role identification)
 * @property {string} [tag] - PCIT coding tag (e.g., 'DO: Praise') (added after PCIT coding)
 */

/**
 * Create utterances in database from parsed transcript data
 * @param {string} sessionId - Session ID
 * @param {Array<UtteranceData>} utterancesData - Array of utterance data
 * @returns {Promise<void>}
 */
async function createUtterances(sessionId, utterancesData) {
  const utteranceRecords = utterancesData.map((utt, index) => ({
    sessionId,
    speaker: utt.speaker,
    text: utt.text,
    startTime: utt.start,
    endTime: utt.end,
    role: utt.role || null,
    pcitTag: utt.tag || null,
    order: index
  }));

  await prisma.utterance.createMany({
    data: utteranceRecords
  });
}

/**
 * Get utterances for a session from database
 * @param {string} sessionId - Session ID
 * @returns {Promise<Array>} Array of utterance records ordered by order field
 */
async function getUtterances(sessionId) {
  return await prisma.utterance.findMany({
    where: { sessionId },
    orderBy: { order: 'asc' }
  });
}

/**
 * Update utterances with role information (optimized batch update)
 * @param {string} sessionId - Session ID
 * @param {Object} roleMap - Map of speaker ID to role (e.g., { 'speaker_0': 'child', 'speaker_1': 'adult' })
 * @returns {Promise<void>}
 */
async function updateUtteranceRoles(sessionId, roleMap) {
  // Use updateMany for each speaker (batched by speaker ID)
  const updatePromises = Object.entries(roleMap).map(([speakerId, role]) => {
    return prisma.utterance.updateMany({
      where: {
        sessionId,
        speaker: speakerId
      },
      data: { role }
    });
  });

  await Promise.all(updatePromises);
}

/**
 * Update utterances with PCIT tags (optimized batch update with ID-based matching)
 * @param {string} sessionId - Session ID
 * @param {Object} pcitTagMap - Map of utterance ID to DPICS code (RF, LP, etc.)
 * @param {Object} noraTagMap - Map of utterance ID to display name (Echo, Labeled Praise, etc.)
 * @returns {Promise<void>}
 */
async function updateUtteranceTags(sessionId, pcitTagMap, noraTagMap) {
  // Build array of updates to perform in parallel
  const updatePromises = [];

  for (const [utteranceId, pcitTag] of Object.entries(pcitTagMap)) {
    const noraTag = noraTagMap[utteranceId];
    updatePromises.push(
      prisma.utterance.update({
        where: { id: utteranceId },
        data: {
          pcitTag: pcitTag,  // DPICS code (RF, LP, etc.)
          noraTag: noraTag   // Display name (Echo, Labeled Praise, etc.)
        }
      })
    );
  }

  // Execute all updates in parallel
  await Promise.all(updatePromises);
}

// S3 Client for downloading audio files
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const s3Client = new S3Client({ region: AWS_REGION });
const S3_BUCKET = process.env.AWS_S3_BUCKET;

/**
 * Transcribe recording helper function
 * Extracted from POST /:id/transcribe endpoint for reuse
 */
async function transcribeRecording(sessionId, userId, storagePath, durationSeconds) {
  console.log(`🎤 [TRANSCRIBE-START] Session ${sessionId.substring(0, 8)} - Starting background transcription`);
  console.log(`🎤 [TRANSCRIBE-START] Storage: ${storagePath}, User: ${userId.substring(0, 8)}`);

  // Get audio file from S3
  let audioBuffer;
  try {
    if (storagePath.startsWith('mock://')) {
      throw new Error('Transcription not available in mock storage mode');
    }

    const getCommand = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: storagePath
    });

    const response = await s3Client.send(getCommand);

    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    audioBuffer = Buffer.concat(chunks);

    console.log(`Retrieved audio from S3: ${audioBuffer.length} bytes`);
  } catch (s3Error) {
    console.error('S3 download error:', s3Error);
    throw new Error(`Failed to retrieve audio file: ${s3Error.message}`);
  }

  // Determine content type from storage path
  const extension = storagePath.split('.').pop();
  const contentTypeMap = {
    'm4a': 'audio/x-m4a',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'webm': 'audio/webm',
    'aac': 'audio/aac'
  };
  const contentType = contentTypeMap[extension] || 'audio/m4a';

  // Create anonymized request
  const requestId = await createAnonymizedRequest(
    userId,
    'elevenlabs',
    'transcription',
    { sessionId, audioSize: audioBuffer.length }
  );

  // Transcribe with ElevenLabs
  let utterances;
  let transcriptFormatted;

  try {
    console.log(`Sending to ElevenLabs for transcription (request: ${requestId})...`);

    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      throw new Error('ElevenLabs API key not configured');
    }

    // Prepare form data for ElevenLabs
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: `${requestId}.${extension}`,
      contentType: contentType
    });
    formData.append('model_id', 'scribe_v1');
    formData.append('diarize', 'true');
    formData.append('diarization_threshold', 0.1);
    formData.append('temperature', 0);
    formData.append('tag_audio_events', 'false');
    
    //formData.append('num_speakers', '2');
    formData.append('timestamps_granularity', 'word');

    const elevenLabsResponse = await fetch(
      'https://api.elevenlabs.io/v1/speech-to-text?include_timestamps=true',
      {
        method: 'POST',
        headers: {
          'xi-api-key': elevenLabsApiKey,
          ...formData.getHeaders()
        },
        body: formData
      }
    );

    if (!elevenLabsResponse.ok) {
      const errorData = await elevenLabsResponse.json().catch(() => ({}));
      throw new Error(errorData.detail?.message || `ElevenLabs API error: ${elevenLabsResponse.status}`);
    }

    const result = await elevenLabsResponse.json();

    console.log('ElevenLabs transcription successful');

    // STEP 1: Store raw ElevenLabs JSON in database
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        elevenLabsJson: result
      }
    });
    console.log(`Raw ElevenLabs JSON stored for session ${sessionId}`);

    // STEP 2: Parse JSON into utterances using utility function
    const { parseElevenLabsTranscript, formatUtterancesAsText } = require('../utils/parseElevenLabsTranscript.cjs');
    utterances = parseElevenLabsTranscript(result);

    if (utterances.length === 0) {
      throw new Error('No utterances parsed from ElevenLabs response');
    }

    // STEP 3: Format transcript for storage
    transcriptFormatted = formatUtterancesAsText(utterances);

    // Store formatted transcript and metadata
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        transcript: transcriptFormatted,
        transcribedAt: new Date(),
        transcriptionService: 'elevenlabs'
      }
    });

    // STEP 4: Create utterance records in database
    await createUtterances(sessionId, utterances);

    console.log(`✅ [TRANSCRIBE-DONE] Session ${sessionId.substring(0, 8)} - Formatted transcript and ${utterances.length} utterances stored`);

  } catch (transcriptionError) {
    console.error(`❌ [TRANSCRIBE-ERROR] Session ${sessionId.substring(0, 8)} - Transcription error:`, transcriptionError);
    console.error(`❌ [TRANSCRIBE-ERROR] Error stack:`, transcriptionError.stack);
    throw new Error(`Transcription failed: ${transcriptionError.message}`);
  }

  // Trigger PCIT analysis in background with automatic retry (non-blocking)
  console.log(`🔄 [ANALYSIS-TRIGGER] Session ${sessionId.substring(0, 8)} - Triggering PCIT analysis with auto-retry...`);

  // Update status to PROCESSING
  await prisma.session.update({
    where: { id: sessionId },
    data: { analysisStatus: 'PROCESSING' }
  });

  // Process with automatic retry (3 attempts with 0s, 5s, 15s delays)
  processRecordingWithRetry(sessionId, userId, 0)
    .catch(async (err) => {
      console.error(`❌ [PROCESSING-FAILED-PERMANENTLY] Session ${sessionId.substring(0, 8)} failed after all retries:`, err.message);

      // Update session with permanent failure
      try {
        await prisma.session.update({
          where: { id: sessionId },
          data: {
            analysisStatus: 'FAILED',
            analysisError: err.message || 'Unknown error occurred during processing',
            analysisFailedAt: new Date(),
            permanentFailure: true
          }
        });
        console.log(`✅ [PERMANENT-FAILURE] Database updated for session ${sessionId.substring(0, 8)}`);

        // Send push notification to inform user of failure
        console.log(`📱 [PUSH-NOTIFICATION] Sending failure notification for session ${sessionId.substring(0, 8)}`);
        try {
          const { sendPushNotificationToUser } = require('../services/pushNotifications.cjs');
          const result = await sendPushNotificationToUser(userId, {
            title: 'Recording Processing Failed',
            body: 'We encountered an issue processing your recording. Please try again.',
            data: {
              type: 'report_failed',
              recordingId: sessionId,
              error: err.message
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
      } catch (dbErr) {
        console.error(`❌ [DB-ERROR] Failed to save error to database:`, dbErr);
      }

      // Auto-report to team
      await reportPermanentFailureToTeam(sessionId, err);
    });

  return {
    transcript: transcriptFormatted,
    utterances
  };
}

/**
 * Format tips with bold keywords and bullet points
 * @param {string} tips - Raw tips text from Claude
 * @returns {string} - Formatted tips with bold keywords and bullet points
 */
function formatTips(tips) {
  if (!tips) return tips;

  // Keywords to bold (these are the PCIT skills we want to highlight)
  const keywords = ['Praise', 'Echo', 'Narrate', 'Questions', 'Commands', 'Criticisms', 'Negative Phrases'];

  // Split by double newlines first (paragraph breaks)
  let paragraphs = tips.split('\n\n');

  // If no double newlines, try single newlines
  if (paragraphs.length === 1) {
    paragraphs = tips.split('\n');
  }

  // Format each paragraph
  const formattedParagraphs = paragraphs.map(paragraph => {
    // Trim whitespace
    let formatted = paragraph.trim();

    // Skip if empty
    if (!formatted) return '';

    // First, remove any existing bold markers to avoid conflicts
    formatted = formatted.replace(/\*\*/g, '');

    // Bold keywords - use a simpler approach that handles punctuation
    keywords.forEach(keyword => {
      // Escape special regex characters in keyword (for "Negative Phrases" etc.)
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Match keyword with word boundaries, case-insensitive
      // This will match "Praise" in "Praise:", "Echo" in "Echo (Reflections):", etc.
      const regex = new RegExp(`\\b(${escapedKeyword})\\b`, 'gi');
      formatted = formatted.replace(regex, '**$1**');
    });

    // Add bullet point if not already present
    if (!formatted.startsWith('-') && !formatted.startsWith('•')) {
      formatted = `- ${formatted}`;
    }

    return formatted;
  });

  // Join with single newlines and remove empty lines
  return formattedParagraphs.filter(p => p).join('\n');
}

/**
 * Generate CDI competency analysis prompt
 */
function generateCDICompetencyPrompt(counts, utterances) {
  const totalDonts = counts.question + counts.command + counts.criticism + counts.negative_phrases;
  const totalDos = counts.praise + counts.echo + counts.narration;

  return `You are an expert PCIT (Parent-Child Interaction Therapy) Supervisor and Coder. Your task is to analyze a parent-child play session and provide three specific outputs.

**Session Data:**

Raw Counts (5-minute session):
- Labeled Praises: ${counts.praise}
- Echo (Reflections): ${counts.echo}
- Narration (Behavioral Descriptions): ${counts.narration}
- Questions: ${counts.question}
- Commands: ${counts.command}
- Criticisms: ${counts.criticism}
- Negative Phrases: ${counts.negative_phrases}
- Neutral: ${counts.neutral}

Total DO skills (PEN): ${totalDos}
Total DON'T skills: ${totalDonts}

**Mastery Criteria (for CDI completion):**
- 10+ Praises per 5 minutes
- 10+ Echo per 5 minutes
- 10+ Narration per 5 minutes
- 3 or fewer DON'Ts (Questions + Commands + Criticisms + Negative Phrases)
- 0 Negative Phrases

**Conversation Utterances (with PCIT coding):**
${JSON.stringify(utterances.map(u => ({
  speaker: u.speaker,
  role: u.role,
  text: u.text,
  pcitTag: u.pcitTag
})), null, 2)}

**Your Task:**
Generate a JSON object with exactly these three fields:

1. **topMoment**: An exact quote from the conversation that highlights bonding between child and parent. Can be from either speaker. Choose a moment showing connection, joy, or positive interaction. Must be a direct quote from the utterances above. Do not mention "PCIT" or therapy.

2. **tips**: highlight 2 most important area (among Praise, Echo, Narrate, Questions, Commands, Criticisms, Negative Phrases) for imporovement (add new line between for better readability). 2-3 sentences for each improvement. Be specific and actionable. Reference at least 1 specific utterances or patterns you observed. Do not mention "PCIT" or therapy.

3. **reminder**: EXACTLY 2 sentences of encouragement or reminder for the parent. Keep it warm and supportive. Do not mention "PCIT" or therapy.

**Output Format:**
Return ONLY valid JSON in this exact structure:
{
  "topMoment": **topMoment**,
  "tips": **tips**,
  "reminder": **reminder**
}

**CRITICAL:** Return ONLY valid JSON. Do not include markdown code blocks or any text outside the JSON structure.`;
}
// **tips**: EXACTLY 2 sentences of the MOST important tips for improvement. Be specific and actionable. Reference specific utterances or patterns you observed. Do not mention "PCIT" or therapy.
/**
 * Generate PDI competency analysis prompt
 */
function generatePDICompetencyPrompt(counts, utterances) {
  const totalEffective = counts.direct_command + counts.positive_command + counts.specific_command;
  const totalIneffective = counts.indirect_command + counts.negative_command + counts.vague_command + counts.chained_command;
  const totalCommands = totalEffective + totalIneffective;
  const effectivePercent = totalCommands > 0 ? Math.round((totalEffective / totalCommands) * 100) : 0;

  return `You are an expert PCIT (Parent-Child Interaction Therapy) Supervisor and Coder. Your task is to analyze a PDI (Parent-Directed Interaction) session and provide three specific outputs.

**Session Data:**

Effective Command Skills:
- Direct Commands: ${counts.direct_command}
- Positive Commands: ${counts.positive_command}
- Specific Commands: ${counts.specific_command}
- Labeled Praise: ${counts.labeled_praise}
- Correct Warnings: ${counts.correct_warning}
- Correct Timeout Statements: ${counts.correct_timeout}

Ineffective Command Skills:
- Indirect Commands: ${counts.indirect_command}
- Negative Commands: ${counts.negative_command}
- Vague Commands: ${counts.vague_command}
- Chained Commands: ${counts.chained_command}

Neutral: ${counts.neutral}

Summary:
- Total Effective Commands: ${totalEffective}
- Total Ineffective Commands: ${totalIneffective}
- Effective Command Percentage: ${effectivePercent}%

**PDI Mastery Criteria:**
- 75%+ of commands should be Effective (Direct + Positive + Specific)
- Minimize Indirect Commands (phrased as questions)
- Eliminate Negative Commands (focus on what TO do)
- No Chained Commands (one command at a time)

**Conversation Utterances (with PCIT coding):**
${JSON.stringify(utterances.map(u => ({
  speaker: u.speaker,
  role: u.role,
  text: u.text,
  pcitTag: u.pcitTag
})), null, 2)}

**Your Task:**
Generate a JSON object with exactly these three fields:

1. **topMoment**: An exact quote from the conversation that highlights bonding or positive interaction between child and parent. Can be from either speaker. Choose a moment showing connection, compliance, or positive interaction. Must be a direct quote from the utterances above.

2. **tips**: EXACTLY 2 sentences of the MOST important tips for improvement. Be specific and actionable. Reference specific utterances or patterns you observed.

3. **reminder**: EXACTLY 2 sentences of encouragement or reminder for the parent. Keep it warm and supportive.

**Output Format:**
Return ONLY valid JSON in this exact structure:
{
  "topMoment": **topMoment**,
  "tips": **tips**,
  "reminder": **reminder**
}

**CRITICAL:** Return ONLY valid JSON. Do not include markdown code blocks or any text outside the JSON structure.`;
}

/**
 * Process recording with automatic retry logic
 * Retries up to 3 times before giving up
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
 * @param {number} attemptNumber - Current attempt number (0-indexed)
 * @returns {Promise<void>}
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

    // Run the actual processing (transcription + analysis)
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

/**
 * Automatically report permanent processing failure to team
 * Sends Slack notification and logs to database
 * @param {string} sessionId - Session ID
 * @param {Error} error - Error that caused failure
 * @returns {Promise<void>}
 */
async function reportPermanentFailureToTeam(sessionId, error) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true }
    });

    if (!session) {
      console.error(`❌ [AUTO-REPORT] Session ${sessionId} not found`);
      return;
    }

    const errorReport = {
      type: 'PERMANENT_PROCESSING_FAILURE',
      sessionId: session.id,
      userId: session.userId,
      userEmail: session.user.email,
      error: error.message,
      stack: error.stack,
      retryCount: session.retryCount || 0,
      audioUrl: session.audioUrl,
      durationSeconds: session.durationSeconds,
      timestamp: new Date().toISOString()
    };

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
                { type: 'mrkdwn', text: `*User:*\n${session.user.email}` },
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

    // Log to ErrorLog table (will be created in Phase 3)
    // TODO Phase 3: Add this when ErrorLog table exists
    // await prisma.errorLog.create({ ... });

  } catch (reportError) {
    console.error('❌ [AUTO-REPORT-FAILED] Failed to report error to team:', reportError);
  }
}

/**
 * Analyze PCIT coding for transcript
 * Called after transcription completes
 * Retrieves transcript data from database
 */
async function analyzePCITCoding(sessionId, userId) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🏷️  [ANALYSIS-START] Session ${sessionId.substring(0, 8)} - Starting PCIT analysis`);
  console.log(`🏷️  [ANALYSIS-START] User: ${userId.substring(0, 8)}`);
  console.log(`${'='.repeat(80)}\n`);

  // Get session
  console.log(`📊 [ANALYSIS-STEP-1] Fetching session from database...`);
  const session = await prisma.session.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    console.error(`❌ [ANALYSIS-ERROR] Session ${sessionId} not found in database`);
    throw new Error('Session not found');
  }
  console.log(`✅ [ANALYSIS-STEP-1] Session found, mode: ${session.mode}`);

  // Get utterances from database
  console.log(`📊 [ANALYSIS-STEP-2] Fetching utterances from database...`);
  const utterances = await getUtterances(sessionId);
  console.log(`✅ [ANALYSIS-STEP-2] Found ${utterances.length} utterances`);

  if (utterances.length === 0) {
    throw new Error('No utterances found in session data');
  }

  // Convert to format expected by role identification prompt
  const utterancesForPrompt = utterances.map(utt => ({
    speaker: utt.speaker,
    text: utt.text,
    start: utt.startTime,
    end: utt.endTime
  }));

  // Format transcript for PCIT coding
  // Parse speaker_id (e.g., "speaker_0" -> 0)
  // const formattedTranscript = utterances.map(utt => ({
  //   speaker: parseInt(utt.speaker.replace('speaker_', '')),
  //   text: utt.text
  // }));

  // Call appropriate PCIT coding endpoint based on mode
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  const isCDI = session.mode === 'CDI';

  // STEP 1: Identify parent speaker
//   const identifyParentPrompt = `You are an expert in analyzing parent-child conversations. Your task is to identify which speaker is the parent in this conversation.

// **Input Utterances (JSON):**
// ${JSON.stringify(utterances, null, 2)}

// **Instructions:**
// Analyze the conversation and identify which speaker is the parent. The parent is usually:
// - The one giving more instructions, questions, or commands
// - The one providing guidance or praise
// - The one directing the activity

// **Output Format:**
// Return ONLY a single number representing the parent speaker (0, 1, 2, etc.)
// Do not include any other text or explanation.

// Example output:
// 0`;

  const identifyParentPrompt = `You are an expert in child language development and parent-child interaction analysis.

**TASK:** Analyze this parent-child interaction transcript and identify each speaker's role (CHILD or ADULT).

**CONTEXT:** 
- Children are ages 2-7 years old (preschool to early elementary)
- There may be multiple adults (parents, grandparents, helpers, guests)
- There may be multiple children
- Conversations may include Chinese, English, or code-mixing

---

**IDENTIFICATION CRITERIA:**

**CHILD INDICATORS (Ages 2-7):**

**Strong Evidence:**
- Repetitive/echolalic speech (repeating what adult just said)
- Egocentric language: "I want", "mine", "me", "给我" (give me)
- Present-focused: "now", "here", immediate needs/desires
- Request patterns: "I want X", "可以吗?" (can I?), "给我..." (give me)
- Play-related vocabulary: toys, animals, colors, simple actions
- Emotional expressions: "哎呀!" (oops!), "不要!" (don't want!), whining, crying sounds
- Questions about objects: "这是什么?" (what's this?), "在哪里?" (where is it?)
- Incomplete sentences: missing subjects or verbs
- Seeking approval: "好不好?" (is this OK?), "妈妈你看" (mama look)

**Moderate Evidence:**
- Simple grammar (may have errors even in older children)
- Concrete language (rarely uses abstract concepts like "responsibility")
- Simple connectors: prefers "and", "then" over "because", "although"
- Echoing adult words, especially English words

**DO NOT Rely Solely On:**
- Utterance length (7-year-olds can produce long, complex sentences)
- Character count (varies greatly by age and language)

---

**ADULT INDICATORS:**

**Strong Evidence:**
- Commands/directives: "把东西收起来" (put things away), "cleanup", "put it here"
- Teaching questions: "What color is that?", "Can you count them?", "这是什么颜色?" (what color?)
- Praise patterns: "真棒!" (great job!), "Good!", "你很棒!" (you're awesome!)
- Conditional statements: "If you..., then...", "等一下..." (wait a moment...)
- Explanatory language: giving reasons using "because", "so that"
- Time references: past/future tense, planning ahead
- Behavior management: "要听话" (be good), "listen to me", meta-talk about behavior
- Politeness coaching: "说谢谢" (say thank you), "say please"
- Indirect commands: "你把...好吗?" (can you... OK?) - classic adult pattern in Chinese
- Third-person self-reference: "妈妈要..." (mama wants...) - parent speaking about themselves

**Moderate Evidence:**
- Complex syntax: embedded clauses, multiple verbs in one sentence
- Abstract vocabulary: emotions, values, time concepts, reasoning
- Language mixing: code-switching between English and Chinese (adults do this more frequently)
- Checking comprehension: "明白吗?" (understand?), "好吗?" (OK?)
- Longer average utterances (but compare relatively within this transcript)

---

**ANALYSIS PROCESS:**

1. **Count indicators:** For each speaker, count how many utterances contain CHILD vs ADULT indicators

2. **Look for patterns:** Don't judge based on single utterances; look for consistent patterns across all their speech

3. **Relative comparison:** Compare speakers to each other (who is shortest/longest, simplest/most complex)

4. **Consider context:** Who is giving commands to whom? Who is seeking approval from whom?

5. **Flag ambiguity:** If confidence < 0.70, mark as ambiguous and explain why

---

**SPECIAL CASES:**

**Case 1: Older sibling (6-7yo) giving commands to younger sibling**
- Mark as CHILD if: They also play with toys, receive commands from adults, seek approval
- Mark as ADULT if: Consistently in caregiver role, no one directs them, sustained teaching behavior

**Case 2: Very quiet adult (helper/grandparent with minimal speech)**
- Look for: Who are they responding to? Do they receive commands or give them?
- Default to ADULT if: Responding to children, giving acknowledgments, even if brief

**Case 3: Child with advanced language (5-7yo)**
- Can produce complex sentences but still shows: request patterns, seeking approval, play focus, egocentric language
- Mark as CHILD even if utterances are long

**Case 4: Code-mixing patterns**
- Adults: More likely to insert English commands into Chinese speech ("cleanup", "OK", "good job")
- Children: More likely to echo English words they just heard from adults

**Case 5: Very short utterances ("嗯", "好", "哦")**
- Context matters: Are they responding to adult questions (→ likely CHILD) or acknowledging child speech (→ likely ADULT)?
- If still unclear, mark ambiguous

---

**CONFIDENCE LEVELS:**

- **High (0.85-1.0):** Clear, strong indicators with consistent patterns
- **Moderate (0.70-0.84):** Some indicators present, but mixed signals or limited data
- **Low (0.0-0.69):** Ambiguous case, flag for human review

When confidence < 0.70, you MUST set "ambiguous": true and explain the reasoning.

---

**INPUT DATA:**
${JSON.stringify(utterancesForPrompt, null, 2)}

---

**OUTPUT FORMAT (JSON only):**

Return ONLY valid JSON with this exact structure:

{{
  "speaker_identification": {{
    "speaker_0": {{
      "role": "CHILD",
      "confidence": 0.95,
      "reasoning": "Strong child indicators: 4 request patterns ('我要...'), 3 emotional expressions ('哎呀!'), seeking approval ('好不好?'), play-focused vocabulary",
      "child_indicators_count": 8,
      "adult_indicators_count": 0,
      "utterance_count": 12,
      "ambiguous": false,
      "ambiguous_reason": null
    }},
    "speaker_1": {{
      "role": "ADULT",
      "confidence": 0.98,
      "reasoning": "Strong adult indicators: 5 commands, code-mixing ('cleanup'), teaching politeness ('谢谢'), behavior management",
      "child_indicators_count": 0,
      "adult_indicators_count": 9,
      "utterance_count": 11,
      "ambiguous": false,
      "ambiguous_reason": null
    }},
    "speaker_2": {{
      "role": "ADULT",
      "confidence": 0.92,
      "reasoning": "Adult indicators: indirect commands ('你把...好吗?'), praise with specificity ('阿雅在收拾啦，你真棒!'), inclusive planning ('我们一起收吧')",
      "child_indicators_count": 0,
      "adult_indicators_count": 7,
      "utterance_count": 13,
      "ambiguous": false,
      "ambiguous_reason": null
    }}
  }},
  
  "analysis_summary": {{
    "total_speakers": 3,
    "total_children": 1,
    "total_adults": 2,
    "challenging_cases": [],
    "notes": "Clear role differentiation. Speaker_0 shows consistent child patterns (requests, approval-seeking). Speaker_1 and speaker_2 both show strong parenting behaviors."
  }}
}}

**CRITICAL INSTRUCTIONS:**
- Return ONLY the JSON object, nothing else
- Do NOT write any explanatory text before or after the JSON
- Do NOT use markdown code blocks like \`\`\`json
- Do NOT say "I'm ready" or "Here is the output" or any other text
- Your ENTIRE response must be ONLY the JSON object starting with {{ and ending with }}
- First character of your response MUST be {{
- Last character of your response MUST be }}`;

  console.log(`📊 [ANALYSIS-STEP-3] Calling Claude API for role identification...`);

  const identifyResponse = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: identifyParentPrompt
      }]
    })
  });

  if (!identifyResponse.ok) {
    const errorData = await identifyResponse.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Claude API error (identify parent): ${identifyResponse.status}`);
  }

  const identifyData = await identifyResponse.json();
  const roleIdentificationText = identifyData.content[0].text.trim();
  console.log(`✅ [ANALYSIS-STEP-3] Claude API response received, length: ${roleIdentificationText.length} chars`);

  // Parse the JSON response
  console.log(`📊 [ANALYSIS-STEP-4] Parsing role identification JSON...`);
  let roleIdentificationJson;
  let adultSpeakers = [];
  try {
    let cleanJson = roleIdentificationText.trim();

    // Remove markdown code blocks if present
    cleanJson = cleanJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Try to extract JSON object if there's text before/after it
    // Look for the first { and last }
    const firstBrace = cleanJson.indexOf('{');
    const lastBrace = cleanJson.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
    }

    roleIdentificationJson = JSON.parse(cleanJson);
    console.log(`✅ [ANALYSIS-STEP-4] JSON parsed successfully`);

    // Extract all adult speakers from speaker_identification
    const speakerIdentification = roleIdentificationJson.speaker_identification || {};

    for (const [speakerId, speakerInfo] of Object.entries(speakerIdentification)) {
      if (speakerInfo.role === 'ADULT') {
        adultSpeakers.push({
          id: speakerId,
          confidence: speakerInfo.confidence,
          utteranceCount: speakerInfo.utterance_count || 0
        });
      }
    }

    // Sort adults by utterance count (most active first)
    adultSpeakers.sort((a, b) => b.utteranceCount - a.utteranceCount);

    if (adultSpeakers.length === 0) {
      throw new Error('No adult speakers found in role identification');
    }

    console.log(`Adult speakers identified: ${adultSpeakers.map(a => a.id).join(', ')}`);
    console.log('Role identification:', JSON.stringify(roleIdentificationJson, null, 2));

  } catch (parseError) {
    console.error('❌ [ROLE-ID-ERROR] Failed to parse role identification JSON:', parseError.message);
    console.error('❌ [ROLE-ID-ERROR] Raw response (first 500 chars):', roleIdentificationText.substring(0, 500));
    console.error('❌ [ROLE-ID-ERROR] Raw response (last 500 chars):', roleIdentificationText.substring(Math.max(0, roleIdentificationText.length - 500)));
    throw new Error(`Failed to parse role identification: ${parseError.message}`);
  }

  // Build role map from speaker identification
  console.log(`📊 [ANALYSIS-STEP-5] Building role map and updating database...`);
  const speakerIdentification = roleIdentificationJson.speaker_identification || {};
  const roleMap = {};
  for (const [speakerId, speakerInfo] of Object.entries(speakerIdentification)) {
    roleMap[speakerId] = speakerInfo.role.toLowerCase();
  }
  console.log(`   Role map: ${JSON.stringify(roleMap)}`);

  // Update utterances with role information in database
  await updateUtteranceRoles(sessionId, roleMap);
  console.log(`✅ [ANALYSIS-STEP-5] Updated roles for ${Object.keys(roleMap).length} speakers`);

  // Store role identification JSON in session
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      roleIdentificationJson
    }
  });
  console.log(`✅ [ANALYSIS-STEP-5] Role identification JSON stored in session`);

  // Get updated utterances for PCIT coding
  console.log(`📊 [ANALYSIS-STEP-6] Fetching updated utterances with roles for PCIT coding...`);
  const utterancesWithRoles = await getUtterances(sessionId);
  console.log(`✅ [ANALYSIS-STEP-6] Got ${utterancesWithRoles.length} utterances with roles`);

  // STEP 2: Apply PCIT coding to adult utterances
  console.log(`📊 [ANALYSIS-STEP-7] Preparing PCIT coding prompt...`);
  const adultSpeakerIds = adultSpeakers.map(a => a.id).join(', ');
  console.log(`   Adult speakers: ${adultSpeakerIds}`);

  // DPICS (Dyadic Parent-Child Interaction Coding System) prompt
  const systemPrompt = `You are an expert coder for the Dyadic Parent-Child Interaction Coding System (DPICS). Your task is to analyze a chronological dialogue log and assign the correct code to every Parent verbalization.

***Coding Strategy (Context Awareness)***

Analyze Sequentially: Read the list in order.
Reflections (RF): When coding a Parent segment, look at the immediately preceding Child segment. If the Parent repeats/paraphrases it, code RF1.
Pauses: Treat consecutive Parent segments as separate coding units3.

<coding_rules>
1. NEGATIVE TALK (NTA)

Definition: Critical statements, fault-finding, or disapproval.

Keywords: "No", "Don't", "Stop", "Quit", "Not" (when correcting), sarcasm.

Rule: Refusals of child requests or corrections of child facts ("That's not a car") are NTA.

Priority: High. If it criticizes, code NTA.

2. COMMANDS (DC / IC)

Direct Command (DC): Clearly stated order/demand in declarative form. Specific behavior expected.

Examples: "Put that there." "Sit down." "Tell me."

Note: "You are going to..." is DC unless child is already doing it (BD) or said they would (RF).

Indirect Command (IC): Order implied, optional, or in question form.

Keywords: "Let's...", "Can you...", "How about...", "If [behavior], then [consequence]".

Bids for Attention: Calling child's name ("Johnny!") is IC (No Opportunity).

Inclusive: "We need to..." is IC.

Decision Rule: If uncertain between DC and IC, code IC.

3. PRAISE (LP / UP)

Labeled Praise (LP): Positive evaluation + Specific behavior/product/attribute labeled.

Example: "Good job building that tower." "I love how quiet you are."

Unlabeled Praise (UP): Nonspecific positive evaluation.

Example: "Good job." "Nice!" "Awesome." "You're smart."

Rule: Praise in question form ("Isn't that pretty?") is still Praise.

Decision Rule: If uncertain between LP and UP, code UP.

4. BEHAVIORAL DESCRIPTION (BD)

Definition: Non-evaluative description of child's ongoing or immediately completed (<5s) observable behavior.

Subject: Must be "You" (or implied you).

Verbs: Must be action verbs. (Words like "think", "want", "know" are ID, not BD).

Example: "You are putting the red block on top."

Rule: If describing what child is NOT doing -> ID.

5. REFLECTION (RF)

Definition: Repeats or paraphrases child's immediately preceding verbalization. Retains meaning.

Rule: Must be declarative. If it has rising inflection (question tone) -> RQ.

6. QUESTIONS (Q / RQ)

Question (Q): Request for an answer or rising inflection.

Includes: "Do you want...", "Do you know...", "Remember when..."

Reflective Question (RQ): Repeats child's statement but with rising inflection (verifying).

7. ACKNOWLEDGEMENT (AK)

Definition: Brief, non-content response to child (e.g., "Yes", "Okay", "Uh-huh", "Sure").

Rule: "Yes/No" answers to child questions are AK. (Refusals are NTA).

8. INFORMATIONAL DESCRIPTION (ID) - The Default Category

Definition: Statements providing information about objects, events, the parent's own feelings/behavior, or the child's past (>5s) or future behavior.

Decision Rule: If a statement doesn't fit the specific criteria of the codes above (e.g., BD, Praise, Command), code ID.

Ambiguity Rule: If uncertain between ID and BD, code ID.

</coding_rules>`;

  // Prepare utterances data for the prompt (input1.json format)
  // Use idx instead of long utt.id to save tokens
  const utterancesData = utterancesWithRoles.map((utt, idx) => ({
    id: idx,
    role: utt.role,
    text: utt.text
  }));

  // Create index mapping for later (idx -> utt.id)
  const idxToUttId = utterancesWithRoles.map(utt => utt.id);

  // User prompt with template variables replaced
  const userPrompt = `**Input Format:**

You will receive a chronological JSON list of dialogue turns with ${utterancesWithRoles.length} conversations:

${JSON.stringify(utterancesData, null, 2)}

Each item has:
- role: Identify if the speaker is "parent" or "child"
- text: The content to analyze

**Output Specification:**

Output only a valid JSON array of objects for the Parent segments.

Format: [{"id": <int>, "code": <string>}, ...]

Do not include child segments in the output.

Do not include markdown or whitespace (minified JSON).

**CRITICAL INSTRUCTIONS:**
- Return ONLY the JSON array, nothing else
- Do NOT write any explanatory text before or after the JSON
- Do NOT use markdown code blocks like \`\`\`json
- Do NOT say "I'm ready" or "Here is the output" or any other text
- Your ENTIRE response must be ONLY the JSON array starting with [ and ending with ]
- First character of your response MUST be [
- Last character of your response MUST be ]`;

  console.log(`📊 [ANALYSIS-STEP-8] Calling Claude API for PCIT coding...`);
  console.log(`   Mode: ${isCDI ? 'CDI' : 'PDI'}, Utterances: ${utterancesWithRoles.length}`);

  // Call Claude API for PCIT coding
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      temperature: 0,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: userPrompt
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Claude API error (PCIT coding): ${response.status}`);
  }

  const data = await response.json();
  const fullResponse = data.content[0].text;

  // Parse JSON response
  let codingResults;
  try {
    let cleanJson = fullResponse.trim();

    // Remove markdown code blocks if present
    cleanJson = cleanJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Try to extract JSON array if there's text before/after it
    // Look for the first [ and last ]
    const firstBracket = cleanJson.indexOf('[');
    const lastBracket = cleanJson.lastIndexOf(']');

    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      cleanJson = cleanJson.substring(firstBracket, lastBracket + 1);
    }

    codingResults = JSON.parse(cleanJson);

    if (!Array.isArray(codingResults)) {
      throw new Error('Expected array of coding results');
    }

    console.log(`✅ [ANALYSIS-STEP-8] Successfully parsed ${codingResults.length} coding results`);
  } catch (parseError) {
    console.error('❌ [PCIT-CODING-ERROR] Failed to parse PCIT coding JSON:', parseError.message);
    console.error('❌ [PCIT-CODING-ERROR] Raw response (first 500 chars):', fullResponse.substring(0, 500));
    console.error('❌ [PCIT-CODING-ERROR] Raw response (last 500 chars):', fullResponse.substring(Math.max(0, fullResponse.length - 500)));
    throw new Error(`Failed to parse PCIT coding response: ${parseError.message}`);
  }

  // Map DPICS codes to display tag names
  const DPICS_TO_TAG_MAP = {
    'RF': 'Echo',
    'RQ': 'Echo',
    'LP': 'Labeled Praise',
    'UP': 'Unlabeled Praise',
    'BD': 'Narration',
    'DC': 'Command',
    'IC': 'Command',
    'Q': 'Question',
    'NTA': 'Criticism',
    'ID': 'Neutral',
    'AK': 'Neutral'
  };

  // Build ID-to-tag maps for efficient updates
  // Map idx back to actual utt.id
  const pcitTagMap = {}; // DPICS codes (RF, LP, etc.)
  const noraTagMap = {}; // Display names (Echo, Labeled Praise, etc.)

  for (const result of codingResults) {
    if (result.id !== undefined && result.code) {
      const actualUttId = idxToUttId[result.id];
      if (actualUttId) {
        pcitTagMap[actualUttId] = result.code; // Store DPICS code
        noraTagMap[actualUttId] = DPICS_TO_TAG_MAP[result.code] || result.code; // Store display name
      }
    }
  }

  // Update utterances with both PCIT tags and Nora tags in database
  await updateUtteranceTags(sessionId, pcitTagMap, noraTagMap);

  console.log(`Updated tags for ${Object.keys(pcitTagMap).length} utterances`);

  // Count codes from JSON results (using DPICS codes)
  const tagCounts = {};
  tagCounts.echo = 0;
  tagCounts.labeled_praise = 0;
  tagCounts.unlabeled_praise = 0;
  tagCounts.praise = 0; // Combined praise
  tagCounts.narration = 0;
  tagCounts.direct_command = 0;
  tagCounts.indirect_command = 0;
  tagCounts.command = 0; // Combined commands
  tagCounts.question = 0;
  tagCounts.criticism = 0;
  tagCounts.neutral = 0;
 // tagCounts.acknowledgement = 0;

  for (const result of codingResults) {
    const code = result.code;
    if (code === 'RF' || code === 'RQ') {
      tagCounts.echo++;
    }
    else if (code === 'LP') {
      tagCounts.labeled_praise++;
      tagCounts.praise++;
    }
    else if (code === 'UP') {
      tagCounts.unlabeled_praise++;
      //tagCounts.praise++;
    }
    else if (code === 'BD') {
      tagCounts.narration++;
    }
    else if (code === 'DC') {
      tagCounts.direct_command++;
      tagCounts.command++;
    }
    else if (code === 'IC') {
      tagCounts.indirect_command++;
      tagCounts.command++;
    }
    else if (code === 'Q') {
      tagCounts.question++;
    }
    else if (code === 'NTA') {
      tagCounts.criticism++;
    }
    else if (code === 'ID') {
      tagCounts.neutral++;
    }
    else if (code === 'AK') {
      tagCounts.neutral++;
    }
  }

  // Get competency analysis based on tag counts and utterances
  let competencyAnalysis = null;
  try {
    // Get updated utterances with tags from database
    const utterancesWithTags = await getUtterances(sessionId);

    const competencyPrompt = isCDI
      ? generateCDICompetencyPrompt(tagCounts, utterancesWithTags)
      : generatePDICompetencyPrompt(tagCounts, utterancesWithTags);

    const competencyResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        temperature: 0.7,
        messages: [{
          role: 'user',
          content: competencyPrompt
        }]
      })
    });

    if (competencyResponse.ok) {
      const competencyData = await competencyResponse.json();
      const analysisText = competencyData.content[0].text;

      // Try to parse as JSON
      let parsedAnalysis = null;
      try {
        let cleanJson = analysisText.trim();

        // Remove markdown code blocks if present
        cleanJson = cleanJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Try to extract JSON object if there's text before/after it
        const firstBrace = cleanJson.indexOf('{');
        const lastBrace = cleanJson.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
        }

        parsedAnalysis = JSON.parse(cleanJson);
        console.log(`✅ [COMPETENCY-ANALYSIS] Successfully parsed competency analysis JSON`);
      } catch (parseError) {
        console.error('⚠️ [COMPETENCY-ANALYSIS] Failed to parse competency analysis as JSON:', parseError.message);
        console.error('⚠️ [COMPETENCY-ANALYSIS] Raw response (first 300 chars):', analysisText.substring(0, 300));
        // Fallback to raw text
        parsedAnalysis = {
          topMoment: null,
          tips: analysisText,
          reminder: null
        };
      }

      // Store structured analysis with formatted tips
      competencyAnalysis = {
        topMoment: parsedAnalysis.topMoment,
        tips: formatTips(parsedAnalysis.tips),
        reminder: parsedAnalysis.reminder,
        analyzedAt: new Date().toISOString(),
        mode: session.mode
      };

      console.log(`Competency analysis generated for session ${sessionId}`);
    } else {
      console.error(`Competency analysis failed for session ${sessionId}`);
    }
  } catch (compError) {
    console.error('Error generating competency analysis:', compError.message);
    // Continue without competency analysis - not critical
  }

  // Calculate Nora Score
  let overallScore = 0;

  if (isCDI) {
    // CDI mode - PEN skills (60 points) + Avoid penalty (40 points)
    const praiseScore = Math.min(20, ((tagCounts.praise || 0) / 10) * 20);
    const echoScore = Math.min(20, ((tagCounts.echo || 0) / 10) * 20);
    const narrationScore = Math.min(20, ((tagCounts.narration || 0) / 10) * 20);
    const penScore = praiseScore + echoScore + narrationScore;

    // Avoid Penalty: 40 points if total < 3, decreasing by 10 for each additional
    const totalAvoid = (tagCounts.question || 0) + (tagCounts.command || 0) + (tagCounts.criticism || 0);
    let avoidScore = 40;
    if (totalAvoid >= 3) {
      avoidScore = Math.max(0, 40 - (totalAvoid - 2) * 10);
    }

    overallScore = Math.round(penScore + avoidScore);
  } else {
    // PDI mode - Command effectiveness
    const totalCommands = (tagCounts.direct_command || 0) + (tagCounts.indirect_command || 0) +
      (tagCounts.vague_command || 0) + (tagCounts.chained_command || 0);
    const effectiveCommands = tagCounts.direct_command || 0;
    overallScore = totalCommands > 0 ? Math.round((effectiveCommands / totalCommands) * 100) : 0;
  }

  // Store PCIT coding, competency analysis, and overall score in database
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      pcitCoding: {
        adultSpeakers,
        codingResults,
        fullResponse,
        analyzedAt: new Date().toISOString()
      },
      tagCounts,
      competencyAnalysis,
      overallScore
    }
  });

  console.log(`PCIT coding and overall score (${overallScore}) stored for session ${sessionId}`);

  // Check if user should advance to DISCIPLINE phase
  // Only check if user is still in CONNECT phase (no need to check if already in DISCIPLINE)
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
    // Don't fail the analysis if phase check fails
  }
}

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    const allowedMimeTypes = [
      'audio/mp4',
      'audio/aac',
      'audio/mpeg',
      'audio/wav',
      'audio/webm',
      'audio/m4a',
      'audio/x-m4a'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only audio files are allowed.`));
    }
  }
});

/**
 * POST /api/recordings/upload/init
 * Initialize upload and get presigned S3 URL for direct upload
 *
 * Request body:
 * - durationSeconds: Recording duration in seconds (required)
 * - mimeType: Audio MIME type (optional, default: 'audio/m4a')
 *
 * Returns:
 * - sessionId: Unique ID for the recording session
 * - uploadUrl: Presigned S3 URL for direct upload
 * - uploadKey: S3 key where file will be stored
 * - expiresIn: URL expiration time in seconds
 */
router.post('/upload/init', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { durationSeconds, mimeType = 'audio/m4a' } = req.body;

    // Validate duration
    if (!durationSeconds || durationSeconds < 1) {
      return res.status(400).json({
        error: 'Invalid duration',
        details: 'durationSeconds must be a positive number'
      });
    }

    // Generate session ID
    const sessionId = crypto.randomUUID();

    console.log(`[UPLOAD-INIT] Starting upload for user ${userId.substring(0, 8)}, session ${sessionId.substring(0, 8)}`);

    // Create initial session record
    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId: userId,
        mode: 'CDI', // Default to CDI for mobile recordings
        storagePath: 'pending_upload', // Temporary status
        durationSeconds: parseInt(durationSeconds, 10),
        transcript: '',
        aiFeedbackJSON: {},
        pcitCoding: {},
        tagCounts: {},
        masteryAchieved: false,
        riskScore: 0,
        flaggedForReview: false,
        analysisStatus: 'PENDING'
      }
    });

    // Generate presigned upload URL
    try {
      const { url, key, expiresIn } = await storage.getPresignedUploadUrl(userId, sessionId, mimeType);

      console.log(`[UPLOAD-INIT] Presigned URL generated for session ${sessionId.substring(0, 8)}, expires in ${expiresIn}s`);

      res.json({
        sessionId,
        uploadUrl: url,
        uploadKey: key,
        expiresIn
      });
    } catch (presignError) {
      console.error('[UPLOAD-INIT] Failed to generate presigned URL:', presignError);

      // Delete the session record since we can't proceed
      await prisma.session.delete({
        where: { id: sessionId }
      });

      return res.status(500).json({
        error: 'Failed to initialize upload',
        details: presignError.message
      });
    }

  } catch (error) {
    console.error('[UPLOAD-INIT] Error:', error);
    res.status(500).json({
      error: 'Upload initialization failed',
      details: 'Failed to initialize upload. Please try again.'
    });
  }
});

/**
 * POST /api/recordings/upload/complete
 * Confirm upload completion and trigger background processing
 *
 * Request body:
 * - sessionId: Session ID from upload/init (required)
 * - uploadKey: S3 key from upload/init (required)
 *
 * Returns:
 * - recordingId: Session ID
 * - status: 'uploaded'
 * - message: Success message
 */
router.post('/upload/complete', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { sessionId, uploadKey } = req.body;

    // Validate input
    if (!sessionId || !uploadKey) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'sessionId and uploadKey are required'
      });
    }

    console.log(`[UPLOAD-COMPLETE] Verifying upload for session ${sessionId.substring(0, 8)}`);

    // Get session from database
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        details: 'Invalid session ID'
      });
    }

    // Verify ownership
    if (session.userId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You do not have permission to access this session'
      });
    }

    // Verify file exists in S3
    let fileInfo;
    try {
      fileInfo = await storage.verifyFileExists(uploadKey);

      if (!fileInfo.exists) {
        console.error(`[UPLOAD-COMPLETE] File not found in S3: ${uploadKey}`);
        return res.status(400).json({
          error: 'Upload verification failed',
          details: 'File not found in S3. Please try uploading again.'
        });
      }

      console.log(`[UPLOAD-COMPLETE] File verified in S3: ${uploadKey} (${fileInfo.size} bytes)`);
    } catch (verifyError) {
      console.error('[UPLOAD-COMPLETE] File verification error:', verifyError);
      return res.status(500).json({
        error: 'Upload verification failed',
        details: 'Failed to verify file upload. Please try again.'
      });
    }

    // Update session with storage path
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        storagePath: uploadKey,
        analysisStatus: 'PROCESSING'
      }
    });

    console.log(`[UPLOAD-COMPLETE] Session ${sessionId.substring(0, 8)} updated with storage path: ${uploadKey}`);

    // Trigger transcription automatically in the background
    console.log(`[UPLOAD-COMPLETE] Triggering background transcription for session ${sessionId.substring(0, 8)}`);
    transcribeRecording(sessionId, userId, uploadKey, session.durationSeconds)
      .then(() => {
        console.log(`✅ [UPLOAD-COMPLETE] Background transcription completed for session ${sessionId.substring(0, 8)}`);
      })
      .catch(async (err) => {
        console.error(`❌ [UPLOAD-COMPLETE] Background transcription failed for session ${sessionId.substring(0, 8)}:`, err);

        // Update session with permanent failure
        try {
          await prisma.session.update({
            where: { id: sessionId },
            data: {
              analysisStatus: 'FAILED',
              analysisError: err.message || 'Transcription failed',
              analysisFailedAt: new Date(),
              permanentFailure: true
            }
          });

          // Report permanent failure to team
          await reportPermanentFailureToTeam(sessionId, err);
        } catch (updateErr) {
          console.error(`❌ [UPLOAD-COMPLETE] Failed to update session status:`, updateErr);
        }
      });

    // Return success response immediately
    res.status(201).json({
      recordingId: sessionId,
      status: 'uploaded',
      message: 'Upload confirmed. Processing started in background.',
      fileSize: fileInfo.size
    });

  } catch (error) {
    console.error('[UPLOAD-COMPLETE] Error:', error);
    res.status(500).json({
      error: 'Upload completion failed',
      details: 'Failed to complete upload. Please try again.'
    });
  }
});

/**
 * POST /api/recordings/upload
 * Upload audio recording from mobile app (LEGACY - kept for backward compatibility)
 *
 * Multipart form data:
 * - audio: Audio file (required)
 * - durationSeconds: Recording duration in seconds (optional)
 *
 * Returns:
 * - recordingId: Unique ID for the recording
 * - storagePath: S3 path or mock path
 * - status: 'uploaded' | 'pending_transcription'
 */
// TEMPORARY: Auth disabled for development
// TODO: Re-enable requireAuth when authentication is implemented
router.post('/upload', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    // Validate file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: 'No audio file provided',
        details: 'Please include an audio file in the "audio" field'
      });
    }

    const userId = req.userId;

    console.log('Received audio upload:', {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      userId: userId
    });

    // Extract duration from request body
    const durationSeconds = req.body.durationSeconds
      ? parseInt(req.body.durationSeconds, 10)
      : 0;

    // Generate session ID
    const sessionId = crypto.randomUUID();

    // Create initial session record
    const session = await prisma.session.create({
      data: {
        id: sessionId,
        userId: userId,
        mode: 'CDI', // Default to CDI for mobile recordings
        storagePath: 'uploading', // Temporary status
        durationSeconds,
        transcript: '', // Will be filled by transcription
        aiFeedbackJSON: {},
        pcitCoding: {},
        tagCounts: {},
        masteryAchieved: false,
        riskScore: 0,
        flaggedForReview: false
      }
    });

    // Upload audio file to S3 with correct MIME type
    let storagePath;
    try {
      storagePath = await storage.uploadAudioFile(
        req.file.buffer,
        userId,
        sessionId,
        req.file.mimetype // Pass MIME type from multer (e.g., 'audio/m4a')
      );

      // Update session with storage path
      await prisma.session.update({
        where: { id: sessionId },
        data: { storagePath }
      });

      console.log(`Audio uploaded successfully: ${storagePath}`);
    } catch (uploadError) {
      console.error('S3 upload failed:', uploadError);

      // Delete the session record since upload failed
      await prisma.session.delete({
        where: { id: sessionId }
      });

      return res.status(500).json({
        error: 'Failed to upload audio file',
        details: uploadError.message
      });
    }

    // Trigger transcription automatically in the background
    // Don't wait for it to complete - return success immediately
    console.log(`🚀 [UPLOAD] Triggering background transcription for session ${sessionId}`);
    transcribeRecording(sessionId, userId, storagePath, durationSeconds)
      .then(() => {
        console.log(`✅ [UPLOAD] Background transcription completed for session ${sessionId}`);
      })
      .catch(async (err) => {
        console.error(`❌ [UPLOAD] Background transcription failed for session ${sessionId}:`, err);
        console.error(`❌ [UPLOAD] Error stack:`, err.stack);

        // Update session with permanent failure
        try {
          await prisma.session.update({
            where: { id: sessionId },
            data: {
              analysisStatus: 'FAILED',
              analysisError: err.message || 'Transcription failed',
              analysisFailedAt: new Date(),
              permanentFailure: true
            }
          });

          // Report permanent failure to team
          await reportPermanentFailureToTeam(sessionId, err);
        } catch (updateErr) {
          console.error(`❌ [UPLOAD] Failed to update session status:`, updateErr);
        }
      });

    // Return success response immediately
    res.status(201).json({
      recordingId: sessionId,
      storagePath,
      status: 'uploaded',
      message: 'Audio uploaded successfully. Transcription started in background.',
      durationSeconds
    });

  } catch (error) {
    console.error('❌ [UPLOAD] Recording upload error:', error);
    console.error('❌ [UPLOAD] Error type:', error.constructor.name);
    console.error('❌ [UPLOAD] Error message:', error.message);
    console.error('❌ [UPLOAD] Error stack:', error.stack);

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File too large',
          details: 'Audio file must be less than 50MB'
        });
      }
      return res.status(400).json({
        error: 'Upload error',
        details: error.message
      });
    }

    // Never expose internal errors (Prisma, database, etc.) to clients
    res.status(500).json({
      error: 'Upload failed',
      details: 'Upload failed. Please try upload again.'
    });
  }
});

/**
 * GET /api/recordings/dashboard
 * Get dashboard data for HomeScreen (optimized single call)
 * Returns today's recordings, this week's recordings, and latest completed report
 *
 * All date calculations use Singapore timezone (UTC+8)
 *
 * IMPORTANT: This route MUST be defined before /:id routes to prevent matching "dashboard" as an ID
 */
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    // Calculate Singapore timezone dates
    const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;
    const now = new Date();
    const sgtNow = new Date(now.getTime() + SGT_OFFSET_MS);

    // Get start and end of today (Singapore time)
    const todayStart = new Date(Date.UTC(
      sgtNow.getUTCFullYear(),
      sgtNow.getUTCMonth(),
      sgtNow.getUTCDate(),
      0, 0, 0, 0
    ));
    todayStart.setTime(todayStart.getTime() - SGT_OFFSET_MS);

    const todayEnd = new Date(Date.UTC(
      sgtNow.getUTCFullYear(),
      sgtNow.getUTCMonth(),
      sgtNow.getUTCDate(),
      23, 59, 59, 999
    ));
    todayEnd.setTime(todayEnd.getTime() - SGT_OFFSET_MS);

    // Get start of current week (Monday in Singapore time)
    const dayOfWeek = sgtNow.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(sgtNow);
    weekStart.setUTCDate(sgtNow.getUTCDate() + mondayOffset);
    weekStart.setUTCHours(0, 0, 0, 0);
    weekStart.setTime(weekStart.getTime() - SGT_OFFSET_MS);

    // Run queries in parallel for efficiency
    const [todayRecordings, thisWeekRecordings, latestWithReport] = await Promise.all([
      // 1. Today's recordings
      prisma.session.findMany({
        where: {
          userId: userId,
          createdAt: {
            gte: todayStart,
            lte: todayEnd
          }
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          mode: true,
          durationSeconds: true,
          createdAt: true,
          overallScore: true,
          analysisStatus: true
        }
      }),

      // 2. This week's recordings (for streak calculation)
      prisma.session.findMany({
        where: {
          userId: userId,
          createdAt: {
            gte: weekStart
          }
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          createdAt: true
        }
      }),

      // 3. Latest recording with completed analysis
      prisma.session.findFirst({
        where: {
          userId: userId,
          analysisStatus: 'COMPLETED'
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          createdAt: true,
          overallScore: true,
          durationSeconds: true,
          analysisStatus: true
        }
      })
    ]);

    res.json({
      todayRecordings: todayRecordings || [],
      thisWeekRecordings: thisWeekRecordings || [],
      latestWithReport: latestWithReport || null
    });

  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * GET /api/recordings/:id
 * Get recording details including transcription and analysis
 */
// TEMPORARY: Auth disabled for development
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id }
    });

    if (!session) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // TEMPORARY: Skip ownership check when auth is disabled
    const userId = req.userId || 'test-user-id';
    if (req.userId && session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Return session details
    res.json({
      id: session.id,
      mode: session.mode,
      durationSeconds: session.durationSeconds,
      transcript: session.transcript,
      pcitCoding: session.pcitCoding,
      tagCounts: session.tagCounts,
      masteryAchieved: session.masteryAchieved,
      riskScore: session.riskScore,
      flaggedForReview: session.flaggedForReview,
      createdAt: session.createdAt,
      status: session.transcript ? 'transcribed' : 'uploaded'
    });

  } catch (error) {
    console.error('Get recording error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * GET /api/recordings/:id/analysis
 * Get detailed analysis results for a recording
 * Returns PRN skills breakdown, transcript segments, and recommendations
 */
// TEMPORARY: Auth disabled for development
router.get('/:id/analysis', async (req, res) => {
  try {
    const { id } = req.params;

    const session = await prisma.session.findUnique({
      where: { id }
    });

    if (!session) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // TEMPORARY: Skip ownership check when auth is disabled
    const userId = req.userId || 'test-user-id';
    if (req.userId && session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Log current session status for debugging
    console.log(`[GET-ANALYSIS] Session ${id.substring(0, 8)} - Status: ${session.analysisStatus}, Has transcript: ${!!session.transcript}, Has pcitCoding: ${!!session.pcitCoding && Object.keys(session.pcitCoding).length > 0}`);

    // Check if analysis failed
    if (session.analysisStatus === 'FAILED') {
      console.log(`[GET-ANALYSIS] Returning FAILED status for session ${id.substring(0, 8)}`);
      return res.status(500).json({
        status: 'failed',
        error: 'Report generation failed',
        message: session.analysisError || 'An error occurred while analyzing your recording. Please try recording again.',
        failedAt: session.analysisFailedAt
      });
    }

    // Check if analysis is complete
    if (!session.transcript) {
      console.log(`[GET-ANALYSIS] Returning PROCESSING (no transcript) for session ${id.substring(0, 8)}`);
      return res.status(202).json({
        status: 'processing',
        message: 'Transcription in progress'
      });
    }

    if (session.analysisStatus !== 'COMPLETED' || !session.pcitCoding || Object.keys(session.pcitCoding).length === 0) {
      console.log(`[GET-ANALYSIS] Returning PROCESSING (status=${session.analysisStatus}) for session ${id.substring(0, 8)}`);
      return res.status(202).json({
        status: 'processing',
        message: 'PCIT analysis in progress'
      });
    }

    console.log(`[GET-ANALYSIS] Returning COMPLETED for session ${id.substring(0, 8)}`);

    // Get utterances from database
    const utterances = await getUtterances(session.id);
    const transcriptSegments = utterances.map(utt => ({
      speaker: utt.speaker,
      text: utt.text,
      start: utt.startTime,
      end: utt.endTime,
      role: utt.role,
      tag: utt.noraTag  // Use display name for UI
    }));

    // Format skills data for the report
    const isCDI = session.mode === 'CDI';
    let skills = [];
    let areasToAvoid = [];

    // Use stored overallScore from database instead of recalculating
    // This ensures consistency with the score calculated during analysis
    const noraScore = session.overallScore || 0;

    // Format skills and areas to avoid based on mode
    if (isCDI) {
      // CDI mode - PEN skills
      const tagCounts = session.tagCounts || {};
      skills = [
        { label: 'Praise (Labeled)', progress: tagCounts.praise || 0 },
        { label: 'Echo', progress: tagCounts.echo || 0 },
        { label: 'Narrate', progress: tagCounts.narration || 0 }
      ];

      // Areas to avoid - always show all categories with counts
      areasToAvoid = [
        { label: 'Questions', count: tagCounts.question || 0 },
        { label: 'Commands', count: tagCounts.command || 0 },
        { label: 'Criticism', count: tagCounts.criticism || 0 }
      ];
    } else {
      // PDI mode - Command skills
      const tagCounts = session.tagCounts || {};
      const totalCommands = (tagCounts.direct_command || 0) + (tagCounts.indirect_command || 0) +
        (tagCounts.vague_command || 0) + (tagCounts.chained_command || 0);
      const effectiveCommands = tagCounts.direct_command || 0;
      const effectivePercent = totalCommands > 0 ? Math.round((effectiveCommands / totalCommands) * 100) : 0;

      skills = [
        { label: 'Direct Commands', progress: effectivePercent },
        { label: 'Labeled Praise', progress: Math.min(100, (tagCounts.labeled_praise || 0) * 10) }
      ];

      if (tagCounts.indirect_command > 5) areasToAvoid.push('Indirect Commands');
      if (tagCounts.negative_command > 3) areasToAvoid.push('Negative Commands');
      if (tagCounts.vague_command > 3) areasToAvoid.push('Vague Commands');
      if (tagCounts.harsh_tone > 0) areasToAvoid.push('Harsh Tone');
    }

    // Get top moment from competency analysis or fallback to rule-based
    let topMomentQuote = null;
    if (session.competencyAnalysis?.topMoment) {
      topMomentQuote = session.competencyAnalysis.topMoment;
    } else {
      // Fallback: find first praise or positive statement
      const pcitCoding = session.pcitCoding;
      const codingLines = pcitCoding.coding ? pcitCoding.coding.split('\n') : [];
      for (const line of codingLines) {
        if (line.includes('[DO: Praise]') || line.includes('[DO: Labeled Praise]') || line.includes('[DO: Narration]')) {
          const quoteMatch = line.match(/"([^"]+)"/);
          if (quoteMatch) {
            topMomentQuote = quoteMatch[1];
            break;
          }
        }
      }
      if (!topMomentQuote && transcriptSegments.length > 0) {
        topMomentQuote = transcriptSegments[0].text;
      }
    }

    // Get tips from competency analysis or fallback to rule-based
    const tips = session.competencyAnalysis?.tips
      ? session.competencyAnalysis.tips
      : formatTips(isCDI
        ? `Focus on increasing your use of ${skills[0].progress < 50 ? 'Praise' : skills[1].progress < 50 ? 'Reflections' : 'Narrations'}. Try to describe what your child is doing without asking Questions or giving Commands.`
        : `Work on making your Commands more direct and specific. Avoid phrasing Commands as Questions.`);

    // Get reminder from competency analysis
    const reminder = session.competencyAnalysis?.reminder || null;

    // Calculate tomorrow's goal
    const tomorrowGoal = isCDI
      ? `Use ${Math.max(10, (session.tagCounts?.praise || 0) + 2)} Praises`
      : `Give ${Math.max(10, (session.tagCounts?.direct_command || 0) + 2)} Direct Commands`;

    // Return comprehensive analysis
    res.json({
      id: session.id,
      mode: session.mode,
      durationSeconds: session.durationSeconds,
      createdAt: session.createdAt,
      status: 'completed',
      encouragement: "Amazing job on your session! Here is how it went.",
      noraScore,
      skills,
      areasToAvoid,
      topMoment: {
        quote: topMomentQuote || "Great session!",
        audioUrl: '', // TODO: Add audio segment URL
        duration: '0:12'
      },
      tips,
      reminder,
      tomorrowGoal,
      stats: {
        totalPlayTime: `${Math.floor(session.durationSeconds / 60)} min ${session.durationSeconds % 60} sec`,
        ...session.tagCounts
      },
      transcript: transcriptSegments,
      pcitCoding: session.pcitCoding,
      competencyAnalysis: session.competencyAnalysis || null
    });

  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * GET /api/recordings
 * Get recordings for the authenticated user
 *
 * Query parameters:
 * - from: ISO date string for start of date range (optional)
 * - to: ISO date string for end of date range (optional)
 *
 * If no date range is provided, returns all recordings.
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { from, to } = req.query;

    // Build where clause with optional date filtering
    const where = { userId: userId };

    if (from || to) {
      where.createdAt = {};
      if (from) {
        where.createdAt.gte = new Date(from);
      }
      if (to) {
        where.createdAt.lte = new Date(to);
      }
    }

    const sessions = await prisma.session.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        mode: true,
        durationSeconds: true,
        masteryAchieved: true,
        createdAt: true,
        transcript: true,
        overallScore: true
      }
    });

    // Map sessions to include status
    const recordings = sessions.map(session => ({
      id: session.id,
      mode: session.mode,
      durationSeconds: session.durationSeconds,
      masteryAchieved: session.masteryAchieved,
      createdAt: session.createdAt,
      status: session.transcript ? 'transcribed' : 'uploaded',
      overallScore: session.overallScore
    }));

    res.json({ recordings });

  } catch (error) {
    console.error('Get recordings error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * POST /api/recordings/:id/transcribe
 * Trigger transcription for an uploaded recording
 *
 * Workflow:
 * 1. Fetch audio file from S3
 * 2. Send to transcription service (ElevenLabs/Deepgram/AssemblyAI)
 * 3. Store transcript in Session table
 * 4. Return transcript segments with speaker labels
 */
// TEMPORARY: Auth disabled for development
router.post('/:id/transcribe', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId || 'test-user-id';

    // Get session from database
    const session = await prisma.session.findUnique({
      where: { id }
    });

    if (!session) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // TEMPORARY: Skip ownership check when auth is disabled
    if (req.userId && session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if already transcribed
    if (session.transcript && session.transcript.length > 0) {
      return res.json({
        status: 'completed',
        transcript: session.transcript,
        message: 'Recording already transcribed'
      });
    }

    // Check if storagePath exists
    if (!session.storagePath) {
      return res.status(400).json({ error: 'No audio file associated with this recording' });
    }

    console.log(`Starting transcription for session ${id}, storage: ${session.storagePath}`);

    // Get audio file from S3
    let audioBuffer;
    try {
      if (session.storagePath.startsWith('mock://')) {
        // Mock mode: can't actually transcribe
        return res.status(503).json({
          error: 'Transcription not available in mock storage mode',
          details: 'S3 is not configured. Audio was saved to mock storage.'
        });
      }

      const getCommand = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: session.storagePath
      });

      const response = await s3Client.send(getCommand);

      // Convert stream to buffer
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      audioBuffer = Buffer.concat(chunks);

      console.log(`Retrieved audio from S3: ${audioBuffer.length} bytes`);
    } catch (s3Error) {
      console.error('S3 download error:', s3Error);
      return res.status(500).json({
        error: 'Failed to retrieve audio file',
        details: s3Error.message
      });
    }

    // Determine content type from storage path
    const extension = session.storagePath.split('.').pop();
    const contentTypeMap = {
      'm4a': 'audio/x-m4a',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'webm': 'audio/webm',
      'aac': 'audio/aac'
    };
    const contentType = contentTypeMap[extension] || 'audio/m4a';

    // Create anonymized request
    const requestId = await createAnonymizedRequest(
      userId,
      'deepgram', // Using Deepgram as default (best quality/price ratio)
      'transcription',
      { sessionId: id, audioSize: audioBuffer.length }
    );

    // Try transcription with Deepgram first (best for general use)
    let transcriptText = '';
    let transcriptSegments = [];

    try {
      console.log(`Sending to Deepgram for transcription (request: ${requestId})...`);

      const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
      if (!deepgramApiKey) {
        throw new Error('Deepgram API key not configured');
      }

      const deepgramResponse = await fetch(
        'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&punctuate=true&utterances=true',
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${deepgramApiKey}`,
            'Content-Type': contentType
          },
          body: audioBuffer
        }
      );

      if (!deepgramResponse.ok) {
        const errorData = await deepgramResponse.json().catch(() => ({}));
        throw new Error(errorData.err_msg || `Deepgram API error: ${deepgramResponse.status}`);
      }

      const result = await deepgramResponse.json();

      console.log('Deepgram transcription successful');

      // Extract transcript and utterances
      if (result.results?.utterances && result.results.utterances.length > 0) {
        transcriptSegments = result.results.utterances.map(utterance => ({
          speaker: utterance.speaker.toString(),
          text: utterance.transcript,
          start: utterance.start,
          end: utterance.end
        }));

        // Combine all utterances into full transcript
        transcriptText = transcriptSegments.map(seg => seg.text).join(' ');
      } else if (result.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
        // No diarization, single transcript
        transcriptText = result.results.channels[0].alternatives[0].transcript;
        transcriptSegments = [{
          speaker: '0',
          text: transcriptText,
          start: 0,
          end: session.durationSeconds || 0
        }];
      } else {
        throw new Error('No transcript returned from Deepgram');
      }

    } catch (transcriptionError) {
      console.error('Transcription error:', transcriptionError);
      return res.status(500).json({
        error: 'Transcription failed',
        details: transcriptionError.message,
        service: 'deepgram'
      });
    }

    // Store transcript in database
    try {
      await prisma.session.update({
        where: { id },
        data: {
          transcript: transcriptText,
          // Store segments in aiFeedbackJSON temporarily (will move to dedicated field later)
          aiFeedbackJSON: {
            transcriptSegments,
            transcribedAt: new Date().toISOString(),
            service: 'deepgram'
          }
        }
      });

      console.log(`Transcript stored for session ${id} (${transcriptText.length} chars)`);
    } catch (dbError) {
      console.error('Database update error:', dbError);
      // Return transcript even if DB update fails
      return res.json({
        status: 'completed',
        transcript: transcriptText,
        segments: transcriptSegments,
        warning: 'Transcript generated but not saved to database'
      });
    }

    // Return success with transcript
    res.json({
      status: 'completed',
      transcript: transcriptText,
      segments: transcriptSegments,
      wordCount: transcriptText.split(' ').length,
      durationSeconds: session.durationSeconds
    });

  } catch (error) {
    console.error('Transcribe recording error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

module.exports = router;
