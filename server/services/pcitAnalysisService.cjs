/**
 * PCIT Analysis Service
 * Handles PCIT coding, feedback generation, and score calculation
 */
const fetch = require('node-fetch');
const https = require('https');
const prisma = require('./db.cjs');

// HTTPS agent with keepAlive for long-running requests (reasoning models)
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30000,
  timeout: 120000
});
const { callClaudeForFeedback, parseClaudeJsonResponse } = require('./claudeService.cjs');
const { getUtterances, updateUtteranceRoles, updateUtteranceTags, updateRevisedFeedback, SILENT_SPEAKER_ID } = require('../utils/utteranceUtils.cjs');
const { DPICS_TO_TAG_MAP, calculateNoraScore } = require('../utils/scoreConstants.cjs');
const { loadPrompt, loadPromptWithVariables } = require('../prompts/index.cjs');
const { decryptSensitiveData } = require('../utils/encryption.cjs');

// ============================================================================
// AI Provider Configuration
// ============================================================================

// Switch between 'claude-sonnet' and 'gemini-flash' for the 6 analysis calls.
// CDI Coaching generation (Gemini Pro streaming) is unaffected.
const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini-flash';

/**
 * Unified AI call helper — routes to Claude Sonnet or Gemini Flash based on AI_PROVIDER.
 * @param {string} prompt - The user prompt
 * @param {Object} options
 * @param {number}  options.maxTokens     - Max output tokens (default 2048)
 * @param {number}  options.temperature   - Sampling temperature (default 0.7)
 * @param {string}  options.systemPrompt  - Optional system prompt (Claude only; prepended for Gemini)
 * @param {string}  options.responseType  - 'object' | 'array' (passed through to parseClaudeJsonResponse)
 * @returns {Promise<Object|Array>} Parsed JSON response
 */
async function callAI(prompt, options = {}) {
  const {
    maxTokens = 2048,
    temperature = 0.7,
    systemPrompt = null,
    responseType = 'object'
  } = options;

  if (AI_PROVIDER === 'claude-sonnet') {
    return callClaudeForFeedback(prompt, { maxTokens, temperature, systemPrompt, responseType });
  }

  // Gemini Flash path
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  // Gemini simple API has no system field — prepend system prompt to user prompt
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Gemini Flash API error: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Empty response from Gemini Flash API');
  }

  return parseClaudeJsonResponse(text, responseType);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate child's age from birth year or birthday
 * @param {number} birthYear - Child's birth year
 * @param {Date} birthday - Child's birthday (optional, more precise)
 * @returns {number} Child's age in years
 */
