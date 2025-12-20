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
 * @param {Object} tagMap - Map of utterance ID to PCIT tag
 * @returns {Promise<void>}
 */
async function updateUtteranceTags(sessionId, tagMap) {
  // Build array of updates to perform in parallel
  const updatePromises = [];

  for (const [utteranceId, tag] of Object.entries(tagMap)) {
    updatePromises.push(
      prisma.utterance.update({
        where: { id: utteranceId },
        data: { pcitTag: tag }
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

  // Trigger PCIT analysis in background (non-blocking)
  console.log(`🔄 [ANALYSIS-TRIGGER] Session ${sessionId.substring(0, 8)} - About to trigger PCIT analysis...`);
  console.log(`🔄 [ANALYSIS-TRIGGER] Calling analyzePCITCoding(${sessionId.substring(0, 8)}, ${userId.substring(0, 8)})`);

  // Update status to PROCESSING
  await prisma.session.update({
    where: { id: sessionId },
    data: { analysisStatus: 'PROCESSING' }
  });

  analyzePCITCoding(sessionId, userId)
    .then(async () => {
      console.log(`✅ [ANALYSIS-COMPLETE] Session ${sessionId.substring(0, 8)} - PCIT analysis completed successfully`);
      // Update status to COMPLETED
      await prisma.session.update({
        where: { id: sessionId },
        data: { analysisStatus: 'COMPLETED' }
      });
    })
    .catch(async (err) => {
      console.error(`❌ [ANALYSIS-FAILED] Session ${sessionId.substring(0, 8)} - PCIT analysis failed:`);
      console.error(`❌ [ANALYSIS-FAILED] Error message:`, err.message);
      console.error(`❌ [ANALYSIS-FAILED] Error stack:`, err.stack);
      console.error(`❌ [ANALYSIS-FAILED] Full error:`, err);

      // Save error to database
      console.log(`🔄 [ANALYSIS-FAILED] About to save error to database for session ${sessionId.substring(0, 8)}...`);

      try {
        console.log(`🔄 [ANALYSIS-FAILED] Calling prisma.session.update...`);
        const result = await prisma.session.update({
          where: { id: sessionId },
          data: {
            analysisStatus: 'FAILED',
            analysisError: err.message || 'Unknown error occurred during analysis',
            analysisFailedAt: new Date()
          }
        });
        console.log(`✅ [ANALYSIS-FAILED] Database update completed for session ${sessionId.substring(0, 8)}`);
        console.log(`✅ [ANALYSIS-FAILED] Updated session:`, { id: result.id, status: result.analysisStatus, error: result.analysisError });
      } catch (dbErr) {
        console.error(`❌ [DB-ERROR] Failed to save error to database for session ${sessionId.substring(0, 8)}:`);
        console.error(`❌ [DB-ERROR] Error details:`, dbErr);
        console.error(`❌ [DB-ERROR] Error message:`, dbErr.message);
        console.error(`❌ [DB-ERROR] Error stack:`, dbErr.stack);
      }

      console.log(`🏁 [ANALYSIS-FAILED] Finished error handling for session ${sessionId.substring(0, 8)}`);
    });

  return {
    transcript: transcriptFormatted,
    utterances
  };
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

1. **topMoment**: An exact quote from the conversation that highlights bonding between child and parent. Can be from either speaker. Choose a moment showing connection, joy, or positive interaction. Must be a direct quote from the utterances above.

2. **tips**: EXACTLY 2 sentences of the MOST important tips for improvement. Be specific and actionable. Reference specific utterances or patterns you observed.

3. **reminder**: EXACTLY 2 sentences of encouragement or reminder for the parent. Keep it warm and supportive.

**Output Format:**
Return ONLY valid JSON in this exact structure:
{
  "topMoment": "exact quote from utterances",
  "tips": "Exactly 2 sentences of specific tips.",
  "reminder": "Exactly 2 sentences of encouragement."
}

**CRITICAL:** Return ONLY valid JSON. Do not include markdown code blocks or any text outside the JSON structure.`;
}

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
- Harsh Tone: ${counts.harsh_tone}

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
- No Harsh Tone

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
  "topMoment": "exact quote from utterances",
  "tips": "Exactly 2 sentences of specific tips.",
  "reminder": "Exactly 2 sentences of encouragement."
}

**CRITICAL:** Return ONLY valid JSON. Do not include markdown code blocks or any text outside the JSON structure.`;
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

**CRITICAL:** Return ONLY the JSON object above. Do not include markdown code blocks, explanations, or any text outside the JSON structure.`;

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
    // Remove markdown code blocks if present
    const cleanJson = roleIdentificationText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
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
    console.error('Failed to parse role identification JSON:', parseError.message);
    console.log('Raw response:', roleIdentificationText);
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

  const codingPrompt = isCDI
    ? `**System Role:**
You are an expert PCIT (Parent-Child Interaction Therapy) Coder using DPICS standards. You analyze parent verbalizations and classify them into specific codes based on the provided schema.

**Instructions:**
Analyze the conversation. Iterate through the 'codes' list. Check the 'priority_rank' (lower number = check first). If a sentence meets the criteria for multiple codes, assign the one with the lowest priority_rank (highest priority).

**Coding Schema:**
{
  "codes": [
    {
      "name": "Echo",
      "category": "DO",
      "priority_rank": 1,
      "definition": "A repetition or paraphrase of the child's verbalization.",
      "rules": [
        "Can interpret the child's meaning.",
        "Overrides Question coding even if it has a rising tone.",
        "Overrides Command coding if repeating a command."
      ],
      "examples": [
        "Child: 'I go car.' -> Parent: 'You are going to the car.'",
        "Child: 'No!' -> Parent: 'You don't want to.'",
        "Child: 'Big dog.' -> Parent: 'It is a big dog?' (Rising tone implies confirmation of meaning, so it is RF)"
      ]
    },
    {
      "name": "Labeled Praise",
      "category": "DO",
      "priority_rank": 2,
      "definition": "A positive evaluation of a specific behavior or attribute.",
      "examples": [
        "Good job sitting still.",
        "I love how you are sharing.",
        "Nice drawing of a star."
      ]
    },
    {
      "name": "Unlabeled Praise",
      "category": "DO",
      "priority_rank": 3,
      "definition": "A general positive evaluation without specifying the behavior.",
      "examples": [
        "Good job!",
        "Nice!",
        "High five!",
        "Thank you."
      ]
    },
    {
      "name": "Narration",
      "category": "DO",
      "priority_rank": 4,
      "definition": "Verbal description of the child's current, observable behavior.",
      "rules": [
        "Subject must be 'You' (the child).",
        "Verb must be present tense.",
        "Must be observable (no thinking/feeling)."
      ],
      "examples": [
        "You are drawing a red circle.",
        "You are putting the block on top."
      ]
    },
    {
      "name": "Direct Command",
      "category": "DONT",
      "priority_rank": 5,
      "definition": "A clearly stated order or direction for behavior.",
      "keywords": ["stop", "come", "sit", "look", "watch"],
      "rules": ["Includes 'Look', 'Watch', 'See' as commands."],
      "examples": [
        "Hand me that.",
        "Sit down please.",
        "Look at this."
      ]
    },
    {
      "name": "Indirect Command",
      "category": "DONT",
      "priority_rank": 6,
      "definition": "A suggestion or polite request for behavior that implies a choice.",
      "keywords": ["let's", "can you", "will you", "would you"],
      "examples": [
        "Let's clean up.",
        "Can you hand me the toy?",
        "How about we draw?"
      ]
    },
    {
      "name": "Question",
      "category": "DONT",
      "priority_rank": 7,
      "definition": "A request for a verbal answer or information.",
      "rules": [
        "Includes tag questions (right?, okay?).",
        "Excludes requests for physical action (which are Commands)."
      ],
      "examples": [
        "What color is this?",
        "Are you having fun?",
        "It's green, right?"
      ]
    },
    {
      "name": "Negative Talk",
      "category": "DONT",
      "priority_rank": 8,
      "definition": "Verbal expression of disapproval or criticism.",
      "examples": [
        "That's wrong.",
        "Don't be messy.",
        "I don't like that."
      ]
    },
    {
      "name": "NEUTRAL",
      "category": "NEUTRAL",
      "priority_rank": 9,
      "definition": "Declarative sentences that do not fit other categories.",
      "rules": [
        "Descriptions of own behavior (I am...)",
        "Descriptions of objects (It is...)",
        "Past/Future descriptions."
      ],
      "examples": [
        "I am going to build a tower.",
        "It is a blue block.",
        "We went to the park yesterday."
      ]
    }
  ]
}

**Input Utterances (Array of objects with index for identification):**
${JSON.stringify(utterancesWithRoles.map((utt, idx) => ({
  index: idx,
  id: utt.id,
  speaker: utt.speaker,
  text: utt.text,
  role: utt.role
})), null, 2)}

**Task:**
Classify ONLY adult utterances based on the schema above. Return valid JSON only.

**Output Format:**
Return a JSON array with one entry for EACH adult utterance:
[
  {
    "id": "abc-123",
    "tag": "Echo",
    "reasoning": "Parent repeating child's verbalization"
  }
]

**CRITICAL:** Return ONLY a valid JSON array. No markdown code blocks.`

    : `You are an expert PCIT (Parent-Child Interaction Therapy) Coder. Apply PDI coding tags to every adult utterance.

**Input Utterances (Array of objects with index for identification):**
${JSON.stringify(utterancesWithRoles.map((utt, idx) => ({
  index: idx,
  id: utt.id,
  speaker: utt.speaker,
  text: utt.text,
  role: utt.role
})), null, 2)}

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

**Instructions:**
1. Code ONLY utterances where role === "adult"
2. Every adult utterance must receive exactly one tag
3. Use the utterance ID to identify which utterance you're tagging

**Output Format:**
Return a JSON array with one entry for EACH adult utterance. Each entry must include:
- id: The utterance ID from the input
- tag: The PCIT tag (exactly as shown above, e.g., "DO: Direct Command")
- reasoning: Brief explanation (1 sentence)

Example output:
[
  {
    "id": "abc-123",
    "tag": "DO: Direct Command",
    "reasoning": "Clear, specific command to put block in location"
  },
  {
    "id": "def-456",
    "tag": "DON'T: Indirect Command",
    "reasoning": "Phrased as a question rather than direct command"
  }
]

**CRITICAL:** Return ONLY a valid JSON array. Do not include markdown code blocks, explanations, or any text outside the JSON structure.`;

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
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: codingPrompt
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
    // Remove markdown code blocks if present
    const cleanJson = fullResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    codingResults = JSON.parse(cleanJson);

    if (!Array.isArray(codingResults)) {
      throw new Error('Expected array of coding results');
    }
  } catch (parseError) {
    console.error('Failed to parse PCIT coding JSON:', parseError.message);
    console.log('Raw response:', fullResponse);
    throw new Error(`Failed to parse PCIT coding response: ${parseError.message}`);
  }

  // Build ID-to-tag map for efficient updates
  const tagMap = {};
  for (const result of codingResults) {
    if (result.id && result.tag) {
      tagMap[result.id] = result.tag;
    }
  }

  // Update utterances with PCIT tags in database
  await updateUtteranceTags(sessionId, tagMap);

  console.log(`Updated tags for ${Object.keys(tagMap).length} utterances`);

  // Count tags from JSON results
  const tagCounts = {};
  if (isCDI) {
    tagCounts.echo = 0;
    tagCounts.labeled_praise = 0;
    tagCounts.unlabeled_praise = 0;
    tagCounts.praise = 0; // Combined praise for backward compatibility
    tagCounts.narration = 0;
    tagCounts.direct_command = 0;
    tagCounts.indirect_command = 0;
    tagCounts.command = 0; // Combined commands for backward compatibility
    tagCounts.question = 0;
    tagCounts.negative_talk = 0;
    tagCounts.neutral = 0;

    for (const result of codingResults) {
      const tag = result.tag;
      if (tag === 'Echo') tagCounts.echo++;
      else if (tag === 'Labeled Praise') {
        tagCounts.labeled_praise++;
        tagCounts.praise++;
      }
      else if (tag === 'Unlabeled Praise') {
        tagCounts.unlabeled_praise++;
        //tagCounts.praise++;
      }
      else if (tag === 'Narration') tagCounts.narration++;
      else if (tag === 'Direct Command') {
        tagCounts.direct_command++;
        tagCounts.command++;
      }
      else if (tag === 'Indirect Command') {
        tagCounts.indirect_command++;
        tagCounts.command++;
      }
      else if (tag === 'Question') tagCounts.question++;
      else if (tag === 'Negative Talk') tagCounts.negative_talk++;
      else if (tag === 'NEUTRAL') tagCounts.neutral++;
    }
  } else {
    tagCounts.direct_command = 0;
    tagCounts.positive_command = 0;
    tagCounts.specific_command = 0;
    tagCounts.labeled_praise = 0;
    tagCounts.correct_warning = 0;
    tagCounts.correct_timeout = 0;
    tagCounts.indirect_command = 0;
    tagCounts.negative_command = 0;
    tagCounts.vague_command = 0;
    tagCounts.chained_command = 0;
    tagCounts.harsh_tone = 0;
    tagCounts.neutral = 0;

    for (const result of codingResults) {
      const tag = result.tag;
      if (tag === 'DO: Direct Command') tagCounts.direct_command++;
      else if (tag === 'DO: Positive Command') tagCounts.positive_command++;
      else if (tag === 'DO: Specific Command') tagCounts.specific_command++;
      else if (tag === 'DO: Labeled Praise') tagCounts.labeled_praise++;
      else if (tag === 'DO: Correct Warning') tagCounts.correct_warning++;
      else if (tag === 'DO: Correct Time-Out Statement') tagCounts.correct_timeout++;
      else if (tag === "DON'T: Indirect Command") tagCounts.indirect_command++;
      else if (tag === "DON'T: Negative Command") tagCounts.negative_command++;
      else if (tag === "DON'T: Vague Command") tagCounts.vague_command++;
      else if (tag === "DON'T: Chained Command") tagCounts.chained_command++;
      else if (tag === "DON'T: Harsh Tone") tagCounts.harsh_tone++;
      else if (tag === 'Neutral') tagCounts.neutral++;
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
        // Remove markdown code blocks if present
        const cleanJson = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsedAnalysis = JSON.parse(cleanJson);
      } catch (parseError) {
        console.error('Failed to parse competency analysis as JSON:', parseError.message);
        console.log('Raw response:', analysisText);
        // Fallback to raw text
        parsedAnalysis = {
          topMoment: null,
          tips: analysisText,
          reminder: null
        };
      }

      // Store structured analysis
      competencyAnalysis = {
        topMoment: parsedAnalysis.topMoment,
        tips: parsedAnalysis.tips,
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
      .catch(err => {
        console.error(`❌ [UPLOAD] Background transcription failed for session ${sessionId}:`, err);
        console.error(`❌ [UPLOAD] Error stack:`, err.stack);
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
      tag: utt.pcitTag
    }));

    // Format skills data for the report
    const isCDI = session.mode === 'CDI';
    let skills = [];
    let areasToAvoid = [];

    // Calculate Nora Score
    let noraScore = 0;

    if (isCDI) {
      // CDI mode - PEN skills
      const tagCounts = session.tagCounts || {};
      skills = [
        { label: 'Labeled Praise', progress: tagCounts.praise || 0 },
        { label: 'Echo', progress: tagCounts.echo || 0 },
        { label: 'Narration', progress: tagCounts.narration || 0 }
      ];

      // Areas to avoid - always show all categories with counts
      areasToAvoid = [
        { label: 'Questions', count: tagCounts.question || 0 },
        { label: 'Commands', count: tagCounts.command || 0 },
        { label: 'Criticism', count: tagCounts.criticism || 0 }
      ];

      // Calculate Nora Score for CDI mode
      // PEN Skills: 60 points total (20 points each, max at 10 counts)
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

      noraScore = Math.round(penScore + avoidScore);
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
      : isCDI
        ? `Focus on increasing your use of ${skills[0].progress < 50 ? 'Praise' : skills[1].progress < 50 ? 'Reflections' : 'Narrations'}. Try to describe what your child is doing without asking questions or giving commands.`
        : `Work on making your commands more direct and specific. Avoid phrasing commands as questions.`;

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
 * Get all recordings for the authenticated user
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const sessions = await prisma.session.findMany({
      where: { userId: userId },
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
