/**
 * Claude API Service
 * Centralized wrapper for all Claude API interactions
 */
const fetch = require('node-fetch');

/**
 * Parse JSON from Claude response text
 * Handles markdown code blocks and extracts JSON object/array
 * @param {string} text - Raw response text from Claude
 * @param {string} [type='object'] - 'object' for {} or 'array' for []
 * @returns {Object|Array} Parsed JSON
 */
function parseClaudeJsonResponse(text, type = 'object') {
  let cleanJson = text.trim();

  // Remove markdown code blocks if present
  cleanJson = cleanJson.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  // Find the appropriate delimiters based on type
  const openChar = type === 'array' ? '[' : '{';
  const closeChar = type === 'array' ? ']' : '}';

  // Try to extract JSON if there's text before/after it
  const firstDelim = cleanJson.indexOf(openChar);
  const lastDelim = cleanJson.lastIndexOf(closeChar);

  if (firstDelim !== -1 && lastDelim !== -1 && lastDelim > firstDelim) {
    cleanJson = cleanJson.substring(firstDelim, lastDelim + 1);
  }

  return JSON.parse(cleanJson);
}

/**
 * Call Claude API for feedback generation
 * @param {string} prompt - The prompt to send to Claude
 * @param {Object} [options] - Optional configuration
 * @param {number} [options.maxTokens=2048] - Maximum tokens in response
 * @param {number} [options.temperature=0.7] - Response temperature
 * @param {string} [options.systemPrompt] - Optional system prompt
 * @param {string} [options.model='claude-sonnet-4-5-20250929'] - Model to use
 * @param {string} [options.responseType='object'] - 'object' for {} or 'array' for []
 * @returns {Promise<Object|Array>} Parsed JSON response
 */
async function callClaudeForFeedback(prompt, options = {}) {
  const {
    maxTokens = 2048,
    temperature = 0.7,
    systemPrompt = null,
    model = 'claude-sonnet-4-5-20250929',
    responseType = 'object'
  } = options;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const body = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{
      role: 'user',
      content: prompt
    }]
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0].text;

  return parseClaudeJsonResponse(text, responseType);
}

/**
 * Call Claude API with raw response (no JSON parsing)
 * @param {string} prompt - The prompt to send to Claude
 * @param {Object} [options] - Optional configuration
 * @param {number} [options.maxTokens=2048] - Maximum tokens in response
 * @param {number} [options.temperature=0.7] - Response temperature
 * @param {string} [options.systemPrompt] - Optional system prompt
 * @param {string} [options.model='claude-sonnet-4-5-20250929'] - Model to use
 * @returns {Promise<string>} Raw text response
 */
async function callClaudeRaw(prompt, options = {}) {
  const {
    maxTokens = 2048,
    temperature = 0.7,
    systemPrompt = null,
    model = 'claude-sonnet-4-5-20250929'
  } = options;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const body = {
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{
      role: 'user',
      content: prompt
    }]
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

module.exports = {
  callClaudeForFeedback,
  callClaudeRaw,
  parseClaudeJsonResponse
};
