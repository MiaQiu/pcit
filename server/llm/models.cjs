'use strict';

/**
 * LLM Model Registry
 * Two models: gemini (primary path) and claude (fallback / explicit calls).
 *
 * gemini: gemini-3.5-flash → gemini-3.1-pro-preview on failure
 * claude: claude-sonnet-4-6 → claude-haiku-4-5-20251001 on failure
 */

const MODELS = {
  gemini: {
    provider:      'gemini',
    primary:       'gemini-3.5-flash',
    fallback:      'gemini-3.1-pro-preview',
    streaming:     true,
    supportsCache: true,
  },
  claude: {
    provider: 'anthropic',
    primary:  'claude-sonnet-4-6',
    fallback: 'claude-haiku-4-5-20251001',
  },
  deepseek: {
    provider: 'deepseek',
    primary:  'deepseek-chat',
  },
  'deepseek-reasoner': {
    provider: 'deepseek',
    primary:  'deepseek-reasoner',
  },
  qwen: {
    provider: 'qwen',
    primary:  'qwen3.7-max',
  },
  'qwen-max': {
    provider: 'qwen',
    primary:  'qwen-max',
  },
  'qwen-turbo': {
    provider: 'qwen',
    primary:  'qwen-turbo',
  },
};

/**
 * Resolve a model key or full model ID to a model definition.
 * Accepts:
 *  - Named keys: 'gemini' | 'claude'
 *  - Full model IDs: 'gemini-3.5-flash', 'claude-sonnet-4-6', etc.
 */
function resolveModel(key) {
  if (MODELS[key]) return MODELS[key];
  if (key.startsWith('claude-')) return { provider: 'anthropic', primary: key, fallback: MODELS.claude.fallback };
  if (key.startsWith('gemini-')) return { provider: 'gemini', primary: key, fallback: MODELS.gemini.fallback, streaming: true, supportsCache: true };
  if (key.startsWith('deepseek-')) return { provider: 'deepseek', primary: key };
  if (key.startsWith('qwen')) return { provider: 'qwen', primary: key };
  if (key.startsWith('gpt-') || key.startsWith('o1') || key.startsWith('o3') || key.startsWith('o4')) return { provider: 'openai', primary: key };
  throw new Error(`[llm/models] Unknown model key: "${key}"`);
}

module.exports = { MODELS, resolveModel };
