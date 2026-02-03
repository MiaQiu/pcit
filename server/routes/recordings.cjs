/**
 * Recording Upload Routes
 * Handles audio recording uploads from mobile app
 */
const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const prisma = require('../services/db.cjs');
const storage = require('../services/storage-s3.cjs');
const { requireAuth } = require('../middleware/auth.cjs');

// Import from new service modules
const { transcribeRecording } = require('../services/transcriptionService.cjs');
const { processRecordingWithRetry, notifyProcessingFailure } = require('../services/processingService.cjs');
const { getUtterances } = require('../utils/utteranceUtils.cjs');

const router = express.Router();

// ============================================================================
// Multer Configuration
// ============================================================================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format tips with bold keywords and bullet points
 * @param {string} tips - Raw tips text from Claude
 * @returns {string} - Formatted tips with bold keywords and bullet points
 */
function formatTips(tips) {
  if (!tips) return tips;

  const keywords = ['Praise', 'Echo', 'Narrate', 'Questions', 'Commands', 'Criticisms', 'Negative Phrases'];

  let paragraphs = tips.split('\n\n');
  if (paragraphs.length === 1) {
    paragraphs = tips.split('\n');
  }

  const formattedParagraphs = paragraphs.map(paragraph => {
    let formatted = paragraph.trim();
    if (!formatted) return '';

    formatted = formatted.replace(/\*\*/g, '');

    keywords.forEach(keyword => {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b(${escapedKeyword})\\b`, 'gi');
      formatted = formatted.replace(regex, '**$1**');
    });

    if (!formatted.startsWith('-') && !formatted.startsWith('•')) {
      formatted = `- ${formatted}`;
    }

    return formatted;
  });

  return formattedParagraphs.filter(p => p).join('\n');
}

/**
 * Transform coaching cards to old childPortfolioInsights format for backward compat
 * @param {Array|null} coachingCards - New coaching cards from child profiling
 * @returns {Array|null} Old format portfolio insights
 */
function transformCoachingCardsToPortfolioInsights(coachingCards) {
  if (!coachingCards || !Array.isArray(coachingCards)) return null;
  return coachingCards.map((card, idx) => ({
    id: card.card_id || idx + 1,
    suggested_change: card.title || '',
    analysis: {
      observation: card.coaching_tip || card.insight || '',
      impact: card.suggestion || '',
      result: ''
    },
    example_scenario: card.scenario ? {
      child: card.scenario.context || '',
      parent: card.scenario.try_this || ''
    } : null
  }));
}

/**
 * Transform developmental domains to old aboutChild format for backward compat
 * @param {Array|null} domains - New developmental domains from child profiling
 * @returns {Array|null} Old format about child items
 */
function transformDomainsToAboutChild(domains) {
  if (!domains || !Array.isArray(domains)) return null;
  return domains
    .filter(d => d.detailed_observations && d.detailed_observations.length > 0)
    .map((domain, idx) => ({
      id: idx + 1,
      Title: domain.category || '',
      Description: domain.developmental_status || '',
      Details: domain.detailed_observations.map(o => `${o.insight}: ${o.evidence}`).join(' ')
    }));
}

/**
 * Start transcription and analysis in background
 * Handles retry logic and failure notifications
 */
async function startBackgroundProcessing(sessionId, userId, storagePath, durationSeconds) {
  try {
    // Run transcription
    await transcribeRecording(sessionId, userId, storagePath, durationSeconds);

    // Update status to PROCESSING
    await prisma.session.update({
      where: { id: sessionId },
      data: { analysisStatus: 'PROCESSING' }
    });

    // Process with automatic retry (3 attempts with 0s, 5s, 15s delays)
    await processRecordingWithRetry(sessionId, userId, 0);
  } catch (err) {
    console.error(`❌ [PROCESSING-FAILED-PERMANENTLY] Session ${sessionId.substring(0, 8)} failed:`, err.message);
    await notifyProcessingFailure(sessionId, userId, err);
  }
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/recordings/upload/init
 * Initialize upload and get presigned S3 URL for direct upload
 */
router.post('/upload/init', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { durationSeconds, mimeType = 'audio/m4a' } = req.body;

    if (!durationSeconds || durationSeconds < 1) {
      return res.status(400).json({
        error: 'Invalid duration',
        details: 'durationSeconds must be a positive number'
      });
    }

    const sessionId = crypto.randomUUID();

    console.log(`[UPLOAD-INIT] Starting upload for user ${userId.substring(0, 8)}, session ${sessionId.substring(0, 8)}`);

    await prisma.session.create({
      data: {
        id: sessionId,
        userId: userId,
        mode: 'CDI',
        storagePath: 'pending_upload',
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
 */
router.post('/upload/complete', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { sessionId, uploadKey } = req.body;

    if (!sessionId || !uploadKey) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'sessionId and uploadKey are required'
      });
    }

    console.log(`[UPLOAD-COMPLETE] Verifying upload for session ${sessionId.substring(0, 8)}`);

    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return res.status(404).json({
        error: 'Session not found',
        details: 'Invalid session ID'
      });
    }

    if (session.userId !== userId) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'You do not have permission to access this session'
      });
    }

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

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        storagePath: uploadKey,
        analysisStatus: 'PROCESSING'
      }
    });

    console.log(`[UPLOAD-COMPLETE] Session ${sessionId.substring(0, 8)} updated with storage path: ${uploadKey}`);

    // Trigger background processing (non-blocking)
    console.log(`[UPLOAD-COMPLETE] Triggering background processing for session ${sessionId.substring(0, 8)}`);
    startBackgroundProcessing(sessionId, userId, uploadKey, session.durationSeconds)
      .then(() => {
        console.log(`✅ [UPLOAD-COMPLETE] Background processing completed for session ${sessionId.substring(0, 8)}`);
      })
      .catch((err) => {
        console.error(`❌ [UPLOAD-COMPLETE] Background processing failed for session ${sessionId.substring(0, 8)}:`, err);
      });

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
 */
router.post('/upload', requireAuth, upload.single('audio'), async (req, res) => {
  try {
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

    const durationSeconds = req.body.durationSeconds
      ? parseInt(req.body.durationSeconds, 10)
      : 0;

    const sessionId = crypto.randomUUID();

    await prisma.session.create({
      data: {
        id: sessionId,
        userId: userId,
        mode: 'CDI',
        storagePath: 'uploading',
        durationSeconds,
        transcript: '',
        aiFeedbackJSON: {},
        pcitCoding: {},
        tagCounts: {},
        masteryAchieved: false,
        riskScore: 0,
        flaggedForReview: false
      }
    });

    let storagePath;
    try {
      storagePath = await storage.uploadAudioFile(
        req.file.buffer,
        userId,
        sessionId,
        req.file.mimetype
      );

      await prisma.session.update({
        where: { id: sessionId },
        data: { storagePath }
      });

      console.log(`Audio uploaded successfully: ${storagePath}`);
    } catch (uploadError) {
      console.error('S3 upload failed:', uploadError);

      await prisma.session.delete({
        where: { id: sessionId }
      });

      return res.status(500).json({
        error: 'Failed to upload audio file',
        details: uploadError.message
      });
    }

    // Trigger background processing (non-blocking)
    console.log(`🚀 [UPLOAD] Triggering background processing for session ${sessionId}`);
    startBackgroundProcessing(sessionId, userId, storagePath, durationSeconds)
      .then(() => {
        console.log(`✅ [UPLOAD] Background processing completed for session ${sessionId}`);
      })
      .catch((err) => {
        console.error(`❌ [UPLOAD] Background processing failed for session ${sessionId}:`, err);
      });

    res.status(201).json({
      recordingId: sessionId,
      storagePath,
      status: 'uploaded',
      message: 'Audio uploaded successfully. Transcription started in background.',
      durationSeconds
    });

  } catch (error) {
    console.error('❌ [UPLOAD] Recording upload error:', error);

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

    res.status(500).json({
      error: 'Upload failed',
      details: 'Upload failed. Please try upload again.'
    });
  }
});

/**
 * GET /api/recordings/dashboard
 * Get dashboard data for HomeScreen (optimized single call)
 * IMPORTANT: This route MUST be defined before /:id routes
 */
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    // Calculate Singapore timezone dates
    const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;
    const now = new Date();
    const sgtNow = new Date(now.getTime() + SGT_OFFSET_MS);

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

    const dayOfWeek = sgtNow.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(sgtNow);
    weekStart.setUTCDate(sgtNow.getUTCDate() + mondayOffset);
    weekStart.setUTCHours(0, 0, 0, 0);
    weekStart.setTime(weekStart.getTime() - SGT_OFFSET_MS);

    const [todayRecordings, thisWeekRecordings, latestWithReport] = await Promise.all([
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
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const session = await prisma.session.findUnique({
      where: { id }
    });

    if (!session) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

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
 */
router.get('/:id/analysis', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const [session, childProfiling] = await Promise.all([
      prisma.session.findUnique({ where: { id } }),
      prisma.childProfiling.findUnique({ where: { sessionId: id } })
    ]);

    if (!session) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    if (session.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    console.log(`[GET-ANALYSIS] Session ${id.substring(0, 8)} - Status: ${session.analysisStatus}`);

    if (session.analysisStatus === 'FAILED') {
      return res.status(500).json({
        status: 'failed',
        error: 'Report generation failed',
        message: session.analysisError || 'An error occurred while analyzing your recording. Please try recording again.',
        failedAt: session.analysisFailedAt
      });
    }

    if (!session.transcript) {
      return res.status(202).json({
        status: 'processing',
        message: 'Transcription in progress'
      });
    }

    if (session.analysisStatus !== 'COMPLETED' || !session.pcitCoding || Object.keys(session.pcitCoding).length === 0) {
      return res.status(202).json({
        status: 'processing',
        message: 'PCIT analysis in progress'
      });
    }

    console.log(`[GET-ANALYSIS] Returning COMPLETED for session ${id.substring(0, 8)}`);

    const utterances = await getUtterances(session.id);
    const transcriptSegments = utterances.map(utt => ({
      speaker: utt.speaker,
      text: utt.text,
      start: utt.startTime,
      end: utt.endTime,
      role: utt.role,
      tag: utt.noraTag,
      feedback: utt.feedback,
      revisedFeedback: utt.revisedFeedback,
      additionalTip: utt.additionalTip
    }));

    const isCDI = session.mode === 'CDI';
    let skills = [];
    let areasToAvoid = [];

    const noraScore = session.overallScore || 0;

    if (isCDI) {
      const tagCounts = session.tagCounts || {};
      skills = [
        { label: 'Praise (Labeled)', progress: tagCounts.praise || 0 },
        { label: 'Echo', progress: tagCounts.echo || 0 },
        { label: 'Narrate', progress: tagCounts.narration || 0 }
      ];

      areasToAvoid = [
        { label: 'Questions', count: tagCounts.question || 0 },
        { label: 'Commands', count: tagCounts.command || 0 },
        { label: 'Criticism', count: tagCounts.criticism || 0 }
      ];
    } else {
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

    let topMomentQuote = null;
    if (session.competencyAnalysis?.topMoment) {
      topMomentQuote = session.competencyAnalysis.topMoment;
    } else {
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

    const tips = session.competencyAnalysis?.tips
      ? session.competencyAnalysis.tips
      : formatTips(isCDI
        ? `Focus on increasing your use of ${skills[0].progress < 50 ? 'Praise' : skills[1].progress < 50 ? 'Reflections' : 'Narrations'}. Try to describe what your child is doing without asking Questions or giving Commands.`
        : `Work on making your Commands more direct and specific. Avoid phrasing Commands as Questions.`);

    const reminder = session.competencyAnalysis?.reminder || null;

    const tomorrowGoal = isCDI
      ? `Use ${Math.max(10, (session.tagCounts?.praise || 0) + 2)} Praises`
      : `Give ${Math.max(10, (session.tagCounts?.direct_command || 0) + 2)} Direct Commands`;

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
      topMoment: topMomentQuote || "Great session!",
      topMomentUtteranceNumber: typeof session.competencyAnalysis?.topMomentUtteranceNumber === 'number'
        ? session.competencyAnalysis.topMomentUtteranceNumber : null,
      exampleIndex: typeof session.competencyAnalysis?.example === 'number'
        ? session.competencyAnalysis.example : null,
      feedback: session.competencyAnalysis?.feedback || null,
      childReaction: session.competencyAnalysis?.childReaction || null,
      tips,
      reminder,
      tomorrowGoal,
      stats: {
        totalPlayTime: `${Math.floor(session.durationSeconds / 60)} min ${session.durationSeconds % 60} sec`,
        ...session.tagCounts
      },
      transcript: transcriptSegments,
      pcitCoding: session.pcitCoding,
      competencyAnalysis: session.competencyAnalysis || null,
      // New fields from child profiling
      developmentalObservation: childProfiling
        ? { summary: childProfiling.summary, domains: childProfiling.domains }
        : null,
      coachingCards: session.coachingCards || null,
      // Backward compat (old mobile app versions)
      childPortfolioInsights: transformCoachingCardsToPortfolioInsights(session.coachingCards) || session.childPortfolioInsights || null,
      aboutChild: transformDomainsToAboutChild(childProfiling?.domains) || session.aboutChild || null
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
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { from, to } = req.query;

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

module.exports = router;
