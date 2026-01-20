/**
 * PCIT Analysis Service
 * Handles PCIT coding, feedback generation, and score calculation
 */
const fetch = require('node-fetch');
const prisma = require('./db.cjs');
const { callClaudeForFeedback, parseClaudeJsonResponse } = require('./claudeService.cjs');
const { getUtterances, updateUtteranceRoles, updateUtteranceTags } = require('../utils/utteranceUtils.cjs');
const { DPICS_TO_TAG_MAP, calculateNoraScore } = require('../utils/scoreConstants.cjs');
const { loadPrompt, loadPromptWithVariables } = require('../prompts/index.cjs');

// ============================================================================
// CDI Feedback Generation (Multi-prompt approach)
// ============================================================================

/**
 * Generate analysis prompt for CDI session
 */
function generateAnalysisPrompt(counts, utterances) {
  return `You are an expert parent-child interaction analyst. Analyze this 5-minute play session.

**Session Metrics:**
- Labeled Praises: ${counts.praise} (goal: 10+)
- Reflections: ${counts.echo} (goal: 10+)
- Behavioral Descriptions: ${counts.narration} (goal: 10+)
- Questions: ${counts.question}
- Commands: ${counts.command}
- Criticisms: ${counts.criticism}
- Negative Phrases: ${counts.negative_phrases}
(Goal for last 4 combined: 3 or fewer)

**Transcript:**
${utterances.map((u, i) =>
  `[${String(i).padStart(2, '0')}] ${u.speaker}: ${u.text} ${u.pcitTag || ''}`
).join('\n')}

**Task:**
Provide two things:

1. **Summary**: Write a warm, encouraging 2-3 sentence summary of how this session went.
   - Highlight key strengths and the overall quality of interaction.
   - Speak directly to the parent as their coach.
   - Do not mention therapy or clinical terms.

2. **Top Moment**: Find the ONE moment that shows the strongest parent-child connection, joy, or positive interaction. Look for moments of:
   - Child and parent enjoying something together
   - Spontaneous joy or laughter
   - Creative play or imagination
   - Successful cooperation
   - Warm affection
   - In case of multiple utterance, use line breaks \\n between utterance to improve readability.

Return ONLY valid JSON:
{
  "summary": "2-3 sentence warm summary of the session",
  "topMoment": {
    "quote": "exact text from the transcript",
    "utteranceNumber": 14,
    "celebration": "exactly 1 sentence explaining why this moment matters for the child's experience"
  }
}

No markdown code fences.`;
}

/**
 * Generate improvement prompt for CDI session
 */
function generateImprovementPrompt(counts, utterances) {
  return `You are a parent coaching expert analyzing skill usage.

**Session Metrics:**
- Labeled Praises: ${counts.praise} (goal: 10+)
- Reflections: ${counts.echo} (goal: 10+)
- Behavioral Descriptions: ${counts.narration} (goal: 10+)
- Questions: ${counts.question} (reduce)
- Commands: ${counts.command} (reduce)
- Criticisms: ${counts.criticism} (reduce)
- Negative Phrases: ${counts.negative_phrases} (eliminate)

**Transcript with codes:**
${utterances.map((u, i) =>
  `[${String(i).padStart(2, '0')}] ${u.speaker}: ${u.text} ${u.pcitTag || ''}`
).join('\n')}

**Task:**
Identify the SINGLE most important skill to improve. Consider:
1. Which positive skill (Praise/Reflection/Description) is furthest from goal?
2. Which skill to reduce is most problematic?
3. Which change would most improve the child's experience?
4. Intepret what things/game the parent and the child do in the play session. If the game is not ideal for practicing the particular skill, highlight to parents in tips.
    - Use imaginative toys (blocks, dolls, Play-Doh).
    - Avoid rule-based games (board games) or solitary items (books, puzzles) that make you lead.

Return ONLY valid JSON:
{
  "skillToImprove": "Labeled Praises | Reflections | Behavioral Descriptions | Reduce Questions | Reduce Commands | Eliminate Criticisms | Eliminate Negative Phrases",
  "currentCount": 5,
  "goalCount": 10,
  "tip": "2-3 warm, encouraging sentences explaining what to practice and why it helps the child.",
  "reasoning": "1-2 sentences explaining why you chose this as the priority"
}

No markdown code fences.`;
}

