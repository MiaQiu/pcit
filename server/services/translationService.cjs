'use strict';

const { llmTextCall } = require('./claudeService.cjs');
const { parseJSON } = require('../llm/repair.cjs');

const LOCALE_NAMES = {
  'zh-TW': 'Traditional Chinese (Taiwan)',
};

const SYSTEM_PROMPT = `You are a professional translator specializing in parenting education content.
When translating:
- Preserve all HTML tags, attributes, and structure exactly
- Keep clinical/program terms untranslated: PCIT, CDI, PDI, PRIDE
- Keep variable placeholders untranslated (e.g. {{name}})
- Return ONLY valid JSON matching the input structure exactly, no extra commentary`;

/**
 * Translate a full lesson bundle (lesson fields + segments + quiz) in one API call.
 *
 * @param {Object} bundle - { lesson, segments, quiz }
 * @param {string} targetLocale - BCP 47 locale, e.g. 'zh-TW'
 * @returns {Promise<Object>} Translated bundle with same structure
 */
async function translateLessonBundle(bundle, targetLocale) {
  const localeName = LOCALE_NAMES[targetLocale];
  if (!localeName) throw new Error(`Unsupported translation locale: ${targetLocale}`);

  const prompt = `Translate the following lesson content from English to ${localeName}.

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

module.exports = { translateLessonBundle, LOCALE_NAMES };
