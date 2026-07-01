'use strict';

const fetch = require('node-fetch');

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
const BASE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';

async function qwenCall(apiKey, model, opts = {}) {
  const {
    prompt,
    systemPrompt = null,
    maxTokens    = 4096,
    temperature  = 0,
    timeout      = 120_000,
  } = opts;

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const body = { model, messages, max_tokens: maxTokens, temperature };

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(BASE_URL, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body:   JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const err       = new Error(errorData.error?.message || `Qwen API error: ${response.status}`);
    err.status      = response.status;
    err.retryable   = RETRYABLE_STATUSES.has(response.status);
    throw err;
  }

  const data  = await response.json();
  const usage = {
    inputTokens:  data.usage?.prompt_tokens     ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
  };

  return { text: data.choices[0].message.content, usage };
}

module.exports = { qwenCall };
