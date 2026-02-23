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
 *  - Structured per-call log line (model, latency, tokens, schema/repair/retry/fallback flags)
 */

const { resolveModel }  = require('./models.cjs');
const { geminiCall }    = require('./providers/gemini.cjs');
const { anthropicCall } = require('./providers/anthropic.cjs');
const { parseJSON }     = require('./repair.cjs');
const { logLLMCall }    = require('./logger.cjs');

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
    // ── First attempt ────────────────────────────────────────────────────────
    const first = await _call(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig);
    track.model        = first.model;
    track.usedFallback = first.fallback;
    track.inputTokens  = first.usage?.inputTokens  ?? null;
    track.outputTokens = first.usage?.outputTokens ?? null;

    if (output === 'text') return first.text;

    // ── JSON parse (with repair fallback inside parseJSON) ───────────────────
    const type = output === 'array' ? 'array' : 'object';
    try {
      const { value, repaired } = parseJSON(first.text, type);
      track.usedRepair = repaired;
      return value;
    } catch (parseErr) {
      // ── LLM retry on JSON parse failure ─────────────────────────────────
      track.usedRetry = true;
      console.warn(`[gateway:${label}] JSON parse failed${hasSchema ? ' (schema active)' : ''}, retrying... (${parseErr.message.substring(0, 80)})`);

      const retry = await _call(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig);
      track.model        = retry.model;
      track.inputTokens  = retry.usage?.inputTokens  ?? null;
      track.outputTokens = retry.usage?.outputTokens ?? null;

      const { value, repaired } = parseJSON(retry.text, type);
      track.usedRepair = repaired;
      return value;
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

/** Routes to Gemini (with model fallback) or Claude. */
async function _call(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig) {
  return modelDef.provider === 'gemini'
    ? _geminiWithFallback(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout, geminiConfig)
    : _claudeCall(modelDef, prompt, systemPrompt, maxTokens, temperature, timeout);
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
