/**
 * Test script: compare PCIT coding (STEP 2) between Claude Sonnet and Claude Haiku
 * for a specific session. Does NOT update the database.
 *
 * Usage: node scripts/_tmp_test_pcit_coding_comparison.cjs
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// DATABASE_URL must be passed via CLI env (see doc/infrastructure.md)
// e.g. DATABASE_URL="postgresql://nora_admin:<prod-pw>@localhost:5433/nora" node scripts/...
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('nora_dev')) {
  throw new Error('Set DATABASE_URL to the prod DB via CLI (tunnel must be running on localhost:5433)');
}

const prisma = require('../server/services/db.cjs');
const { anthropicCall } = require('../server/llm/providers/anthropic.cjs');
const { loadPrompt } = require('../server/prompts/index.cjs');
const { parseJSON } = require('../server/llm/repair.cjs');
const { getLanguageInstruction } = require('../server/utils/languageUtils.cjs');
const { DPICS_TO_TAG_MAP } = require('../server/utils/scoreConstants.cjs');

const SESSION_ID = 'ec167add-0b82-47a1-b259-ec9d9db1b855';
const MODELS = ['claude-sonnet-4-6', 'claude-haiku-4-5-20251001'];

function buildTagCounts(codingResults) {
  const tagCounts = {
    echo: 0, labeled_praise: 0, unlabeled_praise: 0, praise: 0,
    narration: 0, direct_command: 0, indirect_command: 0, command: 0,
    question: 0, criticism: 0, neutral: 0
  };
  for (const result of codingResults) {
    const code = result.code;
    if (code === 'RF' || code === 'RQ') tagCounts.echo++;
    else if (code === 'LP') { tagCounts.labeled_praise++; tagCounts.praise++; }
    else if (code === 'UP') tagCounts.unlabeled_praise++;
    else if (code === 'BD') tagCounts.narration++;
    else if (code === 'DC') { tagCounts.direct_command++; tagCounts.command++; }
    else if (code === 'IC') { tagCounts.indirect_command++; tagCounts.command++; }
    else if (code === 'Q') tagCounts.question++;
    else if (code === 'NTA') tagCounts.criticism++;
    else if (code === 'ID' || code === 'AK') tagCounts.neutral++;
  }
  return tagCounts;
}

function summarizeCodes(codingResults) {
  const counts = {};
  for (const r of codingResults) {
    counts[r.code] = (counts[r.code] || 0) + 1;
  }
  return counts;
}

async function runCoding(model, userPrompt, systemPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const start = Date.now();
  const { text, usage } = await anthropicCall(apiKey, model, {
    prompt: userPrompt,
    systemPrompt,
    maxTokens: 8192,
    temperature: 0,
    timeout: 120_000,
  });
  const latencyMs = Date.now() - start;
  const { value } = parseJSON(text, 'array');
  return { codingResults: value, usage, latencyMs };
}

async function main() {
  console.log(`\n=== PCIT Coding Comparison: ${SESSION_ID} ===\n`);

  // Fetch session
  const session = await prisma.session.findUnique({
    where: { id: SESSION_ID },
    select: {
      id: true, mode: true, elevenLabsJson: true,
      roleIdDone: true, roleIdentificationJson: true,
      pcitCodingDone: true
    }
  });
  if (!session) throw new Error(`Session ${SESSION_ID} not found`);

  console.log(`Mode: ${session.mode}`);
  console.log(`Role ID done: ${session.roleIdDone}, PCIT coding done: ${session.pcitCodingDone}`);

  const isCDI = session.mode === 'CDI';
  const primaryLanguage = session.elevenLabsJson?.language_code || null;
  if (primaryLanguage) console.log(`Language: ${primaryLanguage}`);

  // Get utterances with roles
  const utterancesWithRoles = await prisma.utterance.findMany({
    where: { sessionId: SESSION_ID },
    orderBy: { order: 'asc' }
  });
  console.log(`Utterances: ${utterancesWithRoles.length}`);

  const adultUtterances = utterancesWithRoles.filter(u => u.role === 'adult' || u.role === 'ADULT');
  console.log(`Adult utterances: ${adultUtterances.length}`);

  // Build system prompt
  const dpicsSystemPrompt = loadPrompt('dpicsCoding') + (!isCDI ? `

**PDI SESSION — Feedback Override for Commands:**
This is a PDI (Parent-Directed Interaction) session. The rules above apply for coding, but the feedback generation strategy for commands is different:
- **DC (Direct Command)**: DC is a TARGET SKILL in PDI. Do NOT suggest replacing it with a PRIDE skill. Instead, briefly reinforce it or coach on quality (e.g. was it direct, specific, calm, positively phrased?).
- **IC (Indirect Command)**: Still undesirable. Coach toward a DC instead (e.g. "Try stating it directly: 'Please put the block down.'"). Do NOT suggest using BD or LP.
All other feedback rules remain the same.` : '');

  // Prepare utterances data
  const utterancesData = utterancesWithRoles.map((utt, idx) => ({
    id: idx,
    role: utt.role,
    text: utt.text
  }));

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
- Every parent segment MUST have both "code" and "feedback" fields${primaryLanguage && primaryLanguage !== 'eng' ? `\n- Always keep "code" values as English DPICS codes (e.g. LP, BD, RF). Write the "feedback" field in ${getLanguageInstruction(primaryLanguage).replace('Write your entire response in ', '').replace('.', '')}.` : ''}`;

  const results = {};

  for (const model of MODELS) {
    console.log(`\n--- Running ${model} ---`);
    try {
      const { codingResults, usage, latencyMs } = await runCoding(model, userPrompt, dpicsSystemPrompt);
      results[model] = { codingResults, usage, latencyMs };
      console.log(`✅ Got ${codingResults.length} coded utterances in ${(latencyMs/1000).toFixed(1)}s`);
      console.log(`   Tokens: ${usage?.inputTokens ?? '?'} in / ${usage?.outputTokens ?? '?'} out`);
      console.log(`   Code distribution:`, summarizeCodes(codingResults));
      console.log(`   Tag counts:`, buildTagCounts(codingResults));
    } catch (err) {
      console.error(`❌ ${model} failed: ${err.message}`);
      results[model] = { error: err.message };
    }
  }

  // Comparison
  const [modelA, modelB] = MODELS;
  if (results[modelA]?.codingResults && results[modelB]?.codingResults) {
    const a = results[modelA].codingResults;
    const b = results[modelB].codingResults;

    // Build id-keyed maps for reliable lookup
    const mapA = Object.fromEntries(a.map(r => [r.id, r]));
    const mapB = Object.fromEntries(b.map(r => [r.id, r]));
    const allIds = [...new Set([...a.map(r => r.id), ...b.map(r => r.id)])].sort((x, y) => x - y);

    let diffCount = 0;
    const diffs = [];
    for (const id of allIds) {
      const ra = mapA[id], rb = mapB[id];
      if (!ra || !rb || ra.code !== rb.code) {
        diffCount++;
        diffs.push({ id, ra, rb });
      }
    }

    console.log(`\n=== COMPARISON SUMMARY ===`);
    console.log(`Sonnet coded ${a.length} items, Haiku coded ${b.length} items`);
    console.log(`Code mismatches: ${diffCount}/${allIds.length} (${((diffCount/allIds.length)*100).toFixed(1)}%)`);

    const tagA = buildTagCounts(a);
    const tagB = buildTagCounts(b);
    console.log(`\nTag count diff (Sonnet vs Haiku):`);
    for (const key of Object.keys(tagA)) {
      const diff = tagA[key] - tagB[key];
      if (diff !== 0) console.log(`  ${key}: ${tagA[key]} vs ${tagB[key]} (diff: ${diff > 0 ? '+' : ''}${diff})`);
    }

    // Full side-by-side: all utterances
    console.log(`\n=== FULL SIDE-BY-SIDE (all ${allIds.length} parent utterances) ===`);
    for (const id of allIds) {
      const ra = mapA[id], rb = mapB[id];
      const text = utterancesData[id]?.text || '';
      const codeDiff = (!ra || !rb || ra.code !== rb.code) ? ' *** CODE MISMATCH' : '';
      console.log(`\n[id=${id}]${codeDiff}`);
      console.log(`  text:    "${text}"`);
      console.log(`  sonnet:  [${ra?.code ?? 'MISSING'}] ${ra?.feedback ?? ''}`);
      console.log(`  haiku:   [${rb?.code ?? 'MISSING'}] ${rb?.feedback ?? ''}`);
    }
  }

  await prisma.$disconnect();
  console.log('\nDone. No database writes performed.');
}

main().catch(e => {
  console.error('Fatal:', e);
  prisma.$disconnect();
  process.exit(1);
});
