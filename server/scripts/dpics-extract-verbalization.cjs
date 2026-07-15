'use strict';
/**
 * Extracts clean verbalization from annotated text fields in CDI session JSONs
 * that lack a separate verbalization field.
 *
 * The text field contains mixed content: actual speech + parenthetical observations
 * + coaching suggestions in 【...】 + timing markers + "not counted" notes.
 * This script uses Gemini Flash to extract only what was actually spoken.
 *
 * Usage: node server/scripts/dpics-extract-verbalization.cjs [dir] [file1,file2,...]
 *   dir              defaults to server/scripts/cdi sessions/json
 *   file1,file2,...  defaults to 4.json,5.json (the original files lacking verbalization)
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { llmCall } = require('../llm/gateway.cjs');

const JSON_DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, 'cdi sessions/json');

const SYSTEM_PROMPT = `你是中文親子互動逐字稿的前處理專家。

任務：從包含混合內容的逐字稿文本中，提取出**純粹的語言內容（verbalization）**，即說話者實際說出口的話。

需要移除的非語言內容：
1. 行為觀察：「（個案拿著玩具）」「（個案回答後）」「（案母看著孩子）」等括號內的行為描述
2. 編碼指引：「【建議案母...】」等方括號建議
3. 時間標記：「（<2s）」「（<1s，接下句）」等時間戳
4. 研究備註：「（回應成問句）」「（案母語句未完成，故不予計數）」「（同時符合RF及BD，故記為RF）」等
5. 「不予計數」標記：含「不予計數」或「故不予計數」的括號 — 若整句話都是此類，verbalization 設為空字串 ""
6. 名字匿名代碼：「XX（個案名）」→ 保留「XX」即可

需要保留的內容：
1. 說話者實際說出的所有字詞
2. 自然停頓省略號「…」
3. 不完整的語句（即使語意未完成，只要是說出口的就保留）

輸出格式：只輸出 JSON array，每個元素有 "id" 和 "verbalization" 欄位。不輸出任何其他文字或 markdown。`;

async function extractVerbalization(filename) {
  const filepath = path.join(JSON_DIR, filename);
  const data     = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  const session  = data.sessions[0];

  // Only process utterances that lack a verbalization field
  const needsExtraction = session.utterances.filter(u => !u.verbalization);
  if (needsExtraction.length === 0) {
    console.log(`  [${filename}] Already has verbalization on all utterances — skipping`);
    return;
  }

  const input = session.utterances.map((u, i) => ({
    id:   i,
    role: u.role,
    text: u.text || '',
  }));

  const nonce      = crypto.randomUUID();
  const userPrompt = `[nonce:${nonce}]
以下是一段親子互動逐字稿，text 欄位包含混合內容（實際語言 + 觀察備註 + 建議 + 時間標記）。
請提取每一句話中說話者實際說出口的純語言內容，填入 verbalization 欄位。

${JSON.stringify(input, null, 2)}

輸出格式：只輸出 JSON array，每個元素只有 "id" 和 "verbalization" 欄位。第一個字必須是 [，最後一個字必須是 ]。`;

  console.log(`  [${filename}] Extracting verbalization from ${input.length} utterances...`);
  const results = await llmCall(userPrompt, {
    profile:      'pcit-coding',
    label:        'dpics-extract-verbalization',
    model:        'gemini-3.5-flash',
    systemPrompt: SYSTEM_PROMPT,
  });

  if (!Array.isArray(results)) throw new Error(`[${filename}] Non-array response: ${JSON.stringify(results).slice(0, 200)}`);

  const verbById = Object.fromEntries(results.map(r => [r.id, r.verbalization]));
  const updated = {
    ...data,
    sessions: [{
      ...session,
      utterances: session.utterances.map((u, i) => ({
        ...u,
        verbalization: u.verbalization ?? (verbById[i] ?? ''),
      })),
    }],
  };

  fs.writeFileSync(filepath, JSON.stringify(updated, null, 2));
  console.log(`  ✅ [${filename}] Added verbalization to ${results.length} utterances (saved in place)`);

  // Show a few examples
  results.slice(0, 5).forEach(r => {
    const orig = input.find(u => u.id === r.id);
    if (orig && orig.text !== r.verbalization) {
      console.log(`    [${orig.role}] text: ${orig.text.slice(0, 60)}`);
      console.log(`           verb: ${r.verbalization}`);
    }
  });
}

async function main() {
  const files = process.argv[3] ? process.argv[3].split(',') : ['4.json', '5.json'];
  console.log(`Extracting verbalization for ${files.length} sessions...`);
  await Promise.all(files.map(extractVerbalization));
  console.log('\nDone. Now re-run dpics-enrich.cjs for these sessions.');
}

main().catch(e => { console.error(e); process.exit(1); });
