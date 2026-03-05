'use strict';

/**
 * Tests the gateway retry/fallback mechanism using mock providers.
 * No real API calls are made.
 *
 * Usage: node scripts/test-gateway-retry.cjs
 *
 * Scenarios:
 *  1. Non-retryable error throws immediately (no retry)
 *  2. Retryable error retries 3 times then throws
 *  3. Succeeds on 2nd attempt (1 retry)
 *  4. AbortError (timeout) is retried
 *  5. All primary retries exhausted → falls back to Claude
 *  6. Fallback model is also retried before giving up
 *  7. Both primary and fallback exhausted → throws
 */

// ── Speed up retries (override setTimeout before requiring gateway) ───────────
const _realSetTimeout = global.setTimeout;
global.setTimeout = (fn, _delay) => _realSetTimeout(fn, 0); // make delays instant

// ── Mock providers ─────────────────────────────────────────────────────────────

const mocks = { gemini: null, anthropic: null };
let calls = [];

const geminiPath    = require.resolve('../server/llm/providers/gemini.cjs');
const anthropicPath = require.resolve('../server/llm/providers/anthropic.cjs');

require.cache[geminiPath] = {
  id: geminiPath, filename: geminiPath, loaded: true,
  exports: {
    geminiCall: async (_apiKey, model) => {
      calls.push({ provider: 'gemini', model });
      return mocks.gemini(model, calls.length);
    },
  },
};

require.cache[anthropicPath] = {
  id: anthropicPath, filename: anthropicPath, loaded: true,
  exports: {
    anthropicCall: async (_apiKey, model) => {
      calls.push({ provider: 'anthropic', model });
      return mocks.anthropic(model, calls.length);
    },
  },
};

process.env.GEMINI_API_KEY    = 'mock-key';
process.env.ANTHROPIC_API_KEY = 'mock-key';
process.env.AI_PROVIDER       = 'flash';
process.env.FALLBACK_MODEL    = 'claude-sonnet-4-6';

const { llmCall } = require('../server/llm/gateway.cjs');

// ── Helpers ────────────────────────────────────────────────────────────────────

const OK_TEXT = '{"ok":true}';
const OK_RES  = { text: OK_TEXT, usage: { inputTokens: 10, outputTokens: 5 } };

function retryableErr(msg = '503 Service Unavailable') {
  const e = new Error(msg); e.retryable = true; return e;
}
function hardErr(msg = '400 Bad Request') {
  const e = new Error(msg); e.retryable = false; return e;
}
function timeoutErr() {
  const e = new Error('The operation was aborted'); e.name = 'AbortError'; return e;
}

function reset(geminiFn, anthropicFn) {
  calls = [];
  mocks.gemini    = geminiFn;
  mocks.anthropic = anthropicFn ?? (() => { throw new Error('Unexpected anthropic call'); });
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ── Test runner ────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;

async function test(name, fn) {
  process.stdout.write(`  ${name} ... `);
  try {
    await fn();
    console.log('✅ pass');
    passed++;
  } catch (err) {
    console.log(`❌ FAIL  ${err.message}`);
    failed++;
  }
}

// ── Scenarios ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🧪  Gateway Retry / Fallback Tests\n');

  await test('non-retryable error throws immediately (1 call only)', async () => {
    reset(() => { throw hardErr(); });
    try { await llmCall('test', { output: 'text', label: 't1' }); } catch (_) {}
    assert(calls.length === 1, `Expected 1 call, got ${calls.length}`);
  });

  await test('retryable error: primary retried 3 times before fallback', async () => {
    reset(() => { throw retryableErr(); }); // all models fail
    try { await llmCall('test', { output: 'text', label: 't2' }); } catch (_) {}
    const primary = calls.filter(c => c.model === 'gemini-2.0-flash').length;
    assert(primary === 3, `Expected 3 primary calls, got ${primary}`);
  });

  await test('succeeds on 2nd attempt', async () => {
    let n = 0;
    reset(() => { n++; return n < 2 ? (() => { throw retryableErr(); })() : OK_RES; });
    const result = await llmCall('test', { output: 'text', label: 't3' });
    assert(calls.length === 2, `Expected 2 calls, got ${calls.length}`);
    assert(result === OK_TEXT, 'Expected ok text');
  });

  await test('AbortError (timeout) is retried', async () => {
    let n = 0;
    reset(() => { n++; return n < 3 ? (() => { throw timeoutErr(); })() : OK_RES; });
    const result = await llmCall('test', { output: 'text', label: 't4' });
    assert(calls.length === 3, `Expected 3 calls, got ${calls.length}`);
    assert(result === OK_TEXT, 'Expected ok text');
  });

  // With AI_PROVIDER=flash, the fallback is gemini-3-flash-preview (same Gemini mock)
  await test('all primary retries fail → falls back to gemini-3-flash-preview (1 call)', async () => {
    reset((model) => {
      if (model === 'gemini-2.0-flash') throw retryableErr('Gemini primary 503');
      return OK_RES; // fallback model succeeds
    });
    const result = await llmCall('test', { output: 'text', label: 't5' });
    const primary  = calls.filter(c => c.model === 'gemini-2.0-flash').length;
    const fallback = calls.filter(c => c.model === 'gemini-3-flash-preview').length;
    assert(primary  === 3, `Expected 3 primary calls, got ${primary}`);
    assert(fallback === 1, `Expected 1 fallback call, got ${fallback}`);
    assert(result === OK_TEXT, 'Expected ok text from fallback');
  });

  await test('fallback model is also retried (succeeds on 2nd fallback attempt)', async () => {
    let fallbackN = 0;
    reset((model) => {
      if (model === 'gemini-2.0-flash') throw retryableErr('Gemini primary 503');
      fallbackN++;
      if (fallbackN < 2) throw retryableErr('Gemini fallback 503');
      return OK_RES;
    });
    const result = await llmCall('test', { output: 'text', label: 't6' });
    const primary  = calls.filter(c => c.model === 'gemini-2.0-flash').length;
    const fallback = calls.filter(c => c.model === 'gemini-3-flash-preview').length;
    assert(primary  === 3, `Expected 3 primary calls, got ${primary}`);
    assert(fallback === 2, `Expected 2 fallback calls (1 retry), got ${fallback}`);
    assert(result === OK_TEXT, 'Expected ok text');
  });

  await test('both primary and fallback exhausted → throws (3+3 calls)', async () => {
    reset(() => { throw retryableErr('Gemini 503'); }); // both models fail
    try { await llmCall('test', { output: 'text', label: 't7' }); } catch (_) {}
    const primary  = calls.filter(c => c.model === 'gemini-2.0-flash').length;
    const fallback = calls.filter(c => c.model === 'gemini-3-flash-preview').length;
    assert(primary  === 3, `Expected 3 primary calls, got ${primary}`);
    assert(fallback === 3, `Expected 3 fallback calls, got ${fallback}`);
  });

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`${passed + failed} tests  |  ${passed} passed  |  ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
