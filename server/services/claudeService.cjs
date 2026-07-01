'use strict';

/**
 * LLM Service — thin wrapper around the gateway for callers that predate llmCall.
 */

const { llmCall }   = require('../llm/gateway.cjs');
const { parseJSON } = require('../llm/repair.cjs');

function parseJsonResponse(text, type = 'object') {
  const { value } = parseJSON(text, type);
  return value;
}

async function llmJsonCall(prompt, options = {}) {
  const {
    maxTokens    = 2048,
    temperature  = 0.7,
    systemPrompt = null,
    responseType = 'object',
    model        = 'gemini',
    label        = 'llm-json',
    profile      = null,
  } = options;

  return llmCall(prompt, {
    model,
    output:      responseType === 'array' ? 'array' : 'json',
    maxTokens,
    temperature,
    systemPrompt,
    label,
    profile,
  });
}

async function llmTextCall(prompt, options = {}) {
  const {
    maxTokens    = 2048,
    temperature  = 0.7,
    systemPrompt = null,
    timeout      = 60_000,
    model        = 'gemini',
    label        = 'llm-text',
    profile      = null,
  } = options;

  return llmCall(prompt, {
    model,
    output:      'text',
    maxTokens,
    temperature,
    systemPrompt,
    timeout,
    label,
    profile,
  });
}

module.exports = {
  llmJsonCall,
  llmTextCall,
  parseJsonResponse,
  // legacy aliases — remove once all callers are updated
  callClaudeForFeedback:  llmJsonCall,
  callClaudeRaw:          llmTextCall,
  parseClaudeJsonResponse: parseJsonResponse,
};
