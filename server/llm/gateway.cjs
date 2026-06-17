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
 *  - Up to 2 retries on network/timeout/5xx errors (1s, 2s backoff) before falling back
 *  - Model fallback only after all retries exhausted (mirrors callGeminiStreaming)
 *  - One LLM retry on JSON parse failure
 *  - Structured per-call log line (model, latency, tokens, schema/repair/retry/fallback flags)
 */

const { resolveModel }    = require('./models.cjs');
const { PROFILES }        = require('./profiles.cjs');
const { geminiCall, geminiStreamCall } = require('./providers/gemini.cjs');
const { anthropicCall }   = require('./providers/anthropic.cjs');
const { getOrCreateCache } = require('./providers/geminiCache.cjs');
const { parseJSON }       = require('./repair.cjs');
const { logLLMCall }      = require('./logger.cjs');
const { sanitizeOutput }  = require('./sanitize.cjs');
const { sendLLMFailureAlert } = require('./alertEmail.cjs');

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
  // Pull profile and cache out before merging so they don't pollute destructuring
  const { profile = null, cache = null, ...rest } = options;

  // Merge profile defaults with explicit options — explicit always wins
  const profileDefaults = profile ? (PROFILES[profile] ?? {}) : {};
  const merged = { ...profileDefaults, ...rest };

  const {
    model: modelKey  = 'gemini',
    output           = 'json',
    maxTokens        = 2048,
    temperature      = 0.7,
    systemPrompt     = null,
    timeout          = 60_000,
    label            = 'unknown',
    schema           = null,
    _geminiConfig    = {},
    sessionId        = null,
  } = merged;

  const modelDef  = resolveModel(modelKey);
  const hasSchema = schema !== null && modelDef.provider === 'gemini';
  const start     = Date.now();

  // Resolve context cache when the model supports it.
  // cache.systemPrompt is used both for cache creation and as a text fallback
  // when the cache is unavailable (prepended to the prompt by the provider).
  const effectiveSystemPrompt = systemPrompt || cache?.systemPrompt || null;
  let cachedContent = null;
  if (cache && modelDef.supportsCache) {
    try {
      cachedContent = await getOrCreateCache(
        cache.key,
        cache.primaryFile,
        cache.systemPrompt || systemPrompt,
        modelDef.primary,
        cache.extraFiles || []
      );
    } catch (cacheErr) {
      console.warn(`[gateway:${label}] cache miss, proceeding without: ${cacheErr.message}`);
    }
  }

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
    // ── First attempt: retries on primary, then falls back if all fail ────────
    const first = await _callWithFallback(modelDef, prompt, effectiveSystemPrompt, maxTokens, temperature, timeout, geminiConfig, label, cachedContent);
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

      const retry = await _callWithFallback(modelDef, prompt, effectiveSystemPrompt, maxTokens, temperature, timeout, geminiConfig, label, cachedContent);
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
    sendLLMFailureAlert({ label, model: track.model, error: err.message, type: 'gateway', sessionId });
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
 * Returns the fallback modelDef for a given primary modelDef, or null if none.
 * Uses modelDef.fallback when defined (both Gemini and Claude).
 */
function _getFallback(modelDef) {
  if (modelDef.fallback) {
    const fallbackDef = resolveModel(modelDef.fallback);
    if (fallbackDef.primary === modelDef.primary) return null;
    return fallbackDef;
  }
  return null;
}

/**
 * Retries _call up to 2 times (3 total attempts) on retryable errors
 * (network errors, timeouts, 429/5xx HTTP errors).
 * JSON-parse retries are handled separately in llmCall.
 */
async function _callWithRetry(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig, label, cachedContent) {
  let lastErr;
  for (let attempt = 0; attempt <= _RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      const delay = _RETRY_DELAYS[attempt - 1];
      console.warn(`[gateway:${label}] retryable error, attempt ${attempt + 1}/${_RETRY_DELAYS.length + 1} in ${delay}ms (${lastErr.message.substring(0, 80)})`);
      await new Promise(r => setTimeout(r, delay));
    }
    try {
      return await _call(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig, cachedContent);
    } catch (err) {
      lastErr = err;
      if (!_isRetryable(err)) throw err;
    }
  }
  throw lastErr;
}

/**
 * Tries the primary model with retries, then the fallback model with retries if all fail.
 * cachedContent is only passed to the primary model — fallback always receives null so the
 * system prompt is prepended as plain text instead (cache is Gemini-specific).
 */
async function _callWithFallback(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig, label, cachedContent) {
  try {
    return await _callWithRetry(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig, label, cachedContent);
  } catch (primaryErr) {
    // Only fall back after retryable failures — non-retryable errors (4xx, bad config) propagate immediately
    if (!_isRetryable(primaryErr)) throw primaryErr;
    const fallbackDef = _getFallback(modelDef);
    if (!fallbackDef) throw primaryErr;
    console.warn(`[gateway:${label}] all retries exhausted, falling back to ${fallbackDef.primary}... (${primaryErr.message.substring(0, 80)})`);
    const result = await _callWithRetry(fallbackDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig, label, null);
    return { ...result, fallback: true };
  }
}

/**
 * Single attempt for the given modelDef — primary model only, no fallback.
 */
async function _call(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig, cachedContent) {
  if (modelDef.provider === 'gemini') {
    if (modelDef.streaming) {
      return _geminiStreamCall(modelDef.primary, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig, cachedContent);
    }
    return _geminiCall(modelDef.primary, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig, cachedContent);
  }
  // Claude does not support cachedContent; systemPrompt is handled by anthropicCall
  return _claudeCall(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout);
}

async function _geminiStreamCall(model, prompt, systemPrompt, maxTokens, temperature, timeout, extraConfig, cachedContent) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  // Skip systemPrompt prepend when cachedContent is present — it's already embedded in the cache
  const fullPrompt = (systemPrompt && !cachedContent) ? `${systemPrompt}\n\n${prompt}` : prompt;
  const body = {
    contents:         [{ parts: [{ text: fullPrompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens, ...extraConfig },
  };

  const { text, usage } = await geminiStreamCall(apiKey, model, body, { timeout, cachedContent });
  return { text, usage, model, fallback: false };
}

async function _geminiCall(model, prompt, systemPrompt, maxTokens, temperature, timeout, extraConfig, cachedContent) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  // Skip systemPrompt prepend when cachedContent is present — it's already embedded in the cache
  const fullPrompt = (systemPrompt && !cachedContent) ? `${systemPrompt}\n\n${prompt}` : prompt;
  const body = {
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: { temperature, maxOutputTokens: maxTokens, ...extraConfig },
  };

  const { text, usage } = await geminiCall(apiKey, model, body, { timeout, cachedContent });
  return { text, usage, model, fallback: false };
}

async function _claudeCall(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  const { text, usage } = await anthropicCall(apiKey, modelDef.primary, { prompt, systemPrompt, maxTokens, temperature, timeout });
  return { text, usage, model: modelDef.primary, fallback: false };
}

module.exports = { llmCall };
