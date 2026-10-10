'use strict';

/**
 * One-off: re-run ONLY the cdiCoachingFormat pass (generateCdiCoaching step 3 —
 * the Coach's Corner structuring that produces didWell / growthFocus / wordBank)
 * for one existing session, from its stored session.coachingSummary. Does not
 * regenerate the coaching narrative itself.
 *
 * Read-only by default. Pass --write to replace coachingCards.part1 with the
 * new structured breakdown; every other coachingCards key (part2, goalDirective,
 * notifications, tomorrowGoal, …) is left untouched.
 *
 * Usage:
 *   node server/scripts/run-coaching-format.cjs <sessionId> [--write]
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const prisma = require('../services/db.cjs');
const { llmCall } = require('../llm/gateway.cjs');
const SCHEMAS = require('../llm/schemas/index.cjs');
const { loadPromptWithVariables } = require('../prompts/index.cjs');
const { getUtterances, SILENT_SPEAKER_ID } = require('../utils/utteranceUtils.cjs');
const { decryptSensitiveData } = require('../utils/encryption.cjs');
const { getLanguageInstruction } = require('../utils/languageUtils.cjs');

const formatGender = (g) => ({ BOY: 'boy', GIRL: 'girl', OTHER: 'child' }[g] || 'child');

// Mirrors pcitAnalysisService.cjs childNameDirective / formatUtterancesForPsychologist
// (not exported).
function childNameDirective(childName) {
  const name = (childName && childName !== 'the child') ? String(childName).trim() : '';
  if (!name) return '';
  return `CHILD'S NAME — REQUIRED: Always call the child "${name}" in your output. `
    + `The parent may address the child differently in the transcript — a nickname, pet name, `
    + `term of endearment, initials, or a role word ("buddy", "sweetie", "宝宝", "哥哥", "妹妹"). `
    + `Ignore those and use "${name}" every time you refer to the child by name. Do not invent a `
    + `different name and do not repeat the parent's nickname. This applies in every language.`;
}
const formatTranscript = (utterances) => utterances
  .filter(u => u.speaker !== SILENT_SPEAKER_ID)
  .map(u => `${u.role === 'adult' ? 'Parent' : u.role === 'child' ? 'Child' : u.speaker}: ${u.text}`)
  .join('\n');

const sessionId = process.argv[2];
const DO_WRITE = process.argv.includes('--write');
if (!sessionId) { console.error('Usage: node server/scripts/run-coaching-format.cjs <sessionId> [--write]'); process.exit(1); }

(async () => {
  const session = await prisma.session.findUnique({ where: { id: sessionId }, include: { User: true } });
  if (!session) throw new Error(`Session ${sessionId} not found`);
  if (!session.coachingSummary) throw new Error('Session has no coachingSummary to format');

  const user = session.User;
  const childName = user?.childName ? decryptSensitiveData(user.childName) : 'the child';
  const childGender = user?.childGender ? formatGender(user.childGender) : 'child';
  const primaryLanguage = session.elevenLabsJson?.language_code || null;
  const utterances = await getUtterances(sessionId);

  console.log(`Session: ${sessionId} · mode ${session.mode} · child ${childName} (${childGender}) · lang ${primaryLanguage || '(none)'}`);
  console.log(`coachingSummary: ${session.coachingSummary.length} chars · write: ${DO_WRITE}`);

  const directive = childNameDirective(childName);
  const formatPrompt = loadPromptWithVariables('cdiCoachingFormat', {
    COACHING_REPORT:      session.coachingSummary,
    TRANSCRIPT:           formatTranscript(utterances),
    CHILD_NAME:           childName,
    CHILD_GENDER:         childGender,
    LANGUAGE_INSTRUCTION: getLanguageInstruction(primaryLanguage),
  });
  const formatted = await llmCall(directive ? `${formatPrompt}\n\n${directive}` : formatPrompt, {
    profile:        'coaching-format',
    schema:         SCHEMAS.COACHING_FORMAT,
    label:          'coaching-format-rerun',
    sessionId,
    alertOnFailure: false,
  });

  // Same mapping + acceptance check as generateCdiCoaching step 3.
  const cc = formatted?.coach_corner;
  if (!(cc && typeof cc === 'object' && cc.did_well && cc.growth_focus)) {
    throw new Error('Format pass returned no did_well/growth_focus — not writing');
  }
  const part1 = {
    didWell: {
      theme:      cc.did_well.theme || '',
      howItHelps: cc.did_well.how_it_helps || '',
      examples: Array.isArray(cc.did_well.examples)
        ? cc.did_well.examples.map(e => ({ quote: e.quote || '', benefit: e.benefit || '' }))
        : [],
    },
    growthFocus: {
      heading:       cc.growth_focus?.heading || '',
      newSkillIntro: cc.growth_focus?.new_skill_intro || null,
      gap:           cc.growth_focus?.gap || '',
      benchmark:     cc.growth_focus?.benchmark || '',
      strategy:      cc.growth_focus?.strategy || '',
    },
    wordBank: Array.isArray(cc.word_bank)
      ? cc.word_bank.map(g => ({
          goal: g.goal || '',
          categories: Array.isArray(g.categories)
            ? g.categories.map(c => ({
                name:     c.name || '',
                examples: Array.isArray(c.examples) ? c.examples.filter(Boolean) : [],
              }))
            : [],
        }))
      : [],
  };

  console.log('\n=== OLD part1.growthFocus ===\n' + JSON.stringify(session.coachingCards?.part1?.growthFocus ?? null, null, 2));
  console.log('\n=== NEW part1 ===\n' + JSON.stringify(part1, null, 2));

  // --require-grouped: skip the write when the formatter echoed each category
  // name as its own goal heading (write-ups with no primary-goal heading).
  const ungrouped = part1.wordBank.some(g => g.categories.some(c => c.name === g.goal));
  if (DO_WRITE && process.argv.includes('--require-grouped') && ungrouped) {
    console.log('\n⚠️  word bank goal headings duplicate category names — not writing');
    process.exitCode = 2;
    return;
  }

  if (DO_WRITE) {
    const coachingCards = { ...(session.coachingCards || {}), part1 };
    await prisma.session.update({ where: { id: sessionId }, data: { coachingCards } });
    console.log(`\n✅ WROTE coachingCards.part1 for session ${sessionId}`);
  } else {
    console.log('\n(dry run — pass --write to persist)');
  }
})()
  .catch(e => { console.error('❌', e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
