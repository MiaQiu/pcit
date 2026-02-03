#!/usr/bin/env node
/**
 * Reprocess Audio Debug Script
 *
 * Given a session ID, outputs the formatted prompts used for PCIT analysis
 * along with Claude's responses to help debug and review the AI processing pipeline.
 *
 * Usage: node scripts/reprocess-audio-debug.cjs <session-id>
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Silent slot constant (from utteranceUtils.cjs)
const SILENT_SPEAKER_ID = '__SILENT__';

/**
 * Format utterances for prompt display
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

/**
 * Format utterances with their current feedback for review
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
 * Generate combined analysis and feedback prompt for CDI session
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
- Negative Phrases: ${counts.negative_phrases || 0} (eliminate)

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
 * Generate review feedback prompt for CDI session
 */
function generateReviewFeedbackPrompt(counts, utterances) {
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
1. Take into consideration the session metrics, knowing how well parent perform in each category, and the conversation context, lightly adjust the feedback given to parents.
   **For desirable skills (LP, BD, RF, RQ)**, do not change the original feedback. you may add an "additional_tip" only if it is extremely insightful, that will help the parents to improve their overall performance/metrics.
   **For undesirable skills ((NTA, DC, IC, Q, UP) and silence slots**, provide constructive, warm feedback with specific alternatives.

2. **Select up to 3 most impactful silence slots** - Choose silences that:
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
 * Call Claude API and get raw response
 */
async function callClaude(prompt, options = {}) {
  const {
    maxTokens = 2048,
    temperature = 0.7,
    model = 'claude-sonnet-4-5-20250929'
  } = options;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured. Make sure .env file exists.');
  }

  console.log(`  Calling Claude (${model}, temp=${temperature})...`);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
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
  console.log(`  Response received (${data.usage?.output_tokens || 'unknown'} tokens)`);
  return data.content[0].text;
}

async function main() {
  const sessionId = process.argv[2];

  if (!sessionId) {
    console.error('Usage: node scripts/reprocess-audio-debug.cjs <session-id>');
    process.exit(1);
  }

  try {
    console.log(`\nFetching session ${sessionId}...`);

    // Get session
    const session = await prisma.session.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      console.error(`Session ${sessionId} not found`);
      process.exit(1);
    }

    console.log(`Session found: mode=${session.mode}, overallScore=${session.overallScore}`);

    // Get user for child name
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { childName: true }
    });
    const childName = user?.childName || 'the child';
    console.log(`Child name: ${childName}`);

    // Get utterances
    const utterances = await prisma.utterance.findMany({
      where: { sessionId },
      orderBy: { order: 'asc' }
    });

    console.log(`Found ${utterances.length} utterances`);

    if (utterances.length === 0) {
      console.error('No utterances found for this session');
      process.exit(1);
    }

    // Get tag counts from session or compute defaults
    const counts = session.tagCounts || {
      echo: 0,
      praise: 0,
      narration: 0,
      question: 0,
      command: 0,
      criticism: 0,
      negative_phrases: 0
    };

    // Build output content
    const separator = '\n' + '='.repeat(80) + '\n';

    let output = '';
    output += `Session ID: ${sessionId}\n`;
    output += `Mode: ${session.mode}\n`;
    output += `Overall Score: ${session.overallScore}\n`;
    output += `Child Name: ${childName}\n`;
    output += `Utterance Count: ${utterances.length}\n`;
    output += `Generated: ${new Date().toISOString()}\n`;
    output += separator;

    output += '\n## TAG COUNTS\n\n';
    output += JSON.stringify(counts, null, 2);
    output += separator;

    output += '\n## FORMAT UTTERANCES FOR PROMPT\n\n';
    output += formatUtterancesForPrompt(utterances);
    output += separator;

    output += '\n## FORMAT UTTERANCES WITH FEEDBACK\n\n';
    output += formatUtterancesWithFeedback(utterances);
    output += separator;

    // Generate and call combined feedback prompt
    console.log('\nGenerating combined feedback prompt...');
    const combinedPrompt = generateCombinedFeedbackPrompt(counts, utterances, childName);
    output += '\n## COMBINED FEEDBACK PROMPT\n\n';
    output += combinedPrompt;
    output += separator;

    console.log('Calling Claude for combined feedback...');
    const combinedResponse = await callClaude(combinedPrompt, { temperature: 0.7 });
    output += '\n## CLAUDE RESPONSE: COMBINED FEEDBACK\n\n';
    output += combinedResponse;
    output += separator;

    // Generate and call review feedback prompt
    console.log('\nGenerating review feedback prompt...');
    const reviewPrompt = generateReviewFeedbackPrompt(counts, utterances);
    output += '\n## REVIEW FEEDBACK PROMPT\n\n';
    output += reviewPrompt;
    output += separator;

    console.log('Calling Claude for review feedback...');
    const reviewResponse = await callClaude(reviewPrompt, { temperature: 0.5 });
    output += '\n## CLAUDE RESPONSE: REVIEW FEEDBACK\n\n';
    output += reviewResponse;
    output += separator;

    // Write to file
    const outputFilename = `debug-session-${sessionId.substring(0, 8)}-${Date.now()}.txt`;
    const outputPath = path.join(__dirname, outputFilename);

    fs.writeFileSync(outputPath, output, 'utf-8');

    console.log(`\n✅ Output written to: ${outputPath}`);
    console.log(`File size: ${(output.length / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
