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
  } = options;

  return llmCall(prompt, {
    model:       'gemini',
    output:      responseType === 'array' ? 'array' : 'json',
    maxTokens,
    temperature,
    systemPrompt,
    label:       'llm-json',
  });
}

async function llmTextCall(prompt, options = {}) {
  const {
    maxTokens    = 2048,
    temperature  = 0.7,
    systemPrompt = null,
    timeout      = 60_000,
  } = options;

  return llmCall(prompt, {
    model:       'gemini',
    output:      'text',
    maxTokens,
    temperature,
    systemPrompt,
    timeout,
    label:       'llm-text',
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
