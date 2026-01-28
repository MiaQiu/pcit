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
// Gemini Psychologist Feedback Generation
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
 * Generate psychologist feedback using Gemini API
 * Returns chat history for follow-up extractChildPortfolioInsights call
 * @param {Array} utterances - Utterances with roles
 * @param {Object} childInfo - Child's info (name, ageMonths, gender)
 * @param {Object} tagCounts - Session metrics from PCIT coding
 * @param {string} childSpeaker - Speaker ID of the child (e.g., 'speaker_0')
 * @returns {Promise<Array|null>} Chat history for multi-turn conversation, or null on failure
 */
async function generatePsychologistFeedback(utterances, childInfo, tagCounts = {}, childSpeaker = null) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.warn('⚠️ [PSYCHOLOGIST-FEEDBACK] Gemini API key not configured, skipping');
    return null;
  }

  const { name, ageMonths, gender } = childInfo;
  const transcript = formatUtterancesForPsychologist(utterances);

  // Format age as months or years for readability
  const ageDisplay = ageMonths ? `${ageMonths} months old` : 'unknown age';
  const childSpeakerInfo = childSpeaker
    ? `- ${childSpeaker}: ${name || 'Child'}, ${ageDisplay} ${gender || 'child'}`
    : `- ${name || 'Child'}, ${ageDisplay} ${gender || 'child'}`;

  const prompt = `this is transcripts from a 5 mins parent-child play session. as a pcit therapist and child developmental psychologist, can you provide feedbacks to parents on the play session. can you also highlight what are the things you notice with the child?

**Child Info:**
${childSpeakerInfo}

**Session Metrics:**
- Labeled Praises: ${tagCounts.praise || 0} (goal: 10+)
- Reflections: ${tagCounts.echo || 0} (goal: 10+)
- Behavioral Descriptions: ${tagCounts.narration || 0} (goal: 10+)
- Questions: ${tagCounts.question || 0} (reduce)
- Commands: ${tagCounts.command || 0} (reduce)
- Criticisms: ${tagCounts.criticism || 0} (eliminate)

**Transcript:**
${transcript}
`;

  console.log(`📊 [PSYCHOLOGIST-FEEDBACK] Calling Gemini API (streaming)...`);

  try {
    const userMessage = {
      role: 'user',
      parts: [{ text: prompt }]
    };

    // Use streaming endpoint to avoid ECONNRESET during thinking phase
    const responseText = await callGeminiStreaming([userMessage], {
      temperature: 0.7,
      maxOutputTokens: 8192,
      timeout: 300000  // 5 minutes for complex analysis
    });

    // Build chat history for follow-up questions
    const modelMessage = {
      role: 'model',
      parts: [{ text: responseText }]
    };

    console.log(`✅ [PSYCHOLOGIST-FEEDBACK] Gemini API response received`);

    return [userMessage, modelMessage];
  } catch (error) {
    console.error('❌ [PSYCHOLOGIST-FEEDBACK] Error:', error.message);
    return null;
  }
}

/**
 * Extract child portfolio insights from psychologist feedback using multi-turn conversation
 * @param {Array} chatHistory - Chat history from generatePsychologistFeedback
 * @returns {Promise<Object>} Condensed portfolio insights for mobile display
 */
