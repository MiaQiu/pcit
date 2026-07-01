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
async function geminiCall(apiKey, model, body, { timeout = 60_000, cachedContent = null } = {}) {
  const url        = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeout);
  const fullBody   = cachedContent ? { cachedContent, ...body } : body;

  let response;
  try {
    response = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fullBody),
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
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text;

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

/**
 * Single Gemini streamGenerateContent call (SSE) with per-call timeout.
 * Keeps the connection alive during long silent-reasoning phases.
 *
 * @param {string} apiKey
 * @param {string} model       - Full model ID e.g. 'gemini-3-flash-preview'
 * @param {Object} body        - Full request body (contents, generationConfig, etc.)
 * @param {Object} [opts]
 * @param {number} [opts.timeout=60000] - AbortController timeout in ms
 * @returns {Promise<{ text: string, usage: { inputTokens: null, outputTokens: null } }>}
 */
async function geminiStreamCall(apiKey, model, body, { timeout = 60_000, cachedContent = null } = {}) {
  const url        = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeout);
  const fullBody   = cachedContent ? { cachedContent, ...body } : body;

  let response;
  try {
    response = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fullBody),
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

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer   = '';
  let usageMetadata = null;

  const consumeLine = (line) => {
    if (!line.startsWith('data: ')) return;
    const jsonStr = line.slice(6).trim();
    if (!jsonStr || jsonStr === '[DONE]') return;
    try {
      const data = JSON.parse(jsonStr);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) fullText += text;
      // Gemini sends usageMetadata on each chunk (cumulative); the last chunk has the final counts.
      if (data.usageMetadata) usageMetadata = data.usageMetadata;
    } catch (_) {}
  };

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) consumeLine(line);
  }
  consumeLine(buffer);

  if (!fullText) {
    const err     = new Error('Empty response from Gemini streaming API');
    err.retryable = true;
    throw err;
  }

  const usage = {
    inputTokens:  usageMetadata?.promptTokenCount     ?? null,
    outputTokens: usageMetadata?.candidatesTokenCount ?? null,
  };
  if (usageMetadata?.thoughtsTokenCount != null) {
    usage.outputTokens = (usage.outputTokens ?? 0) + usageMetadata.thoughtsTokenCount;
    usage.thinkingTokens = usageMetadata.thoughtsTokenCount;
  }

  return { text: fullText, usage };
}

module.exports = { geminiCall, geminiStreamCall };
