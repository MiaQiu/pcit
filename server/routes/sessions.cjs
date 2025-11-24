// Session management routes - Phase 3: AI Orchestration & Object Storage
const express = require('express');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth.cjs');
const prisma = require('../services/db.cjs');
const storage = require('../services/storage.cjs');
const { encrypt, encryptSensitiveData, decryptSensitiveData, encryptJSON, decryptJSON, decryptSessionData } = require('../utils/encryption.cjs');
const { updateUserStreak, getUserStreak } = require('../utils/streak.cjs');

const router = express.Router();

// All session routes require authentication
router.use(requireAuth);

/**
 * POST /api/sessions/upload
 * Upload and process a PCIT session
 * 
 * Request body:
 * - audioData: base64 encoded audio
 * - mode: "CDI" or "PDI"
 * - transcript: session transcript
 * - pcitCoding: PCIT coding results
 * - tagCounts: tag count summary
 * - durationSeconds: session duration
 * 
 * This endpoint integrates with the existing frontend flow
 */
router.post('/upload', async (req, res) => {
  try {
    const { audioData, mode, transcript, pcitCoding, tagCounts, durationSeconds } = req.body;

    // Validation
    if (!mode || !transcript || !pcitCoding || !tagCounts) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['CDI', 'PDI'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode. Must be CDI or PDI' });
    }

    // Encrypt sensitive transcript data
    const encryptedTranscript = encryptSensitiveData(transcript);

    // Create session record first to get ID
    const session = await prisma.session.create({
      data: {
        id: crypto.randomUUID(),
        userId: req.userId,
        mode,
        storagePath: 'pending', // Will update after GCS upload
        durationSeconds: durationSeconds || 0,
        transcript: encryptedTranscript,
        aiFeedbackJSON: {},
        pcitCoding,
        tagCounts,
        masteryAchieved: false,
        riskScore: 0,
        flaggedForReview: false
      }
    });

    // Upload audio to GCS if provided
    let storagePath = 'no-audio';
    if (audioData) {
      try {
        const audioBuffer = Buffer.from(audioData, 'base64');
        storagePath = await storage.uploadAudioFile(audioBuffer, req.userId, session.id);
        
        // Update session with storage path
        await prisma.session.update({
          where: { id: session.id },
          data: { storagePath }
        });
      } catch (error) {
        console.error('Audio upload error:', error);
        // Continue without audio - don't fail the whole session
      }
    }

    // Calculate mastery based on mode
    const masteryAchieved = calculateMastery(mode, tagCounts);

    // Detect risk (use original transcript, not encrypted)
    const riskDetection = detectRisk(transcript, pcitCoding);
    
    // Update session with analysis results
    const updatedSession = await prisma.session.update({
      where: { id: session.id },
      data: {
        masteryAchieved,
        riskScore: riskDetection.score,
        flaggedForReview: riskDetection.flagged,
        storagePath
      }
    });

    // Log risk if detected
    if (riskDetection.flagged) {
      await logRiskDetection(req.userId, session.id, riskDetection, transcript);
    }

    // Update user's streak
    let streakInfo = null;
    try {
      streakInfo = await updateUserStreak(req.userId);
    } catch (error) {
      console.error('Failed to update streak:', error);
      // Don't fail the whole request if streak update fails
    }

    res.status(201).json({
      sessionId: session.id,
      masteryAchieved,
      riskDetected: riskDetection.flagged,
      storagePath: storage.isGCSEnabled() ? storagePath : undefined,
      streak: streakInfo
    });

  } catch (error) {
    console.error('Session upload error:', error);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

/**
 * GET /api/sessions
 * Get user's session history
 */
router.get('/', async (req, res) => {
  try {
    const { mode, limit = 20, offset = 0 } = req.query;

    const where = {
      userId: req.userId,
      ...(mode && { mode })
    };

    const sessions = await prisma.session.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
      select: {
        id: true,
        mode: true,
        durationSeconds: true,
        masteryAchieved: true,
        riskScore: true,
        flaggedForReview: true,
        tagCounts: true,
        childMetrics: true,
        createdAt: true
      }
    });

    const total = await prisma.session.count({ where });

    // Decrypt sensitive session data
    const decryptedSessions = sessions.map(session => ({
      ...session,
      childMetrics: session.childMetrics ? decryptJSON(session.childMetrics) : null
    }));

    res.json({ sessions: decryptedSessions, total });

  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * GET /api/sessions/streak
 * Get user's current streak information
 * IMPORTANT: Must be before /:id route
 */
router.get('/streak', async (req, res) => {
  try {
    const streakInfo = await getUserStreak(req.userId);
    res.json(streakInfo);
  } catch (error) {
    console.error('Get streak error:', error);
    res.status(500).json({ error: 'Failed to fetch streak information' });
  }
});

/**
 * GET /api/sessions/:id
 * Get detailed session information
 */
router.get('/:id', async (req, res) => {
  try {
    const session = await prisma.session.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId // Ensure user owns this session
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Generate signed URL for audio if GCS is enabled
    let audioUrl = null;
    if (storage.isGCSEnabled() && session.storagePath && !session.storagePath.startsWith('mock://')) {
      try {
        audioUrl = await storage.getSignedUrl(session.storagePath);
      } catch (error) {
        console.error('Signed URL error:', error);
      }
    }

    // Decrypt sensitive session data
    const decryptedSession = decryptSessionData(session);

    res.json({
      ...decryptedSession,
      audioUrl
    });

  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

/**
 * DELETE /api/sessions/:id
 * Delete a session and its audio file
 */
router.delete('/:id', async (req, res) => {
  try {
    const session = await prisma.session.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId
      }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Delete audio from GCS
    if (session.storagePath) {
      await storage.deleteAudioFile(session.storagePath);
    }

    // Delete session record (cascade will delete related records)
    await prisma.session.delete({
      where: { id: req.params.id }
    });

    res.json({ message: 'Session deleted successfully' });

  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Helper functions

/**
 * Calculate if mastery is achieved based on PCIT criteria
 */
function calculateMastery(mode, tagCounts) {
  if (mode === 'CDI') {
    // CDI Mastery Criteria (5-minute session)
    const praise = tagCounts.praise || 0;
    const reflect = tagCounts.reflect || 0;
    const describe = tagCounts.describe || 0;
    const totalDonts = (tagCounts.question || 0) + (tagCounts.command || 0) + (tagCounts.criticism || 0);
    const negativePhrases = tagCounts.negative_phrases || 0;

    return praise >= 10 && reflect >= 10 && describe >= 10 && totalDonts <= 3 && negativePhrases === 0;
  } else if (mode === 'PDI') {
    // PDI has different criteria - this is simplified
    const commands = tagCounts.command || 0;
    const labeledPraises = tagCounts.praise || 0;
    
    return commands >= 10 && labeledPraises >= 5;
  }

  return false;
}

/**
 * Detect risk indicators in transcript and coding
 */
function detectRisk(transcript, pcitCoding) {
  const riskKeywords = [
    'hurt', 'kill', 'die', 'suicide', 'abuse', 'hitting', 'beating',
    'scared', 'afraid', 'danger', 'weapon', 'gun', 'knife'
  ];

  const transcriptLower = transcript.toLowerCase();
  let riskScore = 0;
  let triggers = [];

  // Check for risk keywords
  for (const keyword of riskKeywords) {
    if (transcriptLower.includes(keyword)) {
      riskScore += 10;
      triggers.push(keyword);
    }
  }

  // Check for excessive criticism
  if (pcitCoding.criticism && pcitCoding.criticism.length > 5) {
    riskScore += 5;
    triggers.push('excessive-criticism');
  }

  // Check for excessive negative phrases
  if (pcitCoding.negative_phrases && pcitCoding.negative_phrases.length > 3) {
    riskScore += 5;
    triggers.push('excessive-negative');
  }

  return {
    score: riskScore,
    flagged: riskScore >= 15,
    triggers,
    level: riskScore >= 30 ? 'high' : riskScore >= 15 ? 'medium' : 'low'
  };
}

/**
 * Log risk detection to RiskAuditLog
 */
async function logRiskDetection(userId, sessionId, riskDetection, transcript) {
  try {
    // Extract trigger excerpts from transcript (encrypted)
    const excerpts = riskDetection.triggers
      .filter(t => !t.includes('-')) // Only actual keywords, not meta triggers
      .map(keyword => {
        const index = transcript.toLowerCase().indexOf(keyword);
        if (index === -1) return null;
        
        // Extract 50 chars before and after
        const start = Math.max(0, index - 50);
        const end = Math.min(transcript.length, index + keyword.length + 50);
        return transcript.substring(start, end);
      })
      .filter(Boolean)
      .join(' ... ');

    // Encrypt the trigger excerpt
    const encryptedExcerpt = encrypt(excerpts || 'Risk keywords detected');

    await prisma.riskAuditLog.create({
      data: {
        id: crypto.randomUUID(),
        userId,
        sessionId,
        triggerSource: 'automated-detection',
        riskLevel: riskDetection.level,
        triggerExcerpt: encryptedExcerpt,
        actionTaken: riskDetection.level === 'high' ? 'flagged-for-immediate-review' : 'flagged-for-review'
      }
    });

    console.log(`Risk logged: ${riskDetection.level} level, session ${sessionId}`);
  } catch (error) {
    console.error('Risk logging error:', error);
    // Don't throw - logging failure shouldn't break the session flow
  }
}

module.exports = router;
