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

const router = express.Router();

// S3 Client for downloading audio files
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const s3Client = new S3Client({ region: AWS_REGION });
const S3_BUCKET = process.env.AWS_S3_BUCKET;

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
 * POST /api/recordings/upload
 * Upload audio recording from mobile app
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
router.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    // Validate file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: 'No audio file provided',
        details: 'Please include an audio file in the "audio" field'
      });
    }

    // TEMPORARY: Use test user ID when auth is disabled
    const userId = req.userId || 'test-user-id';

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

    // Return success response
    res.status(201).json({
      recordingId: sessionId,
      storagePath,
      status: 'uploaded',
      message: 'Audio uploaded successfully. Transcription can now be triggered.',
      durationSeconds
    });

  } catch (error) {
    console.error('Recording upload error:', error);

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
 * GET /api/recordings
 * Get all recordings for the authenticated user
 */
// TEMPORARY: Auth disabled for development
router.get('/', async (req, res) => {
  try {
    const userId = req.userId || 'test-user-id';
    const sessions = await prisma.session.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        mode: true,
        durationSeconds: true,
        masteryAchieved: true,
        createdAt: true,
        transcript: true
      }
    });

    // Map sessions to include status
    const recordings = sessions.map(session => ({
      id: session.id,
      mode: session.mode,
      durationSeconds: session.durationSeconds,
      masteryAchieved: session.masteryAchieved,
      createdAt: session.createdAt,
      status: session.transcript ? 'transcribed' : 'uploaded'
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