async function extractChildPortfolioInsights(chatHistory) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    console.warn('⚠️ [PORTFOLIO-INSIGHTS] Gemini API key not configured, skipping portfolio insights');
    return null;
  }

  if (!chatHistory || chatHistory.length === 0) {
    console.warn('⚠️ [PORTFOLIO-INSIGHTS] No chat history provided, skipping portfolio insights');
    return null;
  }

  const followUpPrompt = `link suggestions/tips to impact to the child, based on what you have observed about the child in output json format. ranked by importance/impact.  avoid using utterance index.  Do not mention PCIT.

###output json format:

    [
      {
        "id": 1,
        "suggested_change": "Switch from Questions to Reflections",
        "analysis": {
          "observation": "Towards the end of the play session, the rapid questions (\"Airport?\", \"Parcel?\") caused the child to repeat himself or go silent. Because he has some articulation struggles (saying \"Parcel\" vs \"Plaster\"), questions can feel like a test he is failing.",
          "impact": "Reflections act as a verbal mirror. By simply repeating the correct word (\"Oh, a plaster!\") without a questioning tone, you validate his attempt rather than challenging it.",
          "result": "This provides 'verbal scaffolding.' The child hears the correct pronunciation immediately after his attempt, which helps him self-correct his speech patterns without feeling pressure to perform. This builds linguistic confidence."
        },
        "example_scenario": {
          "child": "Go bridge.",
          "parent": "You are going to the big bridge. (Declarative statement, falling intonation)"
        }
      },
      {
        "id": 2,
        "suggested_change": "Ignore the Whine, but Praise the Normal Voice",
        "analysis": {
          "observation": "Currently, whining is a high-efficiency tool for him. At the beginning of the playsession, he whines, and immediately gets attention. In the middle, he whines \"Yeah\" regarding the light, and you immediately turn it off. He has learned: Whining = Fast Action.",
          "impact": "We need to break this association. If you intentionally delay your response by 5-10 seconds when he whines (Active Ignoring), but respond instantly with warmth when he uses a pleasant voice, his brain will re-wire.",
          "result": "This uses 'differential reinforcement.' The child learns that emotional regulation (speaking calmly) is the only way to get needs met, leading to a rapid decrease in fussiness and an increase in self-control."
        },
        "example_scenario": {
          "child": "(Whining) I want light off...",
          "parent": "(Silence/Look away for 5 seconds)... (Child takes breath, speaks normally) 'Light off please.' -> 'Thank you for using your calm voice! I will turn it off.'"
        }
      },
      {
        "id": 3,
        "suggested_change": "Use Behavioral Descriptions instead of Commands",
        "analysis": {
          "observation": "The child is highly sensory-seeking (fixated on the \"Shiny\" light). Commands like \"Drink your milk\" or \"Turn on\" interrupt his sensory exploration, which can cause resistance.",
          "impact": "Behavioral Descriptions (\"You are touching the shiny switch,\" \"You are holding the warm cup\") allow you to join his world rather than directing it. It validates his sensory experiences.",
          "result": "This increases 'felt safety.' When a child feels their parent understands their internal sensory state without trying to change it, their cortisol (stress) levels drop, and they become more cooperative naturally."
        },
        "example_scenario": {
          "child": "(Touching the light switch)",
          "parent": "You are making the room bright and shiny!"
        }
      },
      {
        "id": 4,
        "suggested_change": "The 5-Second Pause (Silence)",
        "analysis": {
          "observation": "In the 'Airport' sequence, there were 4 verbal prompts in under 6 seconds. The child went silent. A 3-year-old's processing speed is slower than an adult's; he was likely still formulating his answer to the first question when the next two hit him.",
          "impact": "After making a Reflection, wait for 5 full seconds (count in your head). This silence is not empty; it is 'processing time' for the child.",
          "result": "Slowing the pace prevents cognitive overload. You will likely find he shares richer, more complex thoughts because he has the mental space to retrieve the words he wants to use."
        },
        "example_scenario": {
          "child": "Airport.",
          "parent": "You are thinking about the airport. (Wait... 1... 2... 3... 4... 5...)"
        }
      }
    ]

Return ONLY valid JSON. Do not include markdown code blocks.`;

  console.log(`📊 [PORTFOLIO-INSIGHTS] Calling Gemini API for portfolio insights (streaming, multi-turn)...`);

  try {
    // Continue the conversation with follow-up question
    const contents = [
      ...chatHistory,
      {
        role: 'user',
        parts: [{ text: followUpPrompt }]
      }
    ];

    // Use streaming endpoint to avoid ECONNRESET during thinking phase
    const responseText = await callGeminiStreaming(contents, {
      temperature: 0.3,
      maxOutputTokens: 4096,
      timeout: 300000  // 5 minutes for complex analysis
    });

    // Parse JSON response
    const cleanedResponse = responseText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    // Log raw response for debugging if JSON parse fails
    let portfolioInsights;
    try {
      portfolioInsights = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('❌ [PORTFOLIO-INSIGHTS] JSON parse error. Raw response (first 500 chars):', cleanedResponse.substring(0, 500));
      throw parseError;
    }

    console.log(`✅ [PORTFOLIO-INSIGHTS] Gemini API response received (multi-turn)`);

    // Return array directly (don't spread into object)
    return portfolioInsights;
  } catch (error) {
    console.error('❌ [PORTFOLIO-INSIGHTS] Error extracting portfolio insights:', error.message);
    return null;
  }
}

/**
 * Extract "About Child" observations from psychologist feedback using Claude
 * @param {Array} chatHistory - Chat history from generatePsychologistFeedback
 * @returns {Promise<Array|null>} Array of child observations ranked by importance, or null on failure
 */
