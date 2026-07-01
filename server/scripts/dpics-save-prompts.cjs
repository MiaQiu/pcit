'use strict';
/**
 * Save the exact user-message prompts that would be sent to DeepSeek (--embed-manual mode)
 * for all 6 eval sessions, without making any API calls.
 *
 * Usage: node server/scripts/dpics-save-prompts.cjs
 * Output: prompts/deepseek/session-{N}-system.txt  (manual + appendix)
 *         prompts/deepseek/session-{N}-user.txt    (v10 rules + utterances)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const prisma = require('../services/db.cjs');
const { loadPrompt }    = require('../prompts/index.cjs');
const { getUtterances } = require('../utils/utteranceUtils.cjs');

const DPICS_PDF_PATH      = path.join(__dirname, '../assets/Manual_for_the_Dyadic_Parent-Child_Interaction_Cod.pdf');
const DPICS_APPENDIX_PATH = path.join(__dirname, '../assets/appendix A - words_sufficiently_positive.json');
const SESSIONS_MAP        = path.join(__dirname, '../../eval-results/dpics/sessions.json');
const OUT_DIR             = path.resolve(__dirname, '../../prompts/deepseek');
const PROMPT_NAME         = 'dpicsCoding-agentic-v10';

async function main() {
  const sessionMap = JSON.parse(fs.readFileSync(SESSIONS_MAP, 'utf8'));
  const sessionLabels = Object.keys(sessionMap).sort();

  const baseRules   = loadPrompt(PROMPT_NAME);
  const manualTxt   = fs.readFileSync(DPICS_PDF_PATH.replace(/\.pdf$/i, '.txt'), 'utf8');
  const appendixRaw = fs.readFileSync(DPICS_APPENDIX_PATH, 'utf8');

  const systemMessage = `## DPICS Manual (Reference)\n\n${manualTxt}\n\n---\n\n## Appendix A — Sufficiently Positive Words\n\n${appendixRaw}`;
  const rulesPrefix   = `${baseRules}\n\n---\n\n`;

  // System message is identical for all sessions — save once
  fs.writeFileSync(path.join(OUT_DIR, 'system.txt'), systemMessage);
  console.log(`system.txt  ${(systemMessage.length / 1000).toFixed(0)}K chars`);

  for (const label of sessionLabels) {
    const sessionId  = sessionMap[label];
    const utterances = await getUtterances(sessionId);

    const utterancesData = utterances.map((utt, idx) => ({
      id:   idx,
      role: utt.role,
      text: utt.text,
    }));

    const nonce      = crypto.randomUUID();
    const userMessage = `${rulesPrefix}[nonce:${nonce}]\nCode every utterance where role is "adult". Skip all "child" entries.

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

    const outFile = path.join(OUT_DIR, `${label}-user.txt`);
    fs.writeFileSync(outFile, userMessage);
    console.log(`${label}-user.txt  ${(userMessage.length / 1000).toFixed(0)}K chars  (${utterancesData.filter(u => u.role === 'adult').length} adult utts)`);
  }

  await prisma.$disconnect();
  console.log('\nDone. Files written to prompts/deepseek/');
}

main().catch(e => { console.error(e); process.exit(1); });
