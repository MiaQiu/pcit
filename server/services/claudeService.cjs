'use strict';

/**
 * Claude API Service
 * Thin wrapper that delegates to the LLM gateway infrastructure.
 * All exports are preserved for backward compatibility.
 */

const { anthropicCall } = require('../llm/providers/anthropic.cjs');
const { parseJSON }     = require('../llm/repair.cjs');

/**
 * Parse JSON from a model response (alias for gateway repair.parseJSON).
 * Kept for backward compatibility — prefer importing parseJSON from llm/repair directly.
 * @param {string}           text
 * @param {'object'|'array'} type
 * @returns {Object|Array}
 */
function parseClaudeJsonResponse(text, type = 'object') {
  const { value } = parseJSON(text, type);
  return value;
}

/**
 * Call Claude API and return parsed JSON.
 * @param {string} prompt
 * @param {Object} [options]
 * @param {number}  [options.maxTokens=2048]
 * @param {number}  [options.temperature=0.7]
 * @param {string}  [options.systemPrompt]
 * @param {string}  [options.model='claude-sonnet-4-6']
 * @param {string}  [options.responseType='object'] - 'object' | 'array'
 * @returns {Promise<Object|Array>}
 */
async function callClaudeForFeedback(prompt, options = {}) {
  const {
    maxTokens    = 2048,
    temperature  = 0.7,
    systemPrompt = null,
    model        = 'claude-sonnet-4-6',
    responseType = 'object',
  } = options;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const { text } = await anthropicCall(apiKey, model, { prompt, systemPrompt, maxTokens, temperature });
  const { value } = parseJSON(text, responseType);
  return value;
}

/**
 * Call Claude API and return raw text (no JSON parsing).
 * @param {string} prompt
 * @param {Object} [options]
 * @param {number}  [options.maxTokens=2048]
 * @param {number}  [options.temperature=0.7]
 * @param {string}  [options.systemPrompt]
 * @param {string}  [options.model='claude-sonnet-4-6']
 * @returns {Promise<string>}
 */
async function callClaudeRaw(prompt, options = {}) {
  const {
    maxTokens    = 2048,
    temperature  = 0.7,
    systemPrompt = null,
    model        = 'claude-sonnet-4-6',
  } = options;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const { text } = await anthropicCall(apiKey, model, { prompt, systemPrompt, maxTokens, temperature });
  return text;
}

module.exports = {
  callClaudeForFeedback,
  callClaudeRaw,
  parseClaudeJsonResponse,
};
