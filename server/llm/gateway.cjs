'use strict';

/**
 * LLM Gateway — single entry point for all AI calls.
 *
 * Handles:
 *  - Model routing (Gemini Flash / Pro / Claude) via models registry
 *  - Primary → fallback model switching on failure
 *  - Per-call AbortController timeout
 *  - Structured output via Gemini responseSchema (prevents malformed JSON at token level)
 *  - JSON parsing with jsonrepair fallback (safety net for non-schema calls)
 *  - One LLM retry on JSON parse failure
 *  - Structured per-call logging (model used, latency, schema/repair/retry flags)
 */

const { resolveModel }  = require('./models.cjs');
const { geminiCall }    = require('./providers/gemini.cjs');
const { anthropicCall } = require('./providers/anthropic.cjs');
const { parseJSON }     = require('./repair.cjs');

function _defaultModelKey() {
  const env = process.env.AI_PROVIDER || 'gemini-flash';
  return env === 'claude-sonnet' ? 'claude' : 'flash';
}

/**
 * Make an LLM call through the gateway.
 *
 * @param {string} prompt
 * @param {Object} [options]
 * @param {string}  [options.model]         - Model key: 'flash' | 'claude' | 'pro' (default: env-driven)
 * @param {string}  [options.output]        - 'json' | 'array' | 'text' (default: 'json')
 * @param {number}  [options.maxTokens]     - Max output tokens (default: 2048)
 * @param {number}  [options.temperature]   - Sampling temperature (default: 0.7)
 * @param {string}  [options.systemPrompt]  - Optional system prompt
 * @param {number}  [options.timeout]       - Per-call timeout ms (default: 60000)
 * @param {string}  [options.label]         - Caller label for structured logging
 * @param {Object}  [options.schema]        - Gemini responseSchema (OpenAPI 3.0 subset).
 *                                            When provided, Gemini enforces valid JSON at the
 *                                            token level — eliminates malformed output upstream.
 *                                            Has no effect for Claude calls.
 * @param {Object}  [options._geminiConfig] - Escape hatch: merged into generationConfig for Gemini
 *                                            (e.g. { responseMimeType: 'application/json' })
 * @returns {Promise<Object|Array|string>}
 */
async function llmCall(prompt, options = {}) {
  const {
    model: modelKey  = _defaultModelKey(),
    output           = 'json',
    maxTokens        = 2048,
    temperature      = 0.7,
    systemPrompt     = null,
    timeout          = 60_000,
    label            = 'unknown',
    schema           = null,
    _geminiConfig    = {},
  } = options;

  const modelDef  = resolveModel(modelKey);
  const hasSchema = schema !== null && modelDef.provider === 'gemini';
  const start     = Date.now();
  let usedRetry   = false;

  // Merge schema into gemini config when provided
  const geminiConfig = hasSchema
    ? { ..._geminiConfig, responseMimeType: 'application/json', responseSchema: schema }
    : _geminiConfig;

  try {
    const text = modelDef.provider === 'gemini'
      ? await _geminiWithFallback(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig, label)
      : await _claudeCall(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout);

    if (output === 'text') return text;

    const type = output === 'array' ? 'array' : 'object';

    // When schema is active Gemini guarantees valid JSON — parse directly.
    // For non-schema calls (Claude, fallback) jsonrepair is still applied inside parseJSON.
    try {
      return parseJSON(text, type);
    } catch (parseErr) {
      // Schema should prevent this; if it still happens retry once
      usedRetry = true;
      console.warn(`[gateway:${label}] JSON parse failed${hasSchema ? ' (schema was active — unexpected)' : ''}, retrying... (${parseErr.message.substring(0, 80)})`);
      const retryText = modelDef.provider === 'gemini'
        ? await _geminiWithFallback(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig, label)
        : await _claudeCall(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout);
      return parseJSON(retryText, type);
    }
  } finally {
    console.log(`[gateway:${label}] completed in ${Date.now() - start}ms${hasSchema ? ' (schema)' : ''}${usedRetry ? ' (retried)' : ''}`);
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _geminiWithFallback(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, extraConfig, label) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  const body = {
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens, ...extraConfig },
  };

  const models = [modelDef.primary, modelDef.fallback].filter(Boolean);
  for (let i = 0; i < models.length; i++) {
    const model  = models[i];
    const isLast = i === models.length - 1;
    try {
      const text = await geminiCall(apiKey, model, body, { timeout });
      console.log(`[gateway:${label}] model: ${model}${i > 0 ? ' (fallback)' : ''}`);
      return text;
    } catch (err) {
      if (isLast) throw err;
      console.warn(`[gateway:${label}] ${model} failed (${err.message.substring(0, 80)}), trying fallback...`);
    }
  }
}

async function _claudeCall(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  return anthropicCall(apiKey, modelDef.primary, { prompt, systemPrompt, maxTokens, temperature, timeout });
}

module.exports = { llmCall };
