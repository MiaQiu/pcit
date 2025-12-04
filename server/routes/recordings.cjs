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

/**
 * Transcribe recording helper function
 * Extracted from POST /:id/transcribe endpoint for reuse
 */
async function transcribeRecording(sessionId, userId, storagePath, durationSeconds) {
  console.log(`Starting background transcription for session ${sessionId}`);

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
  let transcriptText = '';
  let transcriptSegments = [];

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
    formData.append('num_speakers', '2');
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

    // Parse speaker_id string to number helper function
    const parseSpeakerId = (speakerId) => {
      if (!speakerId) return 0;
      const match = speakerId.match(/speaker_(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };

    // Extract transcript and group words by speaker into utterances
    if (result.words && result.words.length > 0) {
      // Group words by speaker into utterances
      let currentUtterance = {
        speaker: parseSpeakerId(result.words[0].speaker_id).toString(),
        text: '',
        start: result.words[0].start,
        end: result.words[0].end,
      };

      for (const word of result.words) {
        const speakerId = parseSpeakerId(word.speaker_id);

        if (speakerId.toString() === currentUtterance.speaker) {
          currentUtterance.text += (currentUtterance.text ? ' ' : '') + word.text;
          currentUtterance.end = word.end;
        } else {
          if (currentUtterance.text) {
            transcriptSegments.push(currentUtterance);
          }
          currentUtterance = {
            speaker: speakerId.toString(),
            text: word.text,
            start: word.start,
            end: word.end,
          };
        }
      }

      if (currentUtterance.text) {
        transcriptSegments.push(currentUtterance);
      }

      // Combine all segments into full transcript
      transcriptText = transcriptSegments.map(seg => seg.text).join(' ');
    } else if (result.text) {
      // No diarization, single transcript
      transcriptText = result.text;
      transcriptSegments = [{
        speaker: '0',
        text: transcriptText,
        start: 0,
        end: durationSeconds || 0
      }];
    } else {
      throw new Error('No transcript returned from ElevenLabs');
    }

  } catch (transcriptionError) {
    console.error('Transcription error:', transcriptionError);
    throw new Error(`Transcription failed: ${transcriptionError.message}`);
  }

  // Store transcript in database
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        transcript: transcriptText,
        // Store segments in aiFeedbackJSON temporarily
        aiFeedbackJSON: {
          transcriptSegments,
          transcribedAt: new Date().toISOString(),
          service: 'elevenlabs'
        }
      }
    });

    console.log(`Transcript stored for session ${sessionId} (${transcriptText.length} chars)`);
  } catch (dbError) {
    console.error('Database update error:', dbError);
    throw new Error(`Failed to save transcript: ${dbError.message}`);
  }

  // Trigger PCIT analysis in background (non-blocking)
  analyzePCITCoding(sessionId, userId, transcriptSegments)
    .then(() => {
      console.log(`PCIT analysis completed for session ${sessionId}`);
    })
    .catch(err => {
      console.error(`PCIT analysis failed for session ${sessionId}:`, err.message);
    });

  return {
    transcript: transcriptText,
    segments: transcriptSegments
  };
}

/**
 * Analyze PCIT coding for transcript
 * Called after transcription completes
 */
