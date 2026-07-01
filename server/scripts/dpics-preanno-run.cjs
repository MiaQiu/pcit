'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const { llmCall }    = require('/Users/yihui/Project/pcit/server/llm/gateway.cjs');
const { loadPrompt } = require('/Users/yihui/Project/pcit/server/prompts/index.cjs');

const INPUT  = '/Users/yihui/Project/pcit/server/scripts/cdi sessions/json/6  Pre-Anno.json';
const PROMPT = 'dpicsCoding-agentic-v10';
const MODEL  = 'gemini-3.1-pro-preview';
const PDF    = process.env.DPICS_PDF_PATH || '/Users/yihui/Project/pcit/server/assets/Manual_for_the_Dyadic_Parent-Child_Interaction_Cod.pdf';
const APPENDIX = '/Users/yihui/Project/pcit/server/assets/appendix A - words_sufficiently_positive.json';

async function main() {
  const raw  = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
  const sess = raw.sessions[0];
  console.log('Session:', sess.label, '| utterances:', sess.utterances.length);

  const utterancesData = sess.utterances.map((u, i) => ({
    id:   i,
    role: u.role === 'adult' ? 'adult' : 'child',
    text: u.verbalization,
  }));

  const systemPrompt = loadPrompt(PROMPT);
  const promptHash   = crypto.createHash('sha256').update(systemPrompt).digest('hex').slice(0, 8);
  console.log('Prompt:', PROMPT, '| hash:', promptHash);

  const nonce = crypto.randomUUID();
  const userPrompt = `[nonce:${nonce}]\nCode every utterance where role is "adult". Skip all "child" entries.

${JSON.stringify(utterancesData, null, 2)}

Return a minified JSON array for adult utterances only:
[{"id": <int>, "subject": <string>, "reasoning": <string>, "code": <string>}, ...]
- "subject": who or what the utterance is primarily about — choose the most specific applicable label:
  "兒童" (the child), "物品/玩具" (an object or toy), "家長自身" (the parent themselves), "遊戲角色" (a pretend/play character), "第三方" (another person not the child), "不明" (unclear)
- "reasoning": one sentence naming the decisive feature or rule that determines the code (e.g. "肯定句 + 描述兒童當下動作 → BD" or "呼應兒童剛才說的話 → RF 優先於 BD")
- "code": the single DPICS code
- Return ONLY the JSON array — no text, no markdown, no code fences
- First character MUST be [, last character MUST be ]
- Every adult entry MUST have "id", "subject", "reasoning", and "code"`;

  const modelKeyTag = MODEL.replace(/[^a-zA-Z0-9_-]/g, '_');
  const results = await llmCall(userPrompt, {
    profile: 'pcit-coding',
    label:   'dpics-preanno',
    model:   MODEL,
    _geminiConfig: { seed: 42 },
    cache: {
      key:         `dpics-preanno-${PROMPT}-${promptHash}-new-${modelKeyTag}`,
      primaryFile: PDF,
      systemPrompt,
      extraFiles:  [{ path: APPENDIX, mimeType: 'application/json' }],
    },
  });

  if (!Array.isArray(results)) throw new Error('Unexpected response: ' + JSON.stringify(results).slice(0, 200));

  // Merge predictions back onto utterances
  const byId = Object.fromEntries(results.map(r => [r.id, r]));
  const output = utterancesData.map(u => {
    const pred = byId[u.id];
    return { ...u, subject: pred?.subject ?? null, code: pred?.code ?? null };
  });

  const adultCoded = output.filter(u => u.role === 'adult');
  console.log(`Coded ${adultCoded.length}/${utterancesData.filter(u=>u.role==='adult').length} adult utterances`);
  adultCoded.forEach(u => console.log(`  [${u.subject ?? '?'}] ${u.text} → ${u.code}`));

  const outPath = path.join(
    '/Users/yihui/Project/pcit/eval-results/dpics',
    `preanno-s6__${MODEL.replace(/[^a-zA-Z0-9_-]/g,'_')}__${PROMPT}-${promptHash}__${new Date().toISOString().replace(/[:.]/g,'-')}.json`
  );
  fs.writeFileSync(outPath, JSON.stringify({ label: sess.label, model: MODEL, prompt: PROMPT, promptHash, utterances: output }, null, 2));
  console.log('\nResult written to', outPath);
}

main().catch(e => { console.error(e); process.exit(1); });
