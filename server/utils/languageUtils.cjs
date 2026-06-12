/**
 * Language utilities for multilingual report generation
 * Maps ElevenLabs ISO 639-3 language codes to human-readable names
 * used in LLM prompt instructions.
 */

const LANGUAGE_NAMES = {
  // Excellent Accuracy (≤5% WER)
  bel: 'Belarusian',
  bos: 'Bosnian',
  bul: 'Bulgarian',
  cat: 'Catalan',
  hrv: 'Croatian',
  ces: 'Czech',
  dan: 'Danish',
  nld: 'Dutch',
  eng: 'English',
  est: 'Estonian',
  fin: 'Finnish',
  fra: 'French',
  glg: 'Galician',
  deu: 'German',
  ell: 'Greek',
  hun: 'Hungarian',
  isl: 'Icelandic',
  ind: 'Indonesian',
  ita: 'Italian',
  jpn: 'Japanese',
  kan: 'Kannada',
  lav: 'Latvian',
  mkd: 'Macedonian',
  msa: 'Malay',
  mal: 'Malayalam',
  nor: 'Norwegian',
  pol: 'Polish',
  por: 'Portuguese',
  ron: 'Romanian',
  rus: 'Russian',
  slk: 'Slovak',
  spa: 'Spanish',
  swe: 'Swedish',
  tur: 'Turkish',
  ukr: 'Ukrainian',
  vie: 'Vietnamese',
  // High Accuracy (>5% to ≤10% WER)
  hye: 'Armenian',
  aze: 'Azerbaijani',
  ben: 'Bengali',
  yue: 'Cantonese',
  fil: 'Filipino',
  kat: 'Georgian',
  guj: 'Gujarati',
  hin: 'Hindi',
  kaz: 'Kazakh',
  lit: 'Lithuanian',
  mlt: 'Maltese',
  cmn: 'Mandarin Chinese',
  zho: 'Mandarin Chinese',  // ISO 639-3 macrolanguage code used by ElevenLabs
  'zh-TW': 'Traditional Chinese',
  mar: 'Marathi',
  nep: 'Nepali',
  ori: 'Odia',
  fas: 'Persian',
  srp: 'Serbian',
  slv: 'Slovenian',
  swa: 'Swahili',
  tam: 'Tamil',
  tel: 'Telugu',
};

/**
 * Returns a language instruction string to append to LLM prompts.
 * Returns empty string for English or unknown codes (safe default — prompts already produce English).
 *
 * @param {string|null|undefined} languageCode - ISO 639-3 code from ElevenLabs (e.g. "cmn", "fra")
 * @returns {string} Instruction string, e.g. "Write your entire response in Mandarin Chinese." or ""
 */
function getLanguageInstruction(languageCode) {
  if (!languageCode || languageCode === 'eng') return '';
  const name = LANGUAGE_NAMES[languageCode];
  if (!name) return '';
  let instruction = `Write your entire response in ${name}.`;
  if (languageCode === 'zh-TW') {
    instruction += ' Use these official skill name translations: Echo → 回應, Narrate/Narration → 行為描述, Labeled Praise → 具體讚美.';
  }
  return instruction;
}

module.exports = { getLanguageInstruction };
