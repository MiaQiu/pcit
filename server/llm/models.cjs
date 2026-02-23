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
    primary:  'gemini-3-pro-preview',
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
 * Accepts gateway keys ('flash', 'claude', 'pro') and legacy AI_PROVIDER env
 * values ('gemini-flash', 'claude-sonnet') for backward compatibility.
 * @param {string} key
 * @returns {Object} model definition
 */
function resolveModel(key) {
  if (key === 'gemini-flash') return MODELS.flash;
  if (key === 'claude-sonnet') return MODELS.claude;
  if (MODELS[key]) return MODELS[key];
  throw new Error(`[llm/models] Unknown model key: "${key}"`);
}

module.exports = { MODELS, resolveModel };
