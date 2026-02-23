'use strict';

const { jsonrepair } = require('jsonrepair');

/**
 * Parse JSON from a model response with automatic repair fallback.
 *
 * Steps:
 * 1. Strip markdown fences, extract JSON substring.
 * 2. JSON.parse directly.
 * 3. On failure: jsonrepair (handles truncation, trailing commas, missing brackets).
 * 4. Throw with context if both attempts fail.
 *
 * @param {string}           text - Raw model response
 * @param {'object'|'array'} type - Expected root type
 * @returns {{ value: Object|Array, repaired: boolean }}
 */
function parseJSON(text, type = 'object') {
  let clean = text
    .trim()
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  const open  = type === 'array' ? '[' : '{';
  const close = type === 'array' ? ']' : '}';
  const first = clean.indexOf(open);
  const last  = clean.lastIndexOf(close);

  if (first !== -1 && last !== -1 && last > first) {
    clean = clean.substring(first, last + 1);
  }

  try {
    return { value: JSON.parse(clean), repaired: false };
  } catch (err) {
    try {
      const result = JSON.parse(jsonrepair(clean));
      return { value: result, repaired: true };
    } catch (_) {
      throw new Error(
        `JSON parse failed (repair also failed): ${err.message} — snippet: ${clean.substring(0, 120)}`
      );
    }
  }
}

module.exports = { parseJSON };
