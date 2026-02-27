'use strict';
/**
 * Test script: run `pcit-coding` prompt against both Gemini Flash and Claude
 * for a specific session, and print results side-by-side.
 *
 * Usage: node scripts/test-pcit-coding.cjs
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');
const { llmCall }      = require('../server/llm/gateway.cjs');
const { geminiCall }   = require('../server/llm/providers/gemini.cjs');
const { parseJSON }    = require('../server/llm/repair.cjs');
const { loadPrompt }   = require('../server/prompts/index.cjs');
const { PCIT_CODING }  = require('../server/llm/schemas/index.cjs');

const FLASH3_MODEL = 'gemini-3-flash-preview';

const SESSION_ID = '807db5e6-74ad-423c-ba20-b3ead3b58aad';

async function main() {
  const prisma = new PrismaClient();

  try {
    // 1. Fetch session to determine CDI/PDI mode
    const session = await prisma.session.findUnique({ where: { id: SESSION_ID } });
    if (!session) { console.error('Session not found'); process.exit(1); }
    const isCDI = session.mode === 'CDI';
    console.log(`Session mode: ${session.mode} (isCDI=${isCDI})\n`);

    // 2. Fetch utterances with roles (post-role-id state)
    const utterances = await prisma.utterance.findMany({
      where:   { sessionId: SESSION_ID },
      orderBy: { order: 'asc' },
    });
    console.log(`Loaded ${utterances.length} utterances\n`);

    const adultCount = utterances.filter(u => u.role === 'adult').length;
    const childCount = utterances.filter(u => u.role === 'child').length;
    const nullCount  = utterances.filter(u => !u.role).length;
    console.log(`  adult=${adultCount}  child=${childCount}  no-role=${nullCount}\n`);

    // 3. Build prompt (mirrors pcitAnalysisService exactly)
    const dpicsSystemPrompt = loadPrompt('dpicsCoding') + (!isCDI ? `

**PDI SESSION — Feedback Override for Commands:**
This is a PDI (Parent-Directed Interaction) session. The rules above apply for coding, but the feedback generation strategy for commands is different:
- **DC (Direct Command)**: DC is a TARGET SKILL in PDI. Do NOT suggest replacing it with a PRIDE skill. Instead, briefly reinforce it or coach on quality (e.g. was it direct, specific, calm, positively phrased?).
- **IC (Indirect Command)**: Still undesirable. Coach toward a DC instead (e.g. "Try stating it directly: 'Please put the block down.'"). Do NOT suggest using BD or LP.
All other feedback rules remain the same.` : '');

    const utterancesData = utterances.map((utt, idx) => ({
      id:   idx,
      role: utt.role,
      text: utt.text,
    }));

    const userPrompt = `**Input Format:**

You will receive a chronological JSON list of dialogue turns with ${utterances.length} conversations:

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

    const callOpts = {
      maxTokens:    8192,
      temperature:  0,
      systemPrompt: dpicsSystemPrompt,
      output:       'array',
      label:        'pcit-coding-test',
      timeout:      180_000,
    };

    // 4. Call Gemini Flash 3 directly (schema enforced via generationConfig)
    console.log('═══════════════════════════════════════════════════════');
    console.log(`MODEL: ${FLASH3_MODEL}  (schema: PCIT_CODING)`);
    console.log('═══════════════════════════════════════════════════════');
    const flash3Start = Date.now();
    const fullPrompt  = `${dpicsSystemPrompt}\n\n${userPrompt}`;
    const flash3Raw   = await geminiCall(
      process.env.GEMINI_API_KEY,
      FLASH3_MODEL,
      {
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature:      0,
          maxOutputTokens:  8192,
          responseMimeType: 'application/json',
          responseSchema:   PCIT_CODING,
        },
      },
      { timeout: 180_000 }
    );
    const flash3Ms = Date.now() - flash3Start;
    const { value: flash3Result } = parseJSON(flash3Raw.text, 'array');
    console.log(JSON.stringify({ model: FLASH3_MODEL, latencyMs: flash3Ms, inputTokens: flash3Raw.usage.inputTokens, outputTokens: flash3Raw.usage.outputTokens }));
    console.log(`Total coded items: ${flash3Result.length}`);
    console.log(JSON.stringify(flash3Result, null, 2));

    // 5. Call Claude (no schema)
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('MODEL: claude-sonnet-4-6  (no schema)');
    console.log('═══════════════════════════════════════════════════════');
    const claudeResult = await llmCall(userPrompt, { ...callOpts, model: 'claude' });
    console.log(`Total coded items: ${claudeResult.length}`);
    console.log(JSON.stringify(claudeResult, null, 2));

    // 6. Diff
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('DIFF: utterances where models disagree');
    console.log('═══════════════════════════════════════════════════════');
    const flash3Map = Object.fromEntries(flash3Result.map(r => [r.id, r]));
    const claudeMap = Object.fromEntries(claudeResult.map(r => [r.id, r]));
    const allIds    = new Set([...Object.keys(flash3Map), ...Object.keys(claudeMap)]);

    let diffCount = 0;
    for (const id of [...allIds].sort((a, b) => Number(a) - Number(b))) {
      const f = flash3Map[id];
      const c = claudeMap[id];
      if (!f || !c || f.code !== c.code) {
        diffCount++;
        const text = utterancesData[Number(id)]?.text?.substring(0, 60) || '?';
        console.log(`  id=${id}  flash3=${f?.code ?? '—'}  claude=${c?.code ?? '—'}  text="${text}"`);
      }
    }
    if (diffCount === 0) console.log('  No differences — both models agree on all codes.');
    console.log(`\nSummary: ${diffCount} difference(s) out of ${allIds.size} coded items`);

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
