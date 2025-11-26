/**
 * PCIT Analysis Proxy Routes - PDPA Compliant
 *
 * All Claude API requests go through this proxy with:
 * - Anonymization (request_id instead of user_id)
 * - No user metadata exposure to Anthropic
 * - Centralized audit logging
 * - API key security (keys never exposed to frontend)
 */

const express = require('express');
const fetch = require('node-fetch');
const { requireAuth } = require('../middleware/auth.cjs');
const { createAnonymizedRequest } = require('../utils/anonymization.cjs');

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Fetch with retry logic for Claude API
const fetchWithRetry = async (url, options, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on 5xx errors
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`API error ${response.status}, retrying in ${delay/1000}s (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Network error, retrying in ${delay/1000}s (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
};

/**
 * POST /api/pcit/speaker-and-coding
 * Anonymized proxy for Claude API - CDI speaker identification and PCIT coding
 */
router.post('/speaker-and-coding', async (req, res) => {
  try {
    const userId = req.userId;
    const { transcript } = req.body;

    // Validate request body
    if (!transcript || !Array.isArray(transcript)) {
      return res.status(400).json({ error: 'Missing or invalid transcript array' });
    }

    if (transcript.length === 0) {
      return res.status(400).json({ error: 'Transcript is empty' });
    }

    // Validate each utterance
    for (let i = 0; i < transcript.length; i++) {
      const utterance = transcript[i];
      if (typeof utterance.speaker !== 'number') {
        return res.status(400).json({ error: `Invalid speaker at index ${i}` });
      }
      if (typeof utterance.text !== 'string' || !utterance.text.trim()) {
        return res.status(400).json({ error: `Invalid or empty text at index ${i}` });
      }
    }

    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    // Create anonymized request mapping (NO user data sent to Claude)
    const requestId = await createAnonymizedRequest(
      userId,
      'anthropic',
      'cdi-speaker-coding',
      { utteranceCount: transcript.length }
    );

    // Format transcript for the prompt (only speaker numbers and text)
    const formattedScript = transcript
      .map(u => `Speaker ${u.speaker}: "${u.text}"`)
      .join('\n');

    const prompt = `You are an expert PCIT (Parent-Child Interaction Therapy) Coder. Your task is to:
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
"You're building a tall tower!" [DO: Describe] - Describing ongoing play
"Great job stacking those blocks neatly!" [DO: Praise] - Labeled praise
"What color should we use next?" [DON'T: Question] - Asking a question
`;

    // Call Claude API (NO user metadata)
    const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
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
      console.error(`[PROXY] Claude CDI coding error for ${requestId}:`, errorData);
      return res.status(response.status).json({
        error: 'Failed to analyze and code transcript',
        details: errorData.error?.message || 'Unknown error'
      });
    }

    const data = await response.json();
    const fullResponse = data.content[0].text;

    // Extract parent speaker
    const parentSpeakerMatch = fullResponse.match(/PARENT_SPEAKER:\s*(\d+)/i);
    const parentSpeaker = parentSpeakerMatch ? parseInt(parentSpeakerMatch[1], 10) : 0;

    // Extract coding (everything after PARENT_SPEAKER line)
    const codingStartIndex = fullResponse.indexOf('\n', fullResponse.indexOf('PARENT_SPEAKER:'));
    const coding = codingStartIndex > 0 ? fullResponse.substring(codingStartIndex).trim() : fullResponse;

    console.log(`[PROXY] Claude CDI coding success for ${requestId}`);

    res.json({
      parentSpeaker,
      coding,
      fullResponse
    });

  } catch (error) {
    console.error('[PROXY] Claude CDI coding error:', error);
    res.status(500).json({
      error: 'Failed to analyze and code transcript',
      details: error.message
    });
  }
});

/**
 * POST /api/pcit/competency-analysis
 * Anonymized proxy for Claude API - CDI competency analysis
 */
router.post('/competency-analysis', async (req, res) => {
  try {
    const userId = req.userId;
    const { counts } = req.body;

    // Validate request body
    if (!counts || typeof counts !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid counts object' });
    }

    const requiredFields = ['praise', 'echo', 'narration', 'question', 'command', 'criticism', 'negative_phrases', 'neutral'];
    for (const field of requiredFields) {
      if (typeof counts[field] !== 'number') {
        return res.status(400).json({ error: `Missing or invalid count for: ${field}` });
      }
    }

    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    // Create anonymized request mapping
    const requestId = await createAnonymizedRequest(
      userId,
      'anthropic',
      'cdi-competency-analysis',
      { totalTags: Object.values(counts).reduce((a, b) => a + b, 0) }
    );

    const totalDonts = counts.question + counts.command + counts.criticism + counts.negative_phrases;
    const totalDos = counts.praise + counts.echo + counts.narration;

    const prompt = `You are an expert PCIT (Parent-Child Interaction Therapy) Supervisor and Coder. Your task is to analyze raw PCIT tag counts from a session and provide a comprehensive competency analysis, including recommendations.

**1. Data Input (Raw Counts for a 5-minute session):**

- Labeled Praises: ${counts.praise}
- Echo (Reflections): ${counts.echo}
- Narration (Behavioral Descriptions): ${counts.narration}
- Questions: ${counts.question}
- Commands: ${counts.command}
- Criticisms: ${counts.criticism}
- Negative Phrases: ${counts.negative_phrases}
- Neutral: ${counts.neutral}

**2. Analysis Instructions:**

Provide a structured analysis with:
1. **Overall Performance**: Brief summary (2-3 sentences)
2. **Strengths**: What's going well (bullet points)
3. **Areas for Improvement**: What needs work (bullet points)
4. **Specific Recommendations**: Concrete next steps (bullet points)

**3. PEN Skills Assessment:**
- Total DO skills (PEN): ${totalDos}
- Total DON'T skills: ${totalDonts}

**Mastery Criteria (for CDI completion):**
- 10+ Praises per 5 minutes
- 10+ Echo per 5 minutes
- 10+ Narration per 5 minutes
- 3 or fewer DON'Ts (Questions + Commands + Criticisms + Negative Phrases)
- 0 Negative Phrases

**Output Format:**
Keep the tone warm, encouraging, and constructive. Focus on progress and next steps.
`;

    const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        temperature: 0.5,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[PROXY] Claude CDI competency analysis error for ${requestId}:`, errorData);
      return res.status(response.status).json({
        error: 'Failed to analyze competency',
        details: errorData.error?.message || 'Unknown error'
      });
    }

    const data = await response.json();
    const analysis = data.content[0].text;

    console.log(`[PROXY] Claude CDI competency analysis success for ${requestId}`);

    res.json({ analysis });

  } catch (error) {
    console.error('[PROXY] Claude CDI competency analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze competency',
      details: error.message
    });
  }
});

