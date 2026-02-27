'use strict';
/**
 * Test script: run `role-id` prompt against both Gemini Flash and Claude
 * for a specific session, and print results side-by-side.
 *
 * Usage: node scripts/test-role-id.cjs
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { PrismaClient } = require('@prisma/client');
const { llmCall }      = require('../server/llm/gateway.cjs');
const { loadPromptWithVariables } = require('../server/prompts/index.cjs');

const SESSION_ID = '807db5e6-74ad-423c-ba20-b3ead3b58aad';

async function main() {
  const prisma = new PrismaClient();

  try {
    // 1. Fetch utterances
    const utterances = await prisma.utterance.findMany({
      where:   { sessionId: SESSION_ID },
      orderBy: { order: 'asc' },
    });

    if (utterances.length === 0) {
      console.error(`No utterances found for session ${SESSION_ID}`);
      process.exit(1);
    }
    console.log(`Loaded ${utterances.length} utterances for session ${SESSION_ID}\n`);

    // 2. Build prompt (same shape as pcitAnalysisService)
    const utterancesForPrompt = utterances.map(u => ({
      speaker: u.speaker,
      text:    u.text,
      start:   u.startTime,
      end:     u.endTime,
    }));

    const prompt = loadPromptWithVariables('roleIdentification', {
      UTTERANCES_JSON: JSON.stringify(utterancesForPrompt, null, 2),
    });

    const callOpts = { maxTokens: 2048, temperature: 0.3, label: 'role-id-test' };

    // 3. Call Gemini Flash
    console.log('═══════════════════════════════════════════════════════');
    console.log('MODEL: gemini-2.0-flash');
    console.log('═══════════════════════════════════════════════════════');
    const flashResult = await llmCall(prompt, { ...callOpts, model: 'flash' });
    console.log(JSON.stringify(flashResult, null, 2));

    // 4. Call Claude
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('MODEL: claude-sonnet-4-6');
    console.log('═══════════════════════════════════════════════════════');
    const claudeResult = await llmCall(prompt, { ...callOpts, model: 'claude' });
    console.log(JSON.stringify(claudeResult, null, 2));

  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