async function analyzePCITCoding(sessionId, userId, transcriptSegments) {
  console.log(`Starting PCIT analysis for session ${sessionId}`);

  // Get session to check mode (CDI vs PDI)
  const session = await prisma.session.findUnique({
    where: { id: sessionId }
  });

  if (!session) {
    throw new Error('Session not found');
  }

  // Format transcript for PCIT coding
  const formattedTranscript = transcriptSegments.map((seg, idx) => ({
    speaker: parseInt(seg.speaker),
    text: seg.text
  }));

  // Call appropriate PCIT coding endpoint based on mode
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  const isCDI = session.mode === 'CDI';
  const codingEndpoint = isCDI ? 'speaker-and-coding' : 'pdi-speaker-and-coding';

  // Format transcript for the prompt
  const formattedScript = formattedTranscript
    .map(u => `Speaker ${u.speaker}: "${u.text}"`)
    .join('\n');

  const prompt = isCDI
    ? `You are an expert PCIT (Parent-Child Interaction Therapy) Coder. Your task is to:
1. Identify which speaker is the parent (usually the one with more instructions/questions/praise)
2. Apply PCIT coding tags to every parent utterance

**Input Transcript:**
${formattedScript}

**PCIT Coding Rules (PEN Skills):**
[DO: Praise] - Labeled or unlabeled praise for child's behavior
[DO: Echo] - Repeating or paraphrasing child's words
[DO: Narration] - Narrating child's ongoing behavior
[DON'T: Question] - Direct or indirect questions
[DON'T: Command] - Direct or indirect commands
[DON'T: Criticism] - Criticism of child's behavior, appearance, or character
[DON'T: Negative Phrases] - Sarcasm, threats, physical control statements
[Neutral] - Neutral statements that don't fall into DO or DON'T

**Output Format:**
First line: PARENT_SPEAKER: <number>

Then, for EACH parent utterance, provide:
"<exact quote>" [Tag] - Brief explanation

Example:
PARENT_SPEAKER: 0
"You're building a tall tower!" [DO: Narration] - Narrating ongoing play
"Great job stacking those blocks neatly!" [DO: Praise] - Labeled praise
"What color should we use next?" [DON'T: Question] - Asking a question`
    : `You are an expert PCIT (Parent-Child Interaction Therapy) Coder. Your task is to:
1. Identify which speaker is the parent (usually the one giving directions/commands)
2. Apply PDI (Parent-Directed Interaction) coding tags to every parent utterance

**Input Transcript:**
${formattedScript}

**PDI Coding Rules:**

**Effective Command Skills (DO):**
[DO: Direct Command] - Clear, direct command with specific action ("Put the block here")
[DO: Positive Command] - States what TO do, not what NOT to do ("Walk please" vs "Don't run")
[DO: Specific Command] - Single, clear action ("Hand me the red block")
[DO: Labeled Praise] - Praise that specifies what was done well ("Great job putting that away!")
[DO: Correct Warning] - Proper warning before timeout ("If you don't stop, you'll have a timeout")
[DO: Correct Time-Out Statement] - Proper timeout statement ("You need a timeout for not listening")

**Ineffective Command Skills (DON'T):**
[DON'T: Indirect Command] - Phrased as question or suggestion ("Can you clean up?", "Let's put toys away")
[DON'T: Negative Command] - States what NOT to do ("Don't throw toys", "Stop running")
[DON'T: Vague Command] - Unclear or general ("Be good", "Behave", "Clean up")
[DON'T: Chained Command] - Multiple commands in one ("Pick up the toys, put them in the box, and wash your hands")
[DON'T: Harsh Tone] - Command delivered with anger, frustration, or raised voice

[Neutral] - Neutral statements that don't fall into DO or DON'T

**Output Format:**
First line: PARENT_SPEAKER: <number>

Then, for EACH parent utterance, provide:
"<exact quote>" [Tag] - Brief explanation`;

  // Call Claude API
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
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const fullResponse = data.content[0].text;

  // Extract parent speaker
  const parentSpeakerMatch = fullResponse.match(/PARENT_SPEAKER:\s*(\d+)/i);
  const parentSpeaker = parentSpeakerMatch ? parseInt(parentSpeakerMatch[1], 10) : 0;

  // Extract coding
  const codingStartIndex = fullResponse.indexOf('\n', fullResponse.indexOf('PARENT_SPEAKER:'));
  const coding = codingStartIndex > 0 ? fullResponse.substring(codingStartIndex).trim() : fullResponse;

  // Parse coding to count tags
  const tagCounts = {};
  if (isCDI) {
    tagCounts.praise = (coding.match(/\[DO: Praise\]/gi) || []).length;
    tagCounts.echo = (coding.match(/\[DO: Echo\]/gi) || []).length;
    tagCounts.narration = (coding.match(/\[DO: Narration\]/gi) || []).length;
    tagCounts.question = (coding.match(/\[DON'T: Question\]/gi) || []).length;
    tagCounts.command = (coding.match(/\[DON'T: Command\]/gi) || []).length;
    tagCounts.criticism = (coding.match(/\[DON'T: Criticism\]/gi) || []).length;
    tagCounts.negative_phrases = (coding.match(/\[DON'T: Negative Phrases\]/gi) || []).length;
    tagCounts.neutral = (coding.match(/\[Neutral\]/gi) || []).length;
  } else {
    tagCounts.direct_command = (coding.match(/\[DO: Direct Command\]/gi) || []).length;
    tagCounts.positive_command = (coding.match(/\[DO: Positive Command\]/gi) || []).length;
    tagCounts.specific_command = (coding.match(/\[DO: Specific Command\]/gi) || []).length;
    tagCounts.labeled_praise = (coding.match(/\[DO: Labeled Praise\]/gi) || []).length;
    tagCounts.correct_warning = (coding.match(/\[DO: Correct Warning\]/gi) || []).length;
    tagCounts.correct_timeout = (coding.match(/\[DO: Correct Time-Out Statement\]/gi) || []).length;
    tagCounts.indirect_command = (coding.match(/\[DON'T: Indirect Command\]/gi) || []).length;
    tagCounts.negative_command = (coding.match(/\[DON'T: Negative Command\]/gi) || []).length;
    tagCounts.vague_command = (coding.match(/\[DON'T: Vague Command\]/gi) || []).length;
    tagCounts.chained_command = (coding.match(/\[DON'T: Chained Command\]/gi) || []).length;
    tagCounts.harsh_tone = (coding.match(/\[DON'T: Harsh Tone\]/gi) || []).length;
    tagCounts.neutral = (coding.match(/\[Neutral\]/gi) || []).length;
  }

  // Store PCIT coding in database
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      pcitCoding: {
        parentSpeaker,
        coding,
        fullResponse,
        analyzedAt: new Date().toISOString()
      },
      tagCounts
    }
  });

  console.log(`PCIT coding stored for session ${sessionId}`);
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

    // Trigger transcription automatically in the background
    // Don't wait for it to complete - return success immediately
    transcribeRecording(sessionId, userId, storagePath, durationSeconds)
      .then(() => {
        console.log(`Background transcription completed for session ${sessionId}`);
      })
      .catch(err => {
        console.error(`Background transcription failed for session ${sessionId}:`, err);
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

    // Check if analysis is complete
    if (!session.transcript) {
      return res.status(202).json({
        status: 'processing',
        message: 'Transcription in progress'
      });
    }

    if (!session.pcitCoding || Object.keys(session.pcitCoding).length === 0) {
      return res.status(202).json({
        status: 'processing',
        message: 'PCIT analysis in progress'
      });
    }

    // Extract transcript segments from aiFeedbackJSON
    const transcriptSegments = session.aiFeedbackJSON?.transcriptSegments || [];

    // Format skills data for the report
    const isCDI = session.mode === 'CDI';
    let skills = [];
    let areasToAvoid = [];

    if (isCDI) {
      // CDI mode - PRN skills
      const tagCounts = session.tagCounts || {};
      skills = [
        { label: 'Praise', progress: tagCounts.praise || 0 },
        { label: 'Reflect', progress: tagCounts.echo || 0 },
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

    // Find a top moment (first praise or positive statement)
    const pcitCoding = session.pcitCoding;
    const codingLines = pcitCoding.coding ? pcitCoding.coding.split('\n') : [];
    let topMoment = null;
    for (const line of codingLines) {
      if (line.includes('[DO: Praise]') || line.includes('[DO: Labeled Praise]') || line.includes('[DO: Narration]')) {
        // Extract quote
        const quoteMatch = line.match(/"([^"]+)"/);
        if (quoteMatch) {
          topMoment = {
            quote: quoteMatch[1],
            tag: line.match(/\[(.*?)\]/)?.[1] || 'Positive moment'
          };
          break;
        }
      }
    }

    if (!topMoment && transcriptSegments.length > 0) {
      // Fallback to first segment
      topMoment = {
        quote: transcriptSegments[0].text,
        tag: 'Session moment'
      };
    }

    // Generate tips based on analysis
    const tips = isCDI
      ? `Focus on increasing your use of ${skills[0].progress < 50 ? 'Praise' : skills[1].progress < 50 ? 'Reflections' : 'Narrations'}. Try to describe what your child is doing without asking questions or giving commands.`
      : `Work on making your commands more direct and specific. Avoid phrasing commands as questions.`;

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
      skills,
      areasToAvoid,
      topMoment: {
        quote: topMoment?.quote || "Great session!",
        audioUrl: '', // TODO: Add audio segment URL
        duration: '0:12'
      },
      tips,
      tomorrowGoal,
      stats: {
        totalPlayTime: `${Math.floor(session.durationSeconds / 60)} min ${session.durationSeconds % 60} sec`,
        ...session.tagCounts
      },
      transcript: transcriptSegments,
      pcitCoding: session.pcitCoding
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
