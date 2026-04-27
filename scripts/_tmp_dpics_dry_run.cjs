/**
 * Dry-run DPICS coding for a given session.
 * Reads from DB, calls the LLM with dpicsCoding_old.txt, prints prompt + result.
 * Does NOT write anything back to the database.
 */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { llmCall } = require('../server/llm/gateway.cjs');
const { parseJSON } = require('../server/llm/repair.cjs');

const prisma = new PrismaClient();

const SESSION_ID = '703ff443-aeca-4ed0-987e-2d0b5bbadb33';
const SILENT_SPEAKER_ID = '__SILENT__';

// ── Load old DPICS prompt ────────────────────────────────────────────────────
const oldPromptPath = path.join(__dirname, '../server/prompts/dpicsCoding_old.txt');
const dpicsSystemPrompt = fs.readFileSync(oldPromptPath, 'utf-8');

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`DPICS DRY-RUN — Session ${SESSION_ID}`);
  console.log(`Prompt file: dpicsCoding_old.txt`);
  console.log(`${'='.repeat(80)}\n`);

  // Fetch utterances from DB
  const utterances = await prisma.utterance.findMany({
    where: { sessionId: SESSION_ID },
    orderBy: { order: 'asc' }
  });

  if (utterances.length === 0) {
    console.error('No utterances found for this session.');
    process.exit(1);
  }

  console.log(`Found ${utterances.length} utterances (${utterances.filter(u => u.speaker !== SILENT_SPEAKER_ID).length} non-silent)\n`);

  // Build utterance data for the prompt (same as service — skip silent slots)
  const utterancesData = utterances
    .filter(u => u.speaker !== SILENT_SPEAKER_ID)
    .map((utt, idx) => ({
      id: idx,
      role: utt.role,
      text: utt.text
    }));

  const userPrompt = `**Input Format:**

You will receive a chronological JSON list of dialogue turns with ${utterancesData.length} conversations:

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

  const fullPrompt = `${dpicsSystemPrompt}\n\n${userPrompt}`;

  // ── Print full prompt ────────────────────────────────────────────────────
  console.log(`${'─'.repeat(80)}`);
  console.log('SYSTEM PROMPT (dpicsCoding_old.txt):');
  console.log(`${'─'.repeat(80)}`);
  console.log(dpicsSystemPrompt);

  console.log(`\n${'─'.repeat(80)}`);
  console.log('USER PROMPT:');
  console.log(`${'─'.repeat(80)}`);
  console.log(userPrompt);

  // ── Call LLM via gateway (pcit model — gemini-3-pro-preview, falls back to Claude) ──
  console.log(`\n${'─'.repeat(80)}`);
  console.log('Calling LLM via gateway (model: pcit = gemini-3-pro-preview, fallback: Claude Sonnet)...');
  console.log(`${'─'.repeat(80)}\n`);

  const rawText = await llmCall(fullPrompt, {
    model: 'pcit',
    output: 'text',
    maxTokens: 8192,
    temperature: 0,
    timeout: 300_000,
    label: 'dpics-dry-run',
    sessionId: SESSION_ID
  });

  // ── Print result ─────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(80)}`);
  console.log('RAW LLM RESPONSE:');
  console.log(`${'─'.repeat(80)}`);
  console.log(rawText);

  // Parse and pretty-print
  try {
    const { value: parsed } = parseJSON(rawText, 'array');
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`PARSED RESULT (${parsed.length} parent utterances coded):`);
    console.log(`${'─'.repeat(80)}`);
    console.log(JSON.stringify(parsed, null, 2));

    // Count codes
    const counts = {};
    for (const r of parsed) {
      counts[r.code] = (counts[r.code] || 0) + 1;
    }
    console.log(`\n${'─'.repeat(80)}`);
    console.log('CODE COUNTS:');
    console.log(`${'─'.repeat(80)}`);
    for (const [code, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${code}: ${count}`);
    }
  } catch (parseErr) {
    console.log('\n(Could not parse as JSON — see raw response above)', parseErr.message);
  }

  await prisma.$disconnect();
  console.log(`\n${'='.repeat(80)}`);
  console.log('DRY RUN COMPLETE — no database changes made');
  console.log(`${'='.repeat(80)}\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  prisma.$disconnect().catch(() => {});
  process.exit(1);
});