/**
 * POST /api/pcit/pdi-speaker-and-coding
 * Anonymized proxy for Claude API - PDI speaker identification and coding
 */
router.post('/pdi-speaker-and-coding', async (req, res) => {
  try {
    const userId = req.userId;
    const { transcript } = req.body;

    // Validate request body
    if (!transcript || !Array.isArray(transcript)) {
      return res.status(400).json({ error: 'Missing or invalid transcript array' });
    }

    if (transcript.length === 0) {
      return res.status(400).json({ error: 'Transcript is empty' });
    }

    // Validate each utterance
    for (let i = 0; i < transcript.length; i++) {
      const utterance = transcript[i];
      if (typeof utterance.speaker !== 'number') {
        return res.status(400).json({ error: `Invalid speaker at index ${i}` });
      }
      if (typeof utterance.text !== 'string' || !utterance.text.trim()) {
        return res.status(400).json({ error: `Invalid or empty text at index ${i}` });
      }
    }

    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    // Create anonymized request mapping
    const requestId = await createAnonymizedRequest(
      userId,
      'anthropic',
      'pdi-speaker-coding',
      { utteranceCount: transcript.length }
    );

    // Format transcript for the prompt
    const formattedScript = transcript
      .map(u => `Speaker ${u.speaker}: "${u.text}"`)
      .join('\n');

    const prompt = `You are an expert PCIT (Parent-Child Interaction Therapy) Coder. Your task is to:
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
"<exact quote>" [Tag] - Brief explanation

Example:
PARENT_SPEAKER: 0
"Put the blocks in the box." [DO: Direct Command] - Clear, specific action
"Great job listening!" [DO: Labeled Praise] - Specific praise
"Can you come here?" [DON'T: Indirect Command] - Phrased as question
"Don't throw the toys." [DON'T: Negative Command] - States what not to do
`;

    const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
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
      console.error(`[PROXY] Claude PDI coding error for ${requestId}:`, errorData);
      return res.status(response.status).json({
        error: 'Failed to analyze and code PDI transcript',
        details: errorData.error?.message || 'Unknown error'
      });
    }

    const data = await response.json();
    const fullResponse = data.content[0].text;

    // Extract parent speaker
    const parentSpeakerMatch = fullResponse.match(/PARENT_SPEAKER:\s*(\d+)/i);
    const parentSpeaker = parentSpeakerMatch ? parseInt(parentSpeakerMatch[1], 10) : 0;

    // Extract coding
    const codingStartIndex = fullResponse.indexOf('\n', fullResponse.indexOf('PARENT_SPEAKER:'));
    const coding = codingStartIndex > 0 ? fullResponse.substring(codingStartIndex).trim() : fullResponse;

    console.log(`[PROXY] Claude PDI coding success for ${requestId}`);

    res.json({
      parentSpeaker,
      coding,
      fullResponse
    });

  } catch (error) {
    console.error('[PROXY] Claude PDI coding error:', error);
    res.status(500).json({
      error: 'Failed to analyze and code PDI transcript',
      details: error.message
    });
  }
});