async function extractAboutChild(chatHistory) {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    console.warn('⚠️ [ABOUT-CHILD] Anthropic API key not configured, skipping');
    return null;
  }

  if (!chatHistory || chatHistory.length === 0) {
    console.warn('⚠️ [ABOUT-CHILD] No chat history provided, skipping');
    return null;
  }

  // Extract the psychologist feedback text from chat history
  const psychologistResponse = chatHistory.find(msg => msg.role === 'model');
  if (!psychologistResponse || !psychologistResponse.parts?.[0]?.text) {
    console.warn('⚠️ [ABOUT-CHILD] No psychologist response found in chat history');
    return null;
  }

  const feedbackText = psychologistResponse.parts[0].text;

  const prompt = `You are analyzing a child psychologist's feedback from a parent-child play session.

Extract ONLY the "Observations of the Child" section - the insights about the child's behavior, development, and characteristics observed during the session.

Format the observations as a JSON array, ranked by importance/significance. Each observation should have:
- id: sequential number starting from 1
- Title: A short catchy title (2-4 words) describing the trait or behavior
- Description: A brief 1-sentence summary for parents
- Details: A longer explanation with developmental context and why this matters

Here is the psychologist feedback to analyze:

${feedbackText}

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

  console.log(`📊 [ABOUT-CHILD] Calling Claude API to extract child observations...`);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
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
    const responseText = data.content[0].text.trim();

    // Parse JSON response
    const cleanedResponse = responseText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    let aboutChild;
    try {
      aboutChild = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('❌ [ABOUT-CHILD] JSON parse error. Raw response (first 500 chars):', cleanedResponse.substring(0, 500));
      throw parseError;
    }

    if (!Array.isArray(aboutChild)) {
      throw new Error('Expected array of child observations');
    }

    console.log(`✅ [ABOUT-CHILD] Extracted ${aboutChild.length} child observations`);
    return aboutChild;
  } catch (error) {
    console.error('❌ [ABOUT-CHILD] Error extracting child observations:', error.message);
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

2. **Feedback**: Be warm and encouraging. within 100 words, Give a compliment, follow by one exact feedback to help parent improve. Use an example from the conversation to demonstrate the point (use phrase "below example", do not mention the utterance number). Do not mention about therapy or clinical terms.

3. **Reminder**: Write exactly 2 sentences of encouragement about how improving creates positive experiences for the child. Keep it warm and forward-looking.

4.  **ChildReaction**: Highlight insights about ${childName}'s behavior, to boost the parent's motivation to continue practising the desired skills and avoid undesired skills. Use ${childName}'s name in your response.

Return ONLY valid JSON:
{
  "topMoment": {
    "quote": "exact quote from the transcript",
    "utteranceNumber": index of utterance
  },
  "Feedback": "2-3 paragraphs, within 100 words, separated by ***.",
  "exampleUtteranceNumber": index of the utterance used as example,
  "reminder": "2 sentences of encouragement"
  "ChildReaction":"2-3 sentences"
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
  const feedbackData = await callClaudeForFeedback(
    generateCombinedFeedbackPrompt(counts, utterances, childName)
  );

  console.log('✅ [CDI-FEEDBACK] Combined feedback result:', JSON.stringify(feedbackData).substring(0, 300));

  // Call 2: Review and revise feedback for utterances and silence slots
  console.log('📝 [CDI-FEEDBACK] Running Review Feedback for utterances and silence slots...');
  let revisedFeedback = [];
  try {
    const reviewData = await callClaudeForFeedback(
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
    revisedFeedback: revisedFeedback  // Array of {id, feedback, additional_tip}
  };

  console.log('✅ [CDI-FEEDBACK] Feedback generation complete');
  return result;
}

// ============================================================================
// PDI Feedback Generation
// ============================================================================

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
      childBirthday: true
    }
  });
  const childName = user?.childName ? decryptSensitiveData(user.childName) : 'the child';
  const childAge = user?.childBirthYear ? calculateChildAge(user.childBirthYear, user.childBirthday) : null;
  const childAgeMonths = user?.childBirthYear ? calculateChildAgeInMonths(user.childBirthday, user.childBirthYear) : null;
  const childGender = user?.childGender ? formatGender(user.childGender) : 'child';
  console.log(`✅ [ANALYSIS-STEP-1b] Child info: ${childName}, ${childAgeMonths} months old, ${childGender}`);

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

  // Call appropriate PCIT coding endpoint based on mode
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key not configured');
  }

  const isCDI = session.mode === 'CDI';

  // STEP 1: Identify speaker roles using Claude
  const roleIdentificationPrompt = loadPromptWithVariables('roleIdentification', {
    UTTERANCES_JSON: JSON.stringify(utterancesForPrompt, null, 2)
  });

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
        content: roleIdentificationPrompt
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
    roleIdentificationJson = parseClaudeJsonResponse(roleIdentificationText);
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
      system: dpicsSystemPrompt,
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
    codingResults = parseClaudeJsonResponse(fullResponse, 'array');

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

  // STEP 9: Generate psychologist feedback using Gemini API
  // STEP 9, 10, 11: Generate psychologist feedback, extract portfolio insights, and extract about child
  console.log(`📊 [ANALYSIS-STEP-9] Generating psychologist feedback via Gemini...`);
  let childPortfolioInsights = null;
  let aboutChild = null;
  try {
    const utterancesForPsychologist = await getUtterances(sessionId);

    const childSpeaker = getChildSpeaker(roleIdentificationJson);
    const chatHistory = await generatePsychologistFeedback(
      utterancesForPsychologist,
      {
        name: childName,
        ageMonths: childAgeMonths,
        gender: childGender
      },
      tagCounts,
      childSpeaker
    );

    if (chatHistory) {
      console.log(`✅ [ANALYSIS-STEP-9] Psychologist chat history generated`);

      // STEP 10: Extract portfolio insights (multi-turn conversation)
      console.log(`📊 [ANALYSIS-STEP-10] Extracting portfolio insights...`);
      childPortfolioInsights = await extractChildPortfolioInsights(chatHistory);

      if (childPortfolioInsights) {
        console.log(`✅ [ANALYSIS-STEP-10] Portfolio insights extracted successfully`);
      } else {
        console.log(`⚠️ [ANALYSIS-STEP-10] Portfolio insights extraction failed`);
      }

      // STEP 11: Extract about child observations using Claude
      console.log(`📊 [ANALYSIS-STEP-11] Extracting about child observations...`);
      aboutChild = await extractAboutChild(chatHistory);

      if (aboutChild) {
        console.log(`✅ [ANALYSIS-STEP-11] About child observations extracted successfully`);
      } else {
        console.log(`⚠️ [ANALYSIS-STEP-11] About child extraction failed`);
      }
    } else {
      console.log(`⚠️ [ANALYSIS-STEP-9] Psychologist feedback skipped or failed`);
    }
  } catch (psychError) {
    console.error('⚠️ [ANALYSIS-STEP-9/10/11] Error:', psychError.message);
  }

  // Get competency analysis based on tag counts and utterances
  let competencyAnalysis = null;
  try {
    // Get updated utterances with tags from database
    const utterancesWithTags = await getUtterances(sessionId);

    if (isCDI) {
      // Use multi-prompt approach for CDI
      console.log('🎯 [COMPETENCY-ANALYSIS] Using multi-prompt CDI feedback generation...');
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
        analyzedAt: new Date().toISOString(),
        mode: session.mode
      };

      console.log(`✅ [COMPETENCY-ANALYSIS] Multi-prompt CDI feedback complete`);
    } else {
      // Use single prompt for PDI
      const competencyPrompt = generatePDICompetencyPrompt(tagCounts, utterancesWithTags);

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

        try {
          const parsedAnalysis = parseClaudeJsonResponse(analysisText);

          competencyAnalysis = {
            summary: parsedAnalysis.summary || null,
            topMoment: parsedAnalysis.topMoment,
            celebration: parsedAnalysis.celebration || null,
            tip: parsedAnalysis.tip || null,
            example: typeof parsedAnalysis.example === 'number' ? parsedAnalysis.example : null,
            transition: parsedAnalysis.transition || null,
            tips: parsedAnalysis.tips,
            reminder: parsedAnalysis.reminder,
            analyzedAt: new Date().toISOString(),
            mode: session.mode
          };

          console.log(`✅ [COMPETENCY-ANALYSIS] PDI analysis generated for session ${sessionId}`);
        } catch (parseError) {
          console.error('⚠️ [COMPETENCY-ANALYSIS] Failed to parse PDI competency analysis as JSON:', parseError.message);
          competencyAnalysis = {
            topMoment: null,
            tips: analysisText,
            reminder: null,
            analyzedAt: new Date().toISOString(),
            mode: session.mode
          };
        }
      } else {
        console.error(`PDI competency analysis API call failed for session ${sessionId}`);
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
      childPortfolioInsights,  // Store portfolio insights in dedicated field
      aboutChild  // Store child observations extracted from psychologist feedback
    }
  });

  console.log(`✅ [DATABASE-UPDATE] PCIT coding and overall score (${overallScore}) stored for session ${sessionId}`);

  return { tagCounts, competencyAnalysis, overallScore, childPortfolioInsights, aboutChild };
}

module.exports = {
  analyzePCITCoding,
  generateCDIFeedback,
  generatePDICompetencyPrompt,
  generatePsychologistFeedback,
  extractChildPortfolioInsights,
  extractAboutChild
};
