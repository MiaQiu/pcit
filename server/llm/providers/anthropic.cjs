'use strict';

const fetch = require('node-fetch');

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

/**
 * Single Anthropic messages call with per-call timeout.
 *
 * @param {string} apiKey
 * @param {string} model
 * @param {Object} opts
 * @param {string}  opts.prompt
 * @param {string}  [opts.systemPrompt]
 * @param {number}  [opts.maxTokens=2048]
 * @param {number}  [opts.temperature=0.7]
 * @param {number}  [opts.timeout=60000]
 * @returns {Promise<{ text: string, usage: { inputTokens: number|null, outputTokens: number|null } }>}
 */
async function anthropicCall(apiKey, model, opts = {}) {
  const {
    prompt,
    systemPrompt = null,
    maxTokens    = 2048,
    temperature  = 0.7,
    timeout      = 60_000,
  } = opts;

  const body = {
    model,
    max_tokens:  maxTokens,
    temperature,
    messages: [{ role: 'user', content: prompt }],
  };
  if (systemPrompt) body.system = systemPrompt;

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body:   JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const err       = new Error(errorData.error?.message || `Claude API error: ${response.status}`);
    err.status      = response.status;
    err.retryable   = RETRYABLE_STATUSES.has(response.status);
    throw err;
  }

  const data = await response.json();
  const usage = {
    inputTokens:  data.usage?.input_tokens  ?? null,
    outputTokens: data.usage?.output_tokens ?? null,
  };

  return { text: data.content[0].text, usage };
}

module.exports = { anthropicCall };