/**
 * POST /api/pcit/pdi-competency-analysis
 * Anonymized proxy for Claude API - PDI competency analysis
 */
router.post('/pdi-competency-analysis', async (req, res) => {
  try {
    const userId = req.userId;
    const { counts } = req.body;

    // Validate request body
    if (!counts || typeof counts !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid counts object' });
    }

    const requiredFields = ['direct_command', 'positive_command', 'specific_command', 'labeled_praise', 'correct_warning', 'correct_timeout', 'indirect_command', 'negative_command', 'vague_command', 'chained_command', 'harsh_tone', 'neutral'];
    for (const field of requiredFields) {
      if (typeof counts[field] !== 'number') {
        return res.status(400).json({ error: `Missing or invalid count for: ${field}` });
      }
    }

    if (!ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'Anthropic API key not configured' });
    }

    // Create anonymized request mapping
    const requestId = await createAnonymizedRequest(
      userId,
      'anthropic',
      'pdi-competency-analysis',
      { totalTags: Object.values(counts).reduce((a, b) => a + b, 0) }
    );

    const totalEffective = counts.direct_command + counts.positive_command + counts.specific_command;
    const totalIneffective = counts.indirect_command + counts.negative_command + counts.vague_command + counts.chained_command;
    const totalCommands = totalEffective + totalIneffective;
    const effectivePercent = totalCommands > 0 ? Math.round((totalEffective / totalCommands) * 100) : 0;

    const prompt = `You are an expert PCIT (Parent-Child Interaction Therapy) Supervisor and Coder. Your task is to analyze raw PDI (Parent-Directed Interaction) tag counts from a session and provide a comprehensive competency analysis, including recommendations.

**1. Data Input (Raw Counts for PDI session):**

**Effective Command Skills:**
- Direct Commands: ${counts.direct_command}
- Positive Commands: ${counts.positive_command}
- Specific Commands: ${counts.specific_command}
- Labeled Praise: ${counts.labeled_praise}
- Correct Warnings: ${counts.correct_warning}
- Correct Timeout Statements: ${counts.correct_timeout}

**Ineffective Command Skills:**
- Indirect Commands: ${counts.indirect_command}
- Negative Commands: ${counts.negative_command}
- Vague Commands: ${counts.vague_command}
- Chained Commands: ${counts.chained_command}
- Harsh Tone: ${counts.harsh_tone}

**Neutral:** ${counts.neutral}

**Summary Statistics:**
- Total Effective Commands: ${totalEffective}
- Total Ineffective Commands: ${totalIneffective}
- Total Commands: ${totalCommands}
- Effective Command Percentage: ${effectivePercent}%

**2. Analysis Instructions:**

Provide a structured analysis with:
1. **Overall Performance**: Brief summary (2-3 sentences)
2. **Command Effectiveness**: Assessment of command quality and compliance likelihood
3. **Strengths**: What's going well (bullet points)
4. **Areas for Improvement**: What needs work (bullet points)
5. **Specific Recommendations**: Concrete next steps (bullet points)

**PDI Mastery Criteria:**
- 75%+ of commands should be Effective (Direct + Positive + Specific)
- Minimize Indirect Commands (phrased as questions)
- Eliminate Negative Commands (focus on what TO do)
- No Chained Commands (one command at a time)
- No Harsh Tone

**Output Format:**
Keep the tone warm, encouraging, and constructive. Focus on progress and next steps.
`;

    const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        temperature: 0.5,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`[PROXY] Claude PDI competency analysis error for ${requestId}:`, errorData);
      return res.status(response.status).json({
        error: 'Failed to analyze PDI competency',
        details: errorData.error?.message || 'Unknown error'
      });
    }

    const data = await response.json();
    const analysis = data.content[0].text;

    console.log(`[PROXY] Claude PDI competency analysis success for ${requestId}`);

    res.json({ analysis });

  } catch (error) {
    console.error('[PROXY] Claude PDI competency analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze PDI competency',
      details: error.message
    });
  }
});

module.exports = router;
