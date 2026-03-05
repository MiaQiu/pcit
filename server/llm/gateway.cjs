'use strict';

/**
 * LLM Gateway — single entry point for all AI calls.
 *
 * Handles:
 *  - Model routing (Gemini Flash / Pro / Claude) via models registry
 *  - Primary → fallback model switching on failure (ultimate fallback: Claude Sonnet)
 *  - Per-call AbortController timeout
 *  - Structured output via Gemini responseSchema (prevents malformed JSON at token level)
 *  - JSON parsing with jsonrepair fallback (safety net for non-schema calls)
 *  - Up to 2 retries on network/timeout/5xx errors (1s, 2s backoff)
 *  - One LLM retry on JSON parse failure
 *  - Structured per-call log line (model, latency, tokens, schema/repair/retry/fallback flags)
 */

const { resolveModel }    = require('./models.cjs');
const { geminiCall }      = require('./providers/gemini.cjs');
const { anthropicCall }   = require('./providers/anthropic.cjs');
const { parseJSON }       = require('./repair.cjs');
const { logLLMCall }      = require('./logger.cjs');
const { sanitizeOutput }  = require('./sanitize.cjs');

function _defaultModelKey() {
  return process.env.AI_PROVIDER || 'gemini-2.0-flash';
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
 *                                            Enforces valid JSON at the token level.
 *                                            Has no effect for Claude calls.
 * @param {Object}  [options._geminiConfig] - Escape hatch: merged into generationConfig for Gemini
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

  // Mutable tracking state — populated during execution, read in finally
  const track = {
    model:       modelDef.primary,
    usedFallback: false,
    usedRepair:   false,
    usedRetry:    false,
    inputTokens:  null,
    outputTokens: null,
    ok:           true,
    error:        null,
  };

  const geminiConfig = hasSchema
    ? { ..._geminiConfig, responseMimeType: 'application/json', responseSchema: schema }
    : _geminiConfig;

  try {
    // ── First attempt (with retries on network/timeout/5xx errors) ───────────
    const first = await _callWithRetry(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig, label);
    track.model        = first.model;
    track.usedFallback = first.fallback;
    track.inputTokens  = first.usage?.inputTokens  ?? null;
    track.outputTokens = first.usage?.outputTokens ?? null;

    if (output === 'text') return sanitizeOutput(first.text);

    // ── JSON parse (with repair fallback inside parseJSON) ───────────────────
    const type = output === 'array' ? 'array' : 'object';
    try {
      const { value, repaired } = parseJSON(first.text, type);
      track.usedRepair = repaired;
      return sanitizeOutput(value);
    } catch (parseErr) {
      // ── LLM retry on JSON parse failure ─────────────────────────────────
      track.usedRetry = true;
      console.warn(`[gateway:${label}] JSON parse failed${hasSchema ? ' (schema active)' : ''}, retrying... (${parseErr.message.substring(0, 80)})`);

      const retry = await _callWithRetry(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig, label);
      track.model        = retry.model;
      track.inputTokens  = retry.usage?.inputTokens  ?? null;
      track.outputTokens = retry.usage?.outputTokens ?? null;

      const { value, repaired } = parseJSON(retry.text, type);
      track.usedRepair = repaired;
      return sanitizeOutput(value);
    }
  } catch (err) {
    track.ok    = false;
    track.error = err.message;
    throw err;
  } finally {
    logLLMCall({
      label,
      model:        track.model,
      provider:     modelDef.provider,
      latencyMs:    Date.now() - start,
      inputTokens:  track.inputTokens,
      outputTokens: track.outputTokens,
      hasSchema,
      usedFallback: track.usedFallback,
      usedRepair:   track.usedRepair,
      usedRetry:    track.usedRetry,
      ok:           track.ok,
      error:        track.error,
    });
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _fallbackModelDef() {
  return resolveModel(process.env.FALLBACK_MODEL || 'claude-sonnet-4-6');
}

const _RETRY_DELAYS = [1_000, 2_000]; // ms between attempts 1→2 and 2→3

function _isRetryable(err) {
  return err.retryable === true
    || err.name === 'AbortError'
    || err.type === 'aborted'
    || err.code === 'ECONNRESET'
    || err.code === 'ETIMEDOUT';
}

/**
 * Wraps _call with up to 2 retries (3 total attempts) on retryable errors
 * (network errors, timeouts, 429/5xx HTTP errors).
 * JSON-parse retries are handled separately in llmCall.
 */
async function _callWithRetry(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig, label) {
  let lastErr;
  for (let attempt = 0; attempt <= _RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      const delay = _RETRY_DELAYS[attempt - 1];
      console.warn(`[gateway:${label}] retryable error, attempt ${attempt + 1}/${_RETRY_DELAYS.length + 1} in ${delay}ms (${lastErr.message.substring(0, 80)})`);
      await new Promise(r => setTimeout(r, delay));
    }
    try {
      return await _call(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig);
    } catch (err) {
      lastErr = err;
      if (!_isRetryable(err)) throw err;
    }
  }
  throw lastErr;
}

/**
 * Routes to Gemini (with Gemini model fallback) or Claude (with FALLBACK_MODEL fallback).
 * Gemini calls stay within Gemini to preserve responseSchema formatting.
 * Claude calls fall back to FALLBACK_MODEL (any provider).
 */
async function _call(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig) {
  if (modelDef.provider === 'gemini') {
    // Gemini: primary → Gemini fallback (defined in models registry)
    return _geminiWithFallback(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig);
  }

  // Claude: primary → FALLBACK_MODEL
  const fallbackDef = _fallbackModelDef();
  const isFallback  = modelDef.primary === fallbackDef.primary;
  try {
    return await _claudeCall(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout);
  } catch (err) {
    if (isFallback) throw err; // already on fallback model, nothing left to try
    console.warn(`[gateway] ${modelDef.primary} failed (${err.message.substring(0, 80)}), falling back to ${fallbackDef.primary}...`);
    const result = fallbackDef.provider === 'gemini'
      ? await _geminiWithFallback(fallbackDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig)
      : await _claudeCall(fallbackDef, prompt, systemPrompt, maxTokens, temperature, timeout);
    return { ...result, fallback: true };
  }
}

async function _geminiWithFallback(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, extraConfig) {
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
      const { text, usage } = await geminiCall(apiKey, model, body, { timeout });
      return { text, usage, model, fallback: i > 0 };
    } catch (err) {
      if (isLast) throw err;
      console.warn(`[gateway] ${model} failed (${err.message.substring(0, 80)}), trying fallback...`);
    }
  }
}

async function _claudeCall(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  const { text, usage } = await anthropicCall(apiKey, modelDef.primary, { prompt, systemPrompt, maxTokens, temperature, timeout });
  return { text, usage, model: modelDef.primary, fallback: false };
}

module.exports = { llmCall };