/**
 * Generate example prompt for CDI session
 */
function generateExamplePrompt(improvementResult, utterances) {
  return `You are helping a parent learn through examples.

**The skill to improve:** ${improvementResult.skillToImprove}

**The tip:** ${improvementResult.tip}

**Transcript:**
${utterances.map((u, i) =>
  `[${String(i).padStart(2, '0')}] ${u.speaker}: ${u.text} ${u.pcitTag || ''}`
).join('\n')}

**Task:**
Find the best utterance that demonstrates either:
- A missed opportunity to use this skill
- An incorrect use of this skill
- A moment where using this skill would have been particularly beneficial

Return ONLY valid JSON:
{
  "exampleUtteranceNumber": 14,
  "transition": "2-3 sentences that: (1) restate the tip briefly, (2) reference the specific utterance by saying "example below", do not mention utterance number, (3) explain what could be done differently",
  "reminder": "exactly 2 sentences about how improving this skill creates positive experiences for the child. Keep encouraging and forward-looking."
}

No markdown code fences.`;
}

/**
 * Orchestrator function for multi-prompt CDI feedback
 * @param {Object} counts - Tag counts from PCIT coding
 * @param {Array} utterances - Utterances with tags
 * @returns {Promise<Object>} Assembled feedback result
 */
async function generateCDIFeedback(counts, utterances) {
  console.log('🚀 [CDI-FEEDBACK] Starting multi-prompt feedback generation...');

  // Call 1 & 2 in parallel (they're independent)
  console.log('📝 [CDI-FEEDBACK] Running Call 1 (Analysis) and Call 2 (Improvement) in parallel...');
  const [analysisData, improvementData] = await Promise.all([
    callClaudeForFeedback(generateAnalysisPrompt(counts, utterances)),
    callClaudeForFeedback(generateImprovementPrompt(counts, utterances))
  ]);

  console.log('✅ [CDI-FEEDBACK] Call 1 result:', JSON.stringify(analysisData).substring(0, 200));
  console.log('✅ [CDI-FEEDBACK] Call 2 result:', JSON.stringify(improvementData).substring(0, 200));

  // Call 3 depends on Call 2 results
  console.log('📝 [CDI-FEEDBACK] Running Call 3 (Example) with improvement context...');
  const exampleData = await callClaudeForFeedback(
    generateExamplePrompt(improvementData, utterances)
  );

  console.log('✅ [CDI-FEEDBACK] Call 3 result:', JSON.stringify(exampleData).substring(0, 200));

  // Assemble final result
  const result = {
    summary: analysisData.summary,
    topMoment: analysisData.topMoment.quote,
    celebration: analysisData.topMoment.celebration,
    tip: improvementData.tip,
    example: exampleData.exampleUtteranceNumber,
    transition: exampleData.transition,
    reminder: exampleData.reminder
  };

  console.log('✅ [CDI-FEEDBACK] Multi-prompt feedback generation complete');
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

  // Get competency analysis based on tag counts and utterances
  let competencyAnalysis = null;
  try {
    // Get updated utterances with tags from database
    const utterancesWithTags = await getUtterances(sessionId);

    if (isCDI) {
      // Use multi-prompt approach for CDI
      console.log('🎯 [COMPETENCY-ANALYSIS] Using multi-prompt CDI feedback generation...');
      const feedbackResult = await generateCDIFeedback(tagCounts, utterancesWithTags);

      competencyAnalysis = {
        summary: feedbackResult.summary || null,
        topMoment: feedbackResult.topMoment,
        celebration: feedbackResult.celebration || null,
        tip: feedbackResult.tip || null,
        example: typeof feedbackResult.example === 'number' ? feedbackResult.example : null,
        transition: feedbackResult.transition || null,
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
      overallScore
    }
  });

  console.log(`✅ [DATABASE-UPDATE] PCIT coding and overall score (${overallScore}) stored for session ${sessionId}`);

  return { tagCounts, competencyAnalysis, overallScore };
}

module.exports = {
  analyzePCITCoding,
  generateCDIFeedback,
  generatePDICompetencyPrompt
};
