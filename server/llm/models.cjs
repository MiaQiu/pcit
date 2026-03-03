'use strict';

/**
 * LLM Model Registry
 * To add or swap a model, change it here — nothing else needs to change.
 */
const MODELS = {
  // Fast, cheap — default for all analysis calls
  flash: {
    provider: 'gemini',
    primary:  'gemini-2.0-flash',
    fallback: 'gemini-3-flash-preview',
  },
  // Extended reasoning — CDI coaching narrative (streaming, handled separately)
  pro: {
    provider: 'gemini',
    primary:  process.env.GEMINI_STREAMING_MODEL || 'gemini-3.1-pro-preview',
    streaming: true,
  },
  // Anthropic path (AI_PROVIDER=claude-sonnet)
  claude: {
    provider: 'anthropic',
    primary:  'claude-sonnet-4-6',
  },
};

/**
 * Resolve a model key to its definition.
 * Accepts:
 *  - Named keys: 'flash', 'claude', 'pro'
 *  - Full model IDs: 'claude-sonnet-4-6', 'claude-opus-4-6', 'gemini-2.0-flash', etc.
 *  - Legacy AI_PROVIDER values: 'gemini-flash', 'claude-sonnet'
 * @param {string} key
 * @returns {Object} model definition
 */
function resolveModel(key) {
  // Named keys
  if (MODELS[key]) return MODELS[key];
  // Legacy values
  if (key === 'gemini-flash') return MODELS.flash;
  if (key === 'claude-sonnet') return MODELS.claude;
  // Full model IDs — infer provider from prefix
  if (key.startsWith('claude-')) return { provider: 'anthropic', primary: key };
  if (key.startsWith('gemini-')) return { provider: 'gemini', primary: key, fallback: MODELS.flash.primary };
  throw new Error(`[llm/models] Unknown model key: "${key}"`);
}

module.exports = { MODELS, resolveModel };
