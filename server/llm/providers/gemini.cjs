'use strict';

const fetch = require('node-fetch');

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

/**
 * Single Gemini generateContent call with per-call timeout.
 *
 * @param {string} apiKey
 * @param {string} model       - Full model ID e.g. 'gemini-2.0-flash'
 * @param {Object} body        - Full request body (contents, generationConfig, etc.)
 * @param {Object} [opts]
 * @param {number} [opts.timeout=60000] - AbortController timeout in ms
 * @returns {Promise<{ text: string, usage: { inputTokens: number|null, outputTokens: number|null } }>}
 */
async function geminiCall(apiKey, model, body, { timeout = 60_000 } = {}) {
  const url        = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    const err       = new Error(`Gemini API error ${response.status}: ${errorText.substring(0, 200)}`);
    err.status      = response.status;
    err.retryable   = RETRYABLE_STATUSES.has(response.status);
    throw err;
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    const err     = new Error('Empty response from Gemini API');
    err.retryable = true;
    throw err;
  }

  const usage = {
    inputTokens:  data.usageMetadata?.promptTokenCount     ?? null,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
  };

  return { text, usage };
}

module.exports = { geminiCall };
