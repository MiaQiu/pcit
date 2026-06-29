'use strict';
/**
 * Pre-annotation: coreference resolution & implicit subject/object enrichment
 * using Gemini Flash. Processes 1.json–6.json → 1_anno.json–6_anno.json.
 *
 * Usage: node server/scripts/dpics-enrich.cjs
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { llmCall } = require('../llm/gateway.cjs');

const JSON_DIR = path.join(__dirname, 'cdi sessions/json');

const SYSTEM_PROMPT = `你是中文親子互動逐字稿的前處理專家，專門進行「共指消解與隱含資訊顯性化 (Coreference Resolution & Pre-Annotation)」。

任務：根據對話上下文，將每句話中省略的主語、模糊代名詞、省略受詞補充完整，幫助後續的 DPICS 編碼系統正確辨識話語結構。

規則：
1. **省略主語** → 在句首以括號補上，例如：「放好了。」→「（你）放好了。」
2. **模糊代名詞**（這個/那個/它/他/她）→ 替換為實際名詞，以括號標示，例如：「把它放這裡。」→「把（積木）放這裡。」
3. **省略受詞** → 若可從上下文確定推斷，以括號補上，例如：「放在這裡就好了。」→「（你）（把積木）放在這裡就好了。」
4. 僅補充**可從對話脈絡確定推斷**的資訊，不確定則保留原文
5. 保留原句所有文字，只在適當位置插入括號
6. child 和 adult 的話語都要處理`;

function getVerbalization(u) {
  return u.verbalization || u.text || '';
}

async function enrichSession(filename) {
  const filepath = path.join(JSON_DIR, filename);
  const data     = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const session  = data.sessions[0];

  const input = session.utterances.map((u, i) => ({
    id:           i,
    role:         u.role,
    verbalization: getVerbalization(u),
  }));

  const nonce      = crypto.randomUUID();
  const userPrompt = `[nonce:${nonce}]
以下是一段親子互動逐字稿，請對每句話進行共指消解與隱含資訊顯性化處理。

${JSON.stringify(input, null, 2)}

輸出格式：只輸出 JSON array，每個元素只有 "id" 和 "enriched" 兩個欄位。不輸出任何其他文字、說明或 markdown。第一個字必須是 [，最後一個字必須是 ]。`;

  console.log(`  [${filename}] Calling Flash (${input.length} utterances)...`);
  const results = await llmCall(userPrompt, {
    profile:    'pcit-coding',
    label:      'dpics-enrich',
    model:      'gemini-3.5-flash',
    systemPrompt: SYSTEM_PROMPT,
  });

  if (!Array.isArray(results)) throw new Error(`[${filename}] Non-array response: ${JSON.stringify(results).slice(0, 200)}`);

  const enrichedById = Object.fromEntries(results.map(r => [r.id, r.enriched]));
  const outData = {
    ...data,
    sessions: [{
      ...session,
      utterances: session.utterances.map((u, i) => ({
        ...u,
        enriched: enrichedById[i] ?? getVerbalization(u),
      })),
    }],
  };

  const outFilename = filename.replace('.json', '_anno.json');
  fs.writeFileSync(path.join(JSON_DIR, outFilename), JSON.stringify(outData, null, 2));
  console.log(`  ✅ [${filename}] → ${outFilename} (${results.length}/${input.length} enriched)`);
}

async function main() {
  const files = ['1.json', '2.json', '3.json', '4.json', '5.json', '6.json'];
  console.log(`Enriching ${files.length} sessions in parallel with Gemini Flash...`);
  await Promise.all(files.map(enrichSession));
  console.log('\nAll sessions enriched.');
}

main().catch(e => { console.error(e); process.exit(1); });