function calculateChildAge(birthYear, birthday) {
  const today = new Date();
  if (birthday) {
    const birthDate = new Date(birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
  return today.getFullYear() - birthYear;
}

/**
 * Calculate child's age in months from birthday
 * @param {Date} birthday - Child's birthday
 * @param {number} birthYear - Child's birth year (fallback)
 * @returns {number} Child's age in months
 */
function calculateChildAgeInMonths(birthday, birthYear) {
  const today = new Date();
  if (birthday) {
    const birthDate = new Date(birthday);
    const months = (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());
    return months;
  }
  // Fallback: assume mid-year birth if only year is available
  return (today.getFullYear() - birthYear) * 12;
}

/**
 * Extract child speaker from role identification JSON
 * @param {Object} roleIdentificationJson - Role identification data
 * @returns {string|null} Speaker ID of the child, or null if not found
 */
function getChildSpeaker(roleIdentificationJson) {
  const speakerIdentification = roleIdentificationJson?.speaker_identification || {};
  for (const [speakerId, info] of Object.entries(speakerIdentification)) {
    if (info.role === 'CHILD') {
      return speakerId;
    }
  }
  return null;
}

/**
 * Format gender enum to readable text
 * @param {string} genderEnum - Gender enum value (BOY, GIRL, OTHER)
 * @returns {string} Readable gender text
 */
function formatGender(genderEnum) {
  const genderMap = {
    'BOY': 'boy',
    'GIRL': 'girl',
    'OTHER': 'child'
  };
  return genderMap[genderEnum] || 'child';
}

/**
 * Format utterances for prompt display
 * Handles silent slots specially to make them visible as coaching opportunities
 * @param {Array} utterances - Array of utterance objects
 * @returns {string} Formatted transcript string
 */
function formatUtterancesForPrompt(utterances) {
  return utterances.map((u, i) => {
    if (u.speaker === SILENT_SPEAKER_ID) {
      const duration = (u.endTime - u.startTime).toFixed(1);
      return `[${String(i).padStart(2, '0')}] ⏸️ SILENCE (${duration}s) - opportunity to narrate or praise`;
    }
    const roleLabel = u.role === 'adult' ? 'Parent' : u.role === 'child' ? 'Child' : u.speaker;
    const tagSuffix = u.pcitTag ? ` [${u.pcitTag}]` : '';
    return `[${String(i).padStart(2, '0')}] ${roleLabel}: ${u.text}${tagSuffix}`;
  }).join('\n');
}

// ============================================================================
// Gemini Streaming Helper (for thinking models)
// ============================================================================

/**
 * Call Gemini API using streaming endpoint to avoid connection resets
 * Thinking models (gemini-3-pro-preview) can be silent for 30-60s while reasoning,
 * which causes ECONNRESET. Streaming keeps the connection alive with heartbeat chunks.
 * Includes automatic retry logic for timeout/connection errors.
 * @param {Array} contents - Array of message objects {role, parts}
 * @param {Object} options - Generation options
 * @returns {Promise<string>} The complete response text
 */
async function callGeminiStreaming(contents, options = {}) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  const {
    temperature = 0.7,
    maxOutputTokens = 8192,
    timeout = 300000,  // 5 minutes for thinking models
    maxRetries = 3
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      if (attempt > 1) {
        console.log(`🔄 [GEMINI] Retry attempt ${attempt}/${maxRetries}...`);
        // Wait before retry: 5s, 10s for subsequent attempts
        await new Promise(resolve => setTimeout(resolve, attempt * 5000));
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:streamGenerateContent?key=${GEMINI_API_KEY}&alt=sse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature,
              maxOutputTokens
            }
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Gemini API error: ${response.status} - ${errorText.substring(0, 200)}`);
      }

      // Read streaming response
      const reader = response.body;
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      for await (const chunk of reader) {
        buffer += decoder.decode(chunk, { stream: true });

        // Process complete SSE events (data: {...}\n\n)
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';  // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6).trim();
            if (jsonStr && jsonStr !== '[DONE]') {
              try {
                const data = JSON.parse(jsonStr);
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  fullText += text;
                }
              } catch (e) {
                // Skip malformed JSON chunks
              }
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.startsWith('data: ')) {
        const jsonStr = buffer.slice(6).trim();
        if (jsonStr && jsonStr !== '[DONE]') {
          try {
            const data = JSON.parse(jsonStr);
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              fullText += text;
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }

      if (!fullText) {
        throw new Error('Empty response from Gemini streaming API');
      }

      return fullText;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      // Check if error is retryable (timeout, connection reset, network errors)
      const isRetryable = error.name === 'AbortError' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND' ||
        error.message?.includes('timeout') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('network');

      if (isRetryable && attempt < maxRetries) {
        console.warn(`⚠️ [GEMINI] Attempt ${attempt} failed (${error.message}), will retry...`);
        continue;
      }

      // Non-retryable error or max retries reached
      throw error;
    }
  }

  // Should not reach here, but just in case
  throw lastError || new Error('Gemini API call failed after retries');
}

// ============================================================================
// Child Profiling — Single Gemini Call (replaces Phases 5/6/7)
// ============================================================================

/**
 * Format utterances for psychologist review
 * @param {Array} utterances - Array of utterance objects with roles
 * @returns {string} Formatted transcript for psychologist
 */
function formatUtterancesForPsychologist(utterances) {
  return utterances
    .filter(u => u.speaker !== SILENT_SPEAKER_ID)
    .map((u, i) => {
      const roleLabel = u.role === 'adult' ? 'Parent' : u.role === 'child' ? 'Child' : u.speaker;
      return `${roleLabel}: ${u.text}`;
    }).join('\n');
}

/**
 * Build shared template variables for child profiling prompts
 * @param {Object} childInfo - Child's info (name, ageMonths, gender, clinicalPriority)
 * @param {Object} tagCounts - Session metrics from PCIT coding
 * @param {Array} utterances - Utterances with roles
 * @returns {Object} Template variables object
 */
function buildProfilingVariables(childInfo, tagCounts, utterances) {
  const { name, ageMonths, gender, clinicalPriority, isFirstSession } = childInfo;
  const transcript = formatUtterancesForPsychologist(utterances);

  const formatLevel = (level) => level ? level.replace(/_/g, ' ').toLowerCase() : 'none';
  const formatStrategy = (strategy) => strategy ? strategy.replace(/_/g, ' ').toLowerCase() : 'none';

  const formatRowDetails = (row) => {
    const parts = [];
    if (row.fromUserIssue && row.userIssues) {
      const issues = JSON.parse(row.userIssues).map(i => i.replace(/_/g, ' '));
      parts.push(`User-reported: ${issues.join(', ')}`);
    }
    if (row.fromWacb && row.wacbQuestions) {
      const qs = JSON.parse(row.wacbQuestions);
      parts.push(`WACB signals: ${qs.join(', ')}${row.wacbScore ? ` (score: ${row.wacbScore})` : ''}`);
    }
    return parts.length > 0 ? parts.join('. ') : 'none';
  };

  const primaryRow = (clinicalPriority?.issuePriorities || []).find(r => r.priorityRank === 1);
  const otherPriorities = (clinicalPriority?.issuePriorities || []).filter(r => r.priorityRank > 1);

  // Extract human-readable issue names from issuePriority rows
  const formatIssueLabel = (row) => {
    if (row?.fromUserIssue && row.userIssues) {
      try {
        return JSON.parse(row.userIssues).map(i => i.replace(/_/g, ' ').toLowerCase()).join(', ');
      } catch (_) {}
    }
    if (row?.fromWacb && row.wacbQuestions) {
      try {
        return JSON.parse(row.wacbQuestions).join(', ');
      } catch (_) {}
    }
    return formatLevel(row?.clinicalLevel);
  };

  const primaryIssueText = primaryRow ? formatIssueLabel(primaryRow) : 'none';
  const otherIssuesText = otherPriorities.length > 0
    ? otherPriorities.map(r => `  - ${formatIssueLabel(r)}`).join('\n')
    : '  none';

  const sessionMetrics = `- Labeled Praises: ${tagCounts.praise || 0} (goal: 10+)
- Reflections: ${tagCounts.echo || 0} (goal: 10+)
- Behavioral Descriptions: ${tagCounts.narration || 0} (goal: 10+)
- Questions: ${tagCounts.question || 0} (reduce)
- Commands: ${tagCounts.command || 0} (reduce)
- Criticisms: ${tagCounts.criticism || 0} (eliminate)`;

  return {
    CHILD_NAME: name || 'the child',
    CHILD_AGE_MONTHS: String(ageMonths || 'unknown'),
    CHILD_GENDER: gender || 'child',
    PRIMARY_ISSUE: primaryIssueText,
    PRIMARY_STRATEGY: formatStrategy(clinicalPriority?.primaryStrategy),
    PRIMARY_DETAILS: primaryRow ? formatRowDetails(primaryRow) : 'none',
    OTHER_ISSUES: otherIssuesText,
    SESSION_METRICS: sessionMetrics,
    TRANSCRIPT: transcript,
    FIRST_SESSION_NOTE: isFirstSession
      ? 'please note, This is the first session the parent has with the parent app Nora. for first session, it is to hook user in, setting expectations that we are going to be very helpful to them. For us, the primary goal of this session is to get user excited about emotional massage and the discipline coaching (which will be available once their emotional bank account is ready) and committed to making daily massage session as their priority.'
      : ''
  };
}

/**
 * Generate developmental profiling using Claude
 * Produces developmental observations (5 clinical domains) with milestone library framework
 * @param {Array} utterances - Utterances with roles
 * @param {Object} childInfo - Child's info (name, ageMonths, gender, clinicalPriority)
 * @param {Object} tagCounts - Session metrics from PCIT coding
 * @param {string} childSpeaker - Speaker ID of the child (e.g., 'speaker_0')
 * @returns {Promise<Object|null>} { developmentalObservation, metadata } or null on failure
 */
async function generateDevelopmentalProfiling(utterances, childInfo, tagCounts = {}, childSpeaker = null) {
  const variables = buildProfilingVariables(childInfo, tagCounts, utterances);
  const prompt = loadPromptWithVariables('developmentalProfiling', variables);

  console.log(`📊 [DEV-PROFILING] Calling ${AI_PROVIDER} for developmental profiling...`);

  try {
    const parsed = await callAI(prompt, { maxTokens: 8192, temperature: 0.5 });

    const result = {
      developmentalObservation: parsed.developmental_observation || null,
      metadata: parsed.session_metadata || null
    };

    console.log(`✅ [DEV-PROFILING] Response parsed — ${result.developmentalObservation?.domains?.length || 0} domains`);
    return result;
  } catch (error) {
    console.error('❌ [DEV-PROFILING] Error:', error.message);
    return null;
  }
}

// ============================================================================
// About Child — Psychologist Narrative + Observation Extraction
// ============================================================================

/**
 * Call Gemini Flash and return raw text (no JSON parsing).
 * Used for free-form narrative steps where the output is prose, not JSON.
 */
async function callGeminiFlashRaw(prompt, options = {}) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const { temperature = 0.7, maxOutputTokens = 4096, responseMimeType = null } = options;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const generationConfig = { temperature, maxOutputTokens };
  if (responseMimeType) generationConfig.responseMimeType = responseMimeType;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Gemini Flash API error: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini Flash');
  return text;
}

/**
 * Generate "About Child" observations via two sequential Gemini Flash calls.
 *
 * Step 1 — Free-form psychologist narrative (Gemini Flash, prose output)
 * Step 3 — Extract structured observations from the narrative (Gemini Flash, JSON array)
 *
 * @param {Array}  utterances - Utterances with roles
 * @param {Object} childInfo  - { name, ageMonths, gender }
 * @param {Object} tagCounts  - Session metrics from PCIT coding
 * @returns {Promise<Array|null>} Array of AboutChildItem or null on failure
 */
async function generateAboutChild(utterances, childInfo, tagCounts = {}) {
  const { name, ageMonths, gender } = childInfo;
  const transcript = formatUtterancesForPsychologist(utterances);
  const ageDisplay = ageMonths ? `${ageMonths} months old` : 'unknown age';

  // ── Step 1: Free-form psychologist narrative ──────────────────────────────
  const step1Prompt = `this is transcripts from a 5 mins parent-child play session. as a pcit therapist and child developmental psychologist, can you provide feedbacks to parents on the play session. can you also highlight what are the things you notice with the child?

**Child Info:**
- ${name || 'Child'}, ${ageDisplay} ${gender || 'child'}

**Session Metrics:**
- Labeled Praises: ${tagCounts.praise || 0} (goal: 10+)
- Reflections: ${tagCounts.echo || 0} (goal: 10+)
- Behavioral Descriptions: ${tagCounts.narration || 0} (goal: 10+)
- Questions: ${tagCounts.question || 0} (reduce)
- Commands: ${tagCounts.command || 0} (reduce)
- Criticisms: ${tagCounts.criticism || 0} (eliminate)

**Transcript:**
${transcript}`;

  console.log(`📊 [ABOUT-CHILD] Step 1: Calling Gemini Flash for psychologist narrative...`);

  let narrativeText;
  try {
    narrativeText = await callGeminiFlashRaw(step1Prompt, { temperature: 0.7, maxOutputTokens: 4096 });
    console.log(`✅ [ABOUT-CHILD] Step 1 complete (${narrativeText.length} chars)`);
  } catch (error) {
    console.error('❌ [ABOUT-CHILD] Step 1 failed:', error.message);
    return null;
  }

  // ── Step 3: Extract structured child observations ─────────────────────────
  const step3Prompt = `Extract ONLY the "Observations of the Child" section - the insights about the child's behavior, development, and characteristics observed during the session.

Format the observations as a JSON array, ranked by positivity follow by significance. Each observation should have:
- id: sequential number starting from 1
- Title: A short catchy title (2-4 words) describing the trait or behavior
- Description: A brief 1-sentence summary for parents
- Details: A longer explanation with developmental context, why this matters, and actionable tips about how to improve.

Here is the psychologist feedback to analyze:
${narrativeText}

Return ONLY a valid JSON array. No markdown code blocks or explanations.

Example format:
[
  {
    "id": 1,
    "Title": "Little Scientist",
    "Description": "Bobby was exploring physics (gravity/pouring). He wasn't trying to be messy.",
    "Details": "His persistent desire to 'pour' and 'take out' reflects a 3-year-old's natural curiosity about cause and effect. At this age, repetitive pouring is a way of testing physical boundaries and understanding how objects occupy space."
  },
  {
    "id": 2,
    "Title": "Sensory Seeker",
    "Description": "Bobby loves the 'squishy' texture today!",
    "Details": "He is very focused on the tactile nature of the vitamins—calling them 'squishy, squishy'. This is a hallmark of the sensorimotor stage of development, where kids learn through touch and texture."
  }
]`;

  console.log(`📊 [ABOUT-CHILD] Step 3: Calling Gemini Flash (JSON mode) to extract child observations...`);

  try {
    const rawJson = await callGeminiFlashRaw(step3Prompt, {
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json'
    });
    const aboutChild = JSON.parse(rawJson);
    if (!Array.isArray(aboutChild)) throw new Error('Expected array response');
    console.log(`✅ [ABOUT-CHILD] Extracted ${aboutChild.length} child observations`);
    return aboutChild;
  } catch (error) {
    console.error('❌ [ABOUT-CHILD] Step 3 failed:', error.message);
    return null;
  }
}

/**
 * Generate CDI coaching cards using Gemini
 * Produces actionable coaching summary and cards for parents
 * @param {Array} utterances - Utterances with roles
 * @param {Object} childInfo - Child's info (name, ageMonths, gender, clinicalPriority)
 * @param {Object} tagCounts - Session metrics from PCIT coding
 * @param {string} childSpeaker - Speaker ID of the child (e.g., 'speaker_0')
 * @returns {Promise<Object|null>} { coachingSummary, coachingCards } or null on failure
 */
async function generateCdiCoaching(utterances, childInfo, tagCounts = {}, childSpeaker = null) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.warn('⚠️ [CDI-COACHING] Gemini API key not configured, skipping');
    return null;
  }

  const variables = buildProfilingVariables(childInfo, tagCounts, utterances);
  const prompt = loadPromptWithVariables('cdiCoaching', variables);

  console.log(`📊 [CDI-COACHING] Calling Gemini API for coaching report...`);

  try {
    const userMessage = {
      role: 'user',
      parts: [{ text: prompt }]
    };

    const coachingReport = (await callGeminiStreaming([userMessage], {
      temperature: 0.5,
      maxOutputTokens: 8192,
      timeout: 300000  // 5 minutes
    })).trim();

    console.log(`✅ [CDI-COACHING] Gemini coaching report received (${coachingReport.length} chars)`);

    // Follow-up call to select 3 sections and format for mobile
    console.log(`📊 [CDI-COACHING] Calling ${AI_PROVIDER} to format 3 coaching sections...`);

    const formatPrompt = loadPromptWithVariables('cdiCoachingFormat', {
      COACHING_REPORT: coachingReport
    });

    let formatted;
    try {
      formatted = await callAI(formatPrompt, { maxTokens: 2048, temperature: 0 });
    } catch (formatError) {
      console.error('❌ [CDI-COACHING] Format call failed:', formatError.message);
      return { coachingSummary: coachingReport, coachingCards: null, tomorrowGoal: null };
    }

    const result = {
      coachingSummary: coachingReport,
      coachingCards: formatted.sections || null,
      tomorrowGoal: formatted.tomorrowGoal || null
    };

    console.log(`✅ [CDI-COACHING] Formatted — ${result.coachingCards?.length || 0} sections`);
    return result;
  } catch (error) {
    console.error('❌ [CDI-COACHING] Error:', error.message);
    return null;
  }
}

// ============================================================================
// CDI Feedback Generation (Multi-prompt approach)
// ============================================================================

/**
 * Generate combined analysis and feedback prompt for CDI session
 * Combines analysis and improvement into a single prompt
 */
function generateCombinedFeedbackPrompt(counts, utterances, childName = 'the child') {
  return `You are an expert in parent-child interaction. Analyze this 5-minute play session with ${childName}.

**Session Metrics:**
- Labeled Praises: ${counts.praise} (goal: 10+)
- Reflections: ${counts.echo} (goal: 10+)
- Behavioral Descriptions: ${counts.narration} (goal: 10+)
- Questions: ${counts.question} (reduce)
- Commands: ${counts.command} (reduce)
- Criticisms: ${counts.criticism} (reduce)
- Negative Phrases: ${counts.negative_phrases} (eliminate)

**Transcript:**
${formatUtterancesForPrompt(utterances)}

**Task:**
1. **Top Moment**: Find the ONE moment that shows the strongest parent-child connection, joy, or positive interaction.

2. **Feedback**: Be warm and encouraging. within 20 words. Give a opening messages to the session report. Do not mention about therapy or clinical terms.
Example opening messages for feedback:
- "Today's play made a net emotional deposit — your child felt seen, safe, and connected."
- "Today's play added only a small deposit — with a few gentle shifts, your emotional massage can feel much more soothing and connecting."
- "Today's play showed clear progress from last time — your deposits were more consistent, and your child stayed more relaxed and engaged."
- "Today's play included big emotions and some dysregulation. When stress runs high, deposits don't always land — and that's okay. Consistent emotional massage brings the account back."

3. **Reminder**: Write exactly 2 sentences of encouragement about how improving creates positive experiences for the child. Keep it warm and forward-looking.

4.  **ChildReaction**: Highlight insights about ${childName}'s behavior, to boost the parent's motivation to continue practising the desired skills and avoid undesired skills. Use ${childName}'s name in your response.

5. **Activity**: Infer in a few words what game or activity the parent and child played in this session (e.g. "building blocks", "coloring", "pretend cooking", "puzzle").

Return ONLY valid JSON:
{
  "topMoment": {
    "quote": "exact quote from the transcript",
    "utteranceNumber": index of utterance
  },
  "Feedback": "2 sentences of opening message",
  "exampleUtteranceNumber": index of the utterance used as example,
  "reminder": "2 sentences of encouragement",
  "ChildReaction":"2-3 sentences",
  "activity": "a few words describing the game/activity"
}

No markdown code fences.`;
}


/**
 * Format utterances with their current feedback for review
 * @param {Array} utterances - Utterances with tags and feedback
 * @returns {string} Formatted string showing utterances with current feedback
 */
function formatUtterancesWithFeedback(utterances) {
  return utterances.map((u, i) => {
    if (u.speaker === SILENT_SPEAKER_ID) {
      const duration = (u.endTime - u.startTime).toFixed(1);
      return `[${String(i).padStart(2, '0')}] ⏸️ SILENCE (${duration}s)
    Tag: SILENT
    Current feedback: "${u.feedback || 'None'}"`;
    }
    return `[${String(i).padStart(2, '0')}] ${u.speaker}: "${u.text}"
    Tag: ${u.pcitTag || 'None'}
    Current feedback: "${u.feedback || 'None'}"`;
  }).join('\n\n');
}

/**
 * Generate review feedback prompt for CDI session
 * Reviews and revises feedback for parent utterances and selects key silence slots
 */
function generateReviewFeedbackPrompt(counts, utterances) {
  // Separate parent utterances and silence slots for clarity
  const parentUtterances = utterances.filter(u =>
    u.role === 'adult' && u.speaker !== SILENT_SPEAKER_ID
  );
  const silenceSlots = utterances.filter(u => u.speaker === SILENT_SPEAKER_ID);

  return `You are an expert PCIT parent-child interaction therapyst.

**Session Metrics:**
- Labeled Praises: ${counts.praise} (goal: 10+)
- Reflections/Echo: ${counts.echo} (goal: 10+)
- Behavioral Descriptions/Narration: ${counts.narration} (goal: 10+)
- Questions: ${counts.question} (reduce)
- Commands: ${counts.command} (reduce)
- Criticisms: ${counts.criticism} (reduce)

**All Utterances with Current Feedback:**
${formatUtterancesWithFeedback(utterances)}

**Your Task:**
1. Take into consideration the session metrics, knowing how well parent perform in each category, and the conversation context, propose revised feedback if provide additional value. 
   **For desirable skills (LP, BD, RF, RQ)**, do not change the original feedback. you may add an "additional_tip" only if it is extremely insightful, that will help the parents to improve their overall performance/metrics. 
   **For undesirable skills ((NTA, DC, IC, Q, UP)**, provide constructive, warm feedback with specific alternatives.

2. Identify any silence slots that:
   - Are good opportunities for the parent to practice PEN skills
   - Come at natural moments in play (not awkward pauses)
   - Would benefit from coaching tips

**Output Format:**
Return ONLY a valid JSON array. Each item has:
- "id": the utterance index number (from [XX] in the transcript)
- "feedback": revised feedback string (1-2 sentences, warm and specific)
- "additional_tip": optional extra tip for desirable skills (null if not applicable)


**Rules:**
- Maximum 3 silence slots
- Keep feedback warm, specific, and actionable
- Return ONLY the JSON array, no other text

No markdown code fences.`;
}

/**
 * Orchestrator function for multi-prompt CDI feedback
 * @param {Object} counts - Tag counts from PCIT coding
 * @param {Array} utterances - Utterances with tags
 * @param {string} childName - Child's name for personalized feedback
 * @returns {Promise<Object>} Assembled feedback result
 */
async function generateCDIFeedback(counts, utterances, childName) {
  console.log('🚀 [CDI-FEEDBACK] Starting feedback generation...');

  // Call 1: Combined feedback prompt (analysis + improvement + example in one)
  console.log('📝 [CDI-FEEDBACK] Running combined feedback prompt...');
  const feedbackData = await callAI(
    generateCombinedFeedbackPrompt(counts, utterances, childName)
  );

  console.log('✅ [CDI-FEEDBACK] Combined feedback result:', JSON.stringify(feedbackData).substring(0, 300));

  // Call 2: Review and revise feedback for utterances and silence slots
  console.log('📝 [CDI-FEEDBACK] Running Review Feedback for utterances and silence slots...');
  let revisedFeedback = [];
  try {
    const reviewData = await callAI(
      generateReviewFeedbackPrompt(counts, utterances),
      { temperature: 0.5, responseType: 'array' }  // Lower temperature, expect array response
    );
    // reviewData should be an array directly since we asked for JSON array
    revisedFeedback = Array.isArray(reviewData) ? reviewData : [];
    console.log('✅ [CDI-FEEDBACK] Review feedback result:', JSON.stringify(revisedFeedback).substring(0, 300));
  } catch (reviewError) {
    console.error('⚠️ [CDI-FEEDBACK] Review feedback failed, continuing without revised feedback:', reviewError.message);
    // Continue without revised feedback - it's an enhancement, not critical
  }

  // Assemble final result
  const result = {
    topMoment: feedbackData.topMoment?.quote,
    topMomentUtteranceNumber: feedbackData.topMoment?.utteranceNumber,
    feedback: feedbackData.Feedback,
    example: feedbackData.exampleUtteranceNumber,
    childReaction: feedbackData.ChildReaction,
    reminder: feedbackData.reminder,
    activity: feedbackData.activity || null,
    revisedFeedback: revisedFeedback  // Array of {id, feedback, additional_tip}
  };

  console.log('✅ [CDI-FEEDBACK] Feedback generation complete');
  return result;
}

// ============================================================================
// PDI Two Choices Flow Analysis
// ============================================================================

/**
 * Generate PDI Two Choices Flow analysis
 * Evaluates the parent on 4 discipline skills from the Two Choices Flow framework
 * @param {Array} utterances - Utterances with roles and PCIT tags
 * @param {string} childName - Child's name for personalized feedback
 * @returns {Promise<Array|null>} Array of 4 skill ratings or null on failure
 */
async function generatePDITwoChoicesAnalysis(utterances, childName) {
  console.log('🎯 [PDI-TWO-CHOICES] Starting Two Choices Flow analysis...');

  const transcript = utterances
    .filter(u => u.speaker !== SILENT_SPEAKER_ID)
    .map((u) => {
      const roleLabel = u.role === 'adult' ? 'Parent' : u.role === 'child' ? 'Child' : u.speaker;
      const tagSuffix = u.pcitTag ? ` [${u.pcitTag}]` : '';
      return `${roleLabel}: ${u.text}${tagSuffix}`;
    }).join('\n');

  const prompt = loadPromptWithVariables('pdiTwoChoicesFlow', {
    CHILD_NAME: childName || 'the child',
    TRANSCRIPT: transcript
  });

  try {
    const result = await callAI(prompt);
    const pdiSkills = result?.pdiSkills;

    if (!Array.isArray(pdiSkills) || pdiSkills.length === 0) {
      console.error('⚠️ [PDI-TWO-CHOICES] Invalid response structure, expected pdiSkills array');
      return null;
    }

    console.log(`✅ [PDI-TWO-CHOICES] Analysis complete — ${pdiSkills.length} skills evaluated`);
    return {
      pdiSkills,
      commandSequences: result.commandSequences || [],
      tomorrowGoal: result.tomorrowGoal || null,
      encouragement: result.encouragement || null,
      summary: result.summary || null,
    };
  } catch (error) {
    console.error('❌ [PDI-TWO-CHOICES] Error:', error.message);
    return null;
  }
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyze PCIT coding for transcript
 * Called after transcription completes
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID
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

  // Get user's child info for personalized feedback
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      childName: true,
      childGender: true,
      childBirthYear: true,
      childBirthday: true,
      issue: true,
      childConditions: true
    }
  });
  const childName = user?.childName ? decryptSensitiveData(user.childName) : 'the child';
  const childAge = user?.childBirthYear ? calculateChildAge(user.childBirthYear, user.childBirthday) : null;
  const childAgeMonths = user?.childBirthYear ? calculateChildAgeInMonths(user.childBirthday, user.childBirthYear) : null;
  const childGender = user?.childGender ? formatGender(user.childGender) : 'child';
  console.log(`✅ [ANALYSIS-STEP-1b] Child info: ${childName}, ${childAgeMonths} months old, ${childGender}`);

  // Fetch Child record early to get clinical priority fields
  let child = await prisma.child.findFirst({ where: { userId } });
  if (!child) {
    child = await prisma.child.create({
      data: {
        userId,
        name: childName || 'Child',
        birthday: user?.childBirthday || null,
        gender: user?.childGender || null,
        conditions: user?.childConditions || null
      }
    });
    console.log(`✅ [ANALYSIS-STEP-1c] Created Child record ${child.id} for user ${userId.substring(0, 8)}`);
  }
  // Fetch latest ChildIssuePriority snapshot for detail context
  const latestComputedAt = await prisma.childIssuePriority.findFirst({
    where: { childId: child.id },
    orderBy: { computedAt: 'desc' },
    select: { computedAt: true }
  });
  const issuePriorities = latestComputedAt
    ? await prisma.childIssuePriority.findMany({
        where: { childId: child.id, computedAt: latestComputedAt.computedAt },
        orderBy: { priorityRank: 'asc' }
      })
    : [];
  const clinicalPriority = {
    primaryIssue: child.primaryIssue,
    primaryStrategy: child.primaryStrategy,
    secondaryIssue: child.secondaryIssue,
    secondaryStrategy: child.secondaryStrategy,
    issuePriorities
  };
  console.log(`✅ [ANALYSIS-STEP-1c] Clinical priority: primary=${clinicalPriority.primaryIssue || 'none'}, secondary=${clinicalPriority.secondaryIssue || 'none'}, detail rows=${issuePriorities.length}`);

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

  const isCDI = session.mode === 'CDI';

  // STEP 1: Identify speaker roles
  const roleIdentificationPrompt = loadPromptWithVariables('roleIdentification', {
    UTTERANCES_JSON: JSON.stringify(utterancesForPrompt, null, 2)
  });

  console.log(`📊 [ANALYSIS-STEP-3] Calling ${AI_PROVIDER} for role identification...`);

  let roleIdentificationJson;
  let adultSpeakers = [];
  try {
    roleIdentificationJson = await callAI(roleIdentificationPrompt, { maxTokens: 2048, temperature: 0.3 });
    console.log(`✅ [ANALYSIS-STEP-3] Role identification parsed successfully`);

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
    console.error('❌ [ROLE-ID-ERROR] Failed role identification:', parseError.message);
    throw new Error(`Failed role identification: ${parseError.message}`);
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

  // Load DPICS system prompt
  const dpicsSystemPrompt = loadPrompt('dpicsCoding');

  // Prepare utterances data for the prompt
  const utterancesData = utterancesWithRoles.map((utt, idx) => ({
    id: idx,
    role: utt.role,
    text: utt.text
  }));

  // Create index mapping for later (idx -> utt.id)
  const idxToUttId = utterancesWithRoles.map(utt => utt.id);

  // User prompt
  const userPrompt = `**Input Format:**

You will receive a chronological JSON list of dialogue turns with ${utterancesWithRoles.length} conversations:

${JSON.stringify(utterancesData, null, 2)}

Each item has:
- role: Identify if the speaker is "parent" or "child"
- text: The content to analyze

**Output Specification:**

Output only a valid JSON array of objects for the Parent segments.

Format: [{"id": <int>, "code": <string>, "feedback": <string>}, ...]

Do not include child segments in the output.

Do not include markdown or whitespace (minified JSON).

**CRITICAL INSTRUCTIONS:**
- Return ONLY the JSON array, nothing else
- Do NOT write any explanatory text before or after the JSON
- Do NOT use markdown code blocks like \`\`\`json
- Do NOT say "I'm ready" or "Here is the output" or any other text
- Your ENTIRE response must be ONLY the JSON array starting with [ and ending with ]
- First character of your response MUST be [
- Last character of your response MUST be ]
- Every parent segment MUST have both "code" and "feedback" fields`;

  console.log(`📊 [ANALYSIS-STEP-8] Calling ${AI_PROVIDER} for PCIT coding...`);
  console.log(`   Mode: ${isCDI ? 'CDI' : 'PDI'}, Utterances: ${utterancesWithRoles.length}`);

  const codingResults = await callAI(userPrompt, {
    maxTokens: 8192,
    temperature: 0,
    systemPrompt: dpicsSystemPrompt,
    responseType: 'array'
  });

  if (!Array.isArray(codingResults)) {
    throw new Error('Expected array of coding results');
  }

  console.log(`✅ [ANALYSIS-STEP-8] Successfully parsed ${codingResults.length} coding results`);
  const fullResponse = JSON.stringify(codingResults);

  // Build ID-to-tag maps for efficient updates
  const pcitTagMap = {};
  const noraTagMap = {};
  const feedbackMap = {};

  for (const result of codingResults) {
    if (result.id !== undefined && result.code) {
      const actualUttId = idxToUttId[result.id];
      if (actualUttId) {
        pcitTagMap[actualUttId] = result.code;
        noraTagMap[actualUttId] = DPICS_TO_TAG_MAP[result.code] || result.code;
        if (result.feedback) {
          feedbackMap[actualUttId] = result.feedback;
        }
      }
    }
  }

  // Update utterances with PCIT tags, Nora tags, and feedback in database
  await updateUtteranceTags(sessionId, pcitTagMap, noraTagMap, feedbackMap);

  console.log(`Updated tags and feedback for ${Object.keys(pcitTagMap).length} utterances`);

  // Count codes from JSON results
  const tagCounts = {
    echo: 0,
    labeled_praise: 0,
    unlabeled_praise: 0,
    praise: 0,
    narration: 0,
    direct_command: 0,
    indirect_command: 0,
    command: 0,
    question: 0,
    criticism: 0,
    neutral: 0
  };

  for (const result of codingResults) {
    const code = result.code;
    if (code === 'RF' || code === 'RQ') {
      tagCounts.echo++;
    } else if (code === 'LP') {
      tagCounts.labeled_praise++;
      tagCounts.praise++;
    } else if (code === 'UP') {
      tagCounts.unlabeled_praise++;
    } else if (code === 'BD') {
      tagCounts.narration++;
    } else if (code === 'DC') {
      tagCounts.direct_command++;
      tagCounts.command++;
    } else if (code === 'IC') {
      tagCounts.indirect_command++;
      tagCounts.command++;
    } else if (code === 'Q') {
      tagCounts.question++;
    } else if (code === 'NTA') {
      tagCounts.criticism++;
    } else if (code === 'ID') {
      tagCounts.neutral++;
    } else if (code === 'AK') {
      tagCounts.neutral++;
    }
  }

  // STEP 9: Child Profiling — parallel developmental (Claude) + coaching (Gemini) calls
  console.log(`📊 [ANALYSIS-STEP-9] Generating child profiling (developmental + coaching in parallel)...`);
  let childProfilingResult = null;
  try {
    const utterancesForProfiling = await getUtterances(sessionId);
    const childSpeaker = getChildSpeaker(roleIdentificationJson);
    const priorCompletedCount = await prisma.session.count({
      where: { userId, analysisStatus: 'COMPLETED' }
    });
    const childInfoForProfiling = {
      name: childName,
      ageMonths: childAgeMonths,
      gender: childGender,
      clinicalPriority,
      isFirstSession: priorCompletedCount === 0
    };

    const [profilingSettled, coachingSettled, aboutChildSettled] = await Promise.allSettled([
      generateDevelopmentalProfiling(utterancesForProfiling, childInfoForProfiling, tagCounts, childSpeaker),
      generateCdiCoaching(utterancesForProfiling, childInfoForProfiling, tagCounts, childSpeaker),
      generateAboutChild(utterancesForProfiling, childInfoForProfiling, tagCounts)
    ]);

    const profilingResult = profilingSettled.status === 'fulfilled' ? profilingSettled.value : null;
    const coachingResult = coachingSettled.status === 'fulfilled' ? coachingSettled.value : null;
    const aboutChildResult = aboutChildSettled.status === 'fulfilled' ? aboutChildSettled.value : null;

    if (profilingSettled.status === 'rejected') {
      console.error('⚠️ [ANALYSIS-STEP-9] Developmental profiling rejected:', profilingSettled.reason?.message);
    }
    if (coachingSettled.status === 'rejected') {
      console.error('⚠️ [ANALYSIS-STEP-9] CDI coaching rejected:', coachingSettled.reason?.message);
    }
    if (aboutChildSettled.status === 'rejected') {
      console.error('⚠️ [ANALYSIS-STEP-9] About child rejected:', aboutChildSettled.reason?.message);
    }

    // Merge into the same shape downstream code expects
    if (profilingResult || coachingResult) {
      childProfilingResult = {
        developmentalObservation: profilingResult?.developmentalObservation || null,
        metadata: profilingResult?.metadata || null,
        coachingSummary: coachingResult?.coachingSummary || null,
        coachingCards: coachingResult?.coachingCards || null,
        tomorrowGoal: coachingResult?.tomorrowGoal || null,
        aboutChild: aboutChildResult || null
      };
      console.log(`✅ [ANALYSIS-STEP-9] Child profiling complete — ${childProfilingResult.developmentalObservation?.domains?.length || 0} domains, ${childProfilingResult.coachingCards?.length || 0} coaching cards`);
    } else {
      console.log(`⚠️ [ANALYSIS-STEP-9] Child profiling skipped or both calls failed`);
    }
  } catch (profilingError) {
    console.error('⚠️ [ANALYSIS-STEP-9] Child profiling error:', profilingError.message);
  }

  // Get competency analysis based on tag counts and utterances
  let competencyAnalysis = null;
  try {
    // Get updated utterances with tags from database
    const utterancesWithTags = await getUtterances(sessionId);

    // Always run CDI multi-prompt feedback flow (for both CDI and PDI)
    console.log(`🎯 [COMPETENCY-ANALYSIS] Using multi-prompt feedback generation for ${session.mode} session...`);
    const feedbackResult = await generateCDIFeedback(tagCounts, utterancesWithTags, childName);

    // Save revised feedback to database
    if (feedbackResult.revisedFeedback && feedbackResult.revisedFeedback.length > 0) {
      await updateRevisedFeedback(sessionId, feedbackResult.revisedFeedback);
    }

    competencyAnalysis = {
      topMoment: feedbackResult.topMoment,
      topMomentUtteranceNumber: typeof feedbackResult.topMomentUtteranceNumber === 'number' ? feedbackResult.topMomentUtteranceNumber : null,
      feedback: feedbackResult.feedback || null,
      example: typeof feedbackResult.example === 'number' ? feedbackResult.example : null,
      childReaction: feedbackResult.childReaction || null,
      tips: null,
      reminder: feedbackResult.reminder,
      activity: feedbackResult.activity || null,
      analyzedAt: new Date().toISOString(),
      mode: session.mode
    };

    console.log(`✅ [COMPETENCY-ANALYSIS] Multi-prompt feedback complete`);

    // For PDI sessions, additionally run Two Choices Flow analysis
    if (!isCDI) {
      console.log('🎯 [COMPETENCY-ANALYSIS] Running PDI Two Choices Flow analysis...');
      const pdiResult = await generatePDITwoChoicesAnalysis(utterancesWithTags, childName);
      if (pdiResult) {
        competencyAnalysis.pdiSkills = pdiResult.pdiSkills;
        competencyAnalysis.pdiCommandSequences = pdiResult.commandSequences;
        competencyAnalysis.pdiTomorrowGoal = pdiResult.tomorrowGoal;
        competencyAnalysis.pdiEncouragement = pdiResult.encouragement;
        competencyAnalysis.pdiSummary = pdiResult.summary;
        console.log(`✅ [COMPETENCY-ANALYSIS] PDI Two Choices Flow analysis added — ${pdiResult.pdiSkills.length} skills`);
      }
    }
  } catch (compError) {
    console.error('Error generating competency analysis:', compError.message);
  }

  // Calculate Nora Score
  const { score: overallScore } = calculateNoraScore(tagCounts, session.mode);

  // Store PCIT coding, competency analysis, and overall score in database
  console.log(`💾 [DATABASE-UPDATE] Saving competencyAnalysis for session ${sessionId}:`, competencyAnalysis ? 'present' : 'NULL');

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
      overallScore,
      coachingSummary: childProfilingResult?.coachingSummary || null,
      coachingCards: childProfilingResult?.coachingCards
        ? { sections: childProfilingResult.coachingCards, tomorrowGoal: childProfilingResult.tomorrowGoal || null }
        : null,
      aboutChild: childProfilingResult?.aboutChild || null
    }
  });

  // Upsert ChildProfiling record if profiling succeeded (child already fetched earlier)
  if (childProfilingResult?.developmentalObservation && child) {
    try {
      await prisma.childProfiling.upsert({
        where: { sessionId },
        create: {
          userId,
          sessionId,
          childId: child.id,
          summary: childProfilingResult.developmentalObservation.summary || null,
          domains: childProfilingResult.developmentalObservation.domains || [],
          metadata: childProfilingResult.metadata || null
        },
        update: {
          childId: child.id,
          summary: childProfilingResult.developmentalObservation.summary || null,
          domains: childProfilingResult.developmentalObservation.domains || [],
          metadata: childProfilingResult.metadata || null
        }
      });
      console.log(`✅ [DATABASE-UPDATE] ChildProfiling record upserted for session ${sessionId}`);

      // STEP 10: Milestone Detection (non-blocking)
      try {
        const { detectAndUpdateMilestones } = require('./milestoneDetectionService.cjs');
        const milestoneResult = await detectAndUpdateMilestones(child.id, sessionId);
        if (milestoneResult) {
          console.log(`✅ [ANALYSIS-STEP-10] Milestones: ${milestoneResult.newEmerging} emerging, ${milestoneResult.newAchieved} achieved`);

          // Store celebrations in session if any
          if (milestoneResult.celebrations && milestoneResult.celebrations.length > 0) {
            await prisma.session.update({
              where: { id: sessionId },
              data: { milestoneCelebrations: milestoneResult.celebrations }
            });
            console.log(`✅ [ANALYSIS-STEP-10] Stored ${milestoneResult.celebrations.length} milestone celebrations`);

            // Send milestone push notification (non-blocking)
            try {
              const { sendMilestoneNotification } = require('./pushNotifications.cjs');
              await sendMilestoneNotification(userId, milestoneResult.celebrations);
            } catch (notifError) {
              console.error('⚠️ [ANALYSIS-STEP-10] Milestone notification error (non-blocking):', notifError.message);
            }
          }
        }
      } catch (milestoneError) {
        console.error('⚠️ [ANALYSIS-STEP-10] Milestone detection error (non-blocking):', milestoneError.message);
      }
    } catch (profilingDbError) {
      console.error('⚠️ [DATABASE-UPDATE] Failed to upsert ChildProfiling:', profilingDbError.message);
    }
  }

  console.log(`✅ [DATABASE-UPDATE] PCIT coding and overall score (${overallScore}) stored for session ${sessionId}`);

  return { tagCounts, competencyAnalysis, overallScore, childProfilingResult };
}

module.exports = {
  analyzePCITCoding,
  generateCDIFeedback,
  generatePDITwoChoicesAnalysis,
  generateDevelopmentalProfiling,
  generateCdiCoaching,
  generateAboutChild
};
