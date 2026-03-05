'use strict';

const _PCIT_RE = /\bPCIT\b/gi;

/**
 * Recursively replace any occurrence of "PCIT" (case-insensitive) with "Nora"
 * in strings, arrays, and plain objects.
 */
function sanitizeOutput(value) {
  if (typeof value === 'string') return value.replace(_PCIT_RE, 'Nora');
  if (Array.isArray(value))     return value.map(sanitizeOutput);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeOutput(v);
    return out;
  }
  return value;
}

module.exports = { sanitizeOutput };
