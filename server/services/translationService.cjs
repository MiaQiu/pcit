'use strict';

const { llmTextCall } = require('./claudeService.cjs');
const { parseJSON } = require('../llm/repair.cjs');

const LOCALE_NAMES = {
  'zh-TW': 'Traditional Chinese (Taiwan)',
  'zh-CN': 'Simplified Chinese (Mainland China)',
};

const SYSTEM_PROMPT = `You are a professional translator specializing in parenting education content.
When translating:
- Preserve all HTML tags, attributes, and structure exactly
- Keep clinical/program terms untranslated: PCIT, CDI, PDI, PRIDE
- Keep variable placeholders untranslated (e.g. {{name}})
- Your output is parsed as JSON, so inside translated text NEVER use the ASCII
  straight double-quote character (") as an in-text quotation mark — it will
  break the surrounding JSON string. Use full-width quotation marks instead
  (「」 or “ ”) for both zh-TW and zh-CN. If you must include a literal ASCII
  double quote, escape it as \\" per JSON string rules.
- Return ONLY valid JSON matching the input structure exactly, no extra commentary`;

/**
 * Translate an arbitrary JSON content bundle from English to `targetLocale`
 * in one API call. Shared by translateLessonBundle/translateHomeCardBundle —
 * the prompt only needs to know the source is parenting-education copy, not
 * which model it came from.
 *
 * @param {Object} bundle - arbitrary JSON-serializable content
 * @param {string} targetLocale - BCP 47 locale, e.g. 'zh-TW'
 * @returns {Promise<Object>} Translated bundle with the same structure
 */
async function translateBundle(bundle, targetLocale) {
  const localeName = LOCALE_NAMES[targetLocale];
  if (!localeName) throw new Error(`Unsupported translation locale: ${targetLocale}`);

  const prompt = `Translate the following content from English to ${localeName}.

${JSON.stringify(bundle, null, 2)}`;

  const text = await llmTextCall(prompt, {
    systemPrompt: SYSTEM_PROMPT,
    model: 'claude-opus-4-7',
    maxTokens: 16000,
    temperature: null,
    timeout: 300_000, // 5 minutes — large customHtml lessons can be slow
  });

  const { value } = parseJSON(text, 'object');
  return value;
}

/**
 * Translate a full lesson bundle (lesson fields + segments + quiz) in one API call.
 * @param {Object} bundle - { lesson, segments, quiz }
 * @param {string} targetLocale - BCP 47 locale, e.g. 'zh-TW'
 */
async function translateLessonBundle(bundle, targetLocale) {
  return translateBundle(bundle, targetLocale);
}

/**
 * Translate a home card bundle (card fields + detail-page components) in one API call.
 * @param {Object} bundle - { card, components }
 * @param {string} targetLocale - BCP 47 locale, e.g. 'zh-TW'
 */
async function translateHomeCardBundle(bundle, targetLocale) {
  return translateBundle(bundle, targetLocale);
}

module.exports = { translateLessonBundle, translateHomeCardBundle, LOCALE_NAMES };
