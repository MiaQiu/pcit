'use strict';

/**
 * Standalone Gemini DPICS coding caller — one API call per session file, with
 * per-call cost tracking from usageMetadata (including thinking tokens, which
 * Gemini bills at the output rate even though they're stripped from the
 * visible text).
 *
 * Usage:
 *   node server/scripts/gemini-dpics-call.cjs --model flash|pro [--cache] [--session <label>] [--prompt <name>]
 *
 *   --model    "flash" -> gemini-3.5-flash (default) | "pro" -> gemini-3.1-pro-preview
 *              Also accepts a full model id directly (e.g. --model gemini-3.5-flash).
 *   --cache    If set: DPICS-Manual.2.18.pdf + the prompt file are uploaded and wrapped in a
 *              Gemini context cache (cachedContents), reused across every session in this run.
 *              The user message is then session data only.
 *              If omitted: no manual is used at all. The prompt file is sent as the
 *              systemInstruction, and the user message is session data only.
 *   --session    Optional. Run only one session file, e.g. --session session-3.
 *                Omit to run all six sessions under session-only/.
 *   --prompt     Prompt file name under server/prompts/, without .txt. Default: dpicsCoding-agentic-v10.
 *   --ttl        Only relevant with --cache. Overrides the cache's TTL at creation, Gemini
 *                duration format (e.g. --ttl 600s). Default: 900s (15m).
 *   --keep-cache Only relevant with --cache. By default, after the last session in this run,
 *                this script shrinks the cache's TTL down to 60s (Gemini's minimum) so it bills
 *                only for actual usage and then auto-expires on its own. Pass --keep-cache to
 *                skip that and leave it at its full committed TTL instead — e.g. you plan to
 *                run another --cache batch against the same prompt within that TTL and want to
 *                skip re-uploading/re-creating it.
 *
 * Writes raw model output + usage per call to eval-results/dpics/gemini-calls/, one JSON file
 * per call named <session>__<model>__<cache|nocache>__<prompt>__<timestamp>.json, and prints
 * a per-call and total cost summary to stdout — including, for --cache runs, the two extra
 * cost components generateContent's usageMetadata never reflects:
 *   - cache WRITE cost: one-time fee at cache-creation time, billed at the standard (not
 *     cached) input rate for the tokens being written in. Only charged when this run actually
 *     creates a fresh cache (detected heuristically: cache createTime is <10s old right after
 *     getOrCreateCache returns — an older createTime means an existing cache was reused, which
 *     already paid its write fee in a prior run).
 *   - cache STORAGE cost: hourly rate for however long the cache was alive this run. Gemini
 *     bills storage for the full committed TTL/expireTime (set at creation or last update) —
 *     calling delete() on an otherwise-untouched cache does NOT refund/stop billing for the
 *     remaining committed TTL, so this script never calls delete() on a cache it created.
 *     Instead it PATCHes the ttl down to 60s (Gemini's minimum) right after the last session,
 *     which recalculates the bill to match actual usage and lets Google's own expiry clean it
 *     up. Skipping that (--keep-cache) means the full originally committed TTL gets billed
 *     regardless of whether you use the cache again.
 *
 * PRICING below is verified against https://ai.google.dev/gemini-api/docs/pricing as of
 * 2026-07-01 (standard paid-tier rates). gemini-3.1-pro-preview's input/output/cachedInput
 * are tiered by context window (higher above 200k prompt tokens) — this script always uses
 * the <=200k tier, since actual session sizes here never approach that. Re-verify if Google
 * revises pricing or if usage grows near the 200k threshold.
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const fetch  = require('node-fetch');

const { getOrCreateCache } = require('../llm/providers/geminiCache.cjs');

const MODEL_MAP = {
  flash: 'gemini-3.5-flash',
  pro:   'gemini-3.1-pro-preview',
};

// $ per 1M tokens (input/cachedInput/output), and $ per 1M tokens PER HOUR for cache
// storage. Verified against ai.google.dev/gemini-api/docs/pricing, standard paid tier,
// <=200k context window, as of 2026-07-01.
const PRICING = {
  'gemini-3.5-flash': {
    input:       1.50,
    cachedInput: 0.15,
    output:      9.00, // includes thinking tokens, billed at the output rate
    storage:     1.00,
  },
  'gemini-3.1-pro-preview': {
    input:       2.00,
    cachedInput: 0.20,
    output:      12.00,
    storage:     4.50,
  },
};

const MANUAL_PATH  = path.join(__dirname, '../assets/DPICS-Manual.2.18.pdf');
const PROMPTS_DIR  = path.join(__dirname, '../prompts');
const SESSION_DIR  = path.resolve(__dirname, '../../prompts/deepseek/session-only');
const OUT_DIR      = path.resolve(__dirname, '../../eval-results/dpics/gemini-calls');
const DEFAULT_PROMPT = 'dpicsCoding-agentic-v10';

function parseArgs(argv) {
  const args = { model: 'flash', cache: false, session: null, prompt: DEFAULT_PROMPT, keepCache: false, ttl: '900s' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--model') args.model = argv[++i];
    else if (argv[i] === '--cache') args.cache = true;
    else if (argv[i] === '--session') args.session = argv[++i];
    else if (argv[i] === '--prompt') args.prompt = argv[++i];
    else if (argv[i] === '--keep-cache') args.keepCache = true;
    else if (argv[i] === '--ttl') args.ttl = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

async function getCacheInfo(apiKey, cacheName) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${cacheName}?key=${apiKey}`);
  if (!res.ok) return null;
  const data = await res.json();
  return {
    createTimeMs:   data.createTime ? new Date(data.createTime).getTime() : null,
    totalTokenCount: data.usageMetadata?.totalTokenCount ?? null,
  };
}

// Gemini bills explicit-cache storage for the full TTL/expireTime committed at creation (or
// last update) — NOT prorated to when you actually call delete(). Calling delete() on an
// otherwise-untouched cache does not stop billing for the remaining committed TTL, so this
// script never does that; it PATCHes the ttl down to Gemini's minimum instead, which
// recalculates the bill to match actual usage and lets the cache auto-expire on its own.
async function shortenCacheTtl(apiKey, cacheName, ttl = '60s') {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${cacheName}?key=${apiKey}&updateMask=ttl`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ttl }),
  });
  return res.ok;
}

// Shrinking (not deleting) leaves the cache resource in place server-side, so the local
// reuse-registry in geminiCache.cjs would otherwise still think it's valid for its original
// (pre-shrink) TTL — the next invocation could then try to reuse an already-expiring/expired
// cache and hit a stale-reference error. Directly drop the registry entry (not exported by
// geminiCache.cjs, so read/write the file here) to force a clean re-creation next time.
function forgetCacheRegistryEntry(cacheName) {
  const registryPath = path.join(__dirname, '../llm/providers/.gemini-cache-registry.json');
  try {
    const data = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    let changed = false;
    for (const [k, v] of Object.entries(data.cacheRegistry || {})) {
      if (v.name === cacheName) { delete data.cacheRegistry[k]; changed = true; }
    }
    if (changed) fs.writeFileSync(registryPath, JSON.stringify(data, null, 2));
  } catch (_) {}
}

function resolveModelId(key) {
  return MODEL_MAP[key] || key;
}

function listSessionFiles(onlyLabel) {
  const files = fs.readdirSync(SESSION_DIR)
    .filter(f => f.endsWith('.txt'))
    .sort((a, b) => {
      const na = parseInt(a.match(/session-(\d+)/)?.[1] ?? '0', 10);
      const nb = parseInt(b.match(/session-(\d+)/)?.[1] ?? '0', 10);
      return na - nb;
    });

  if (!onlyLabel) return files;

  const match = files.find(f => f.startsWith(onlyLabel));
  if (!match) throw new Error(`No session file matching "${onlyLabel}" in ${SESSION_DIR}`);
  return [match];
}

async function generateContent(apiKey, model, { contents, systemInstruction = null, cachedContent = null }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    ...(cachedContent ? { cachedContent } : {}),
    ...(systemInstruction && !cachedContent ? { systemInstruction } : {}),
    contents,
  };

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini API error ${res.status}: ${errText.substring(0, 500)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Empty response from Gemini API: ${JSON.stringify(data).substring(0, 500)}`);

  return { text, usageMetadata: data.usageMetadata || {} };
}

function computeCost(model, usageMetadata) {
  const rates = PRICING[model];
  if (!rates) throw new Error(`No pricing entry for model "${model}" — add one to PRICING in this script.`);

  const promptTokens   = usageMetadata.promptTokenCount     ?? 0;
  const cachedTokens    = usageMetadata.cachedContentTokenCount ?? 0;
  const outputTokens   = usageMetadata.candidatesTokenCount ?? 0;
  const thinkingTokens = usageMetadata.thoughtsTokenCount   ?? 0;
  const totalTokens    = usageMetadata.totalTokenCount      ?? (promptTokens + outputTokens + thinkingTokens);

  const uncachedPromptTokens = Math.max(promptTokens - cachedTokens, 0);
  const billedOutputTokens   = outputTokens + thinkingTokens;

  const cost =
    (uncachedPromptTokens / 1_000_000) * rates.input +
    (cachedTokens          / 1_000_000) * rates.cachedInput +
    (billedOutputTokens    / 1_000_000) * rates.output;

  return {
    promptTokens, cachedTokens, uncachedPromptTokens,
    outputTokens, thinkingTokens, billedOutputTokens,
    totalTokens, cost,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');

  const model = resolveModelId(args.model);
  if (!PRICING[model]) throw new Error(`Unknown model "${model}". Expected "flash", "pro", or a full model id in PRICING.`);

  const promptPath = path.join(PROMPTS_DIR, `${args.prompt}.txt`);
  if (!fs.existsSync(promptPath)) throw new Error(`Prompt file not found: ${promptPath}`);

  const sessionFiles = listSessionFiles(args.session);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let cachedContentName = null;
  let cacheCreateTimeMs = null;
  let cacheCreationCost = 0;
  let promptText = null;

  if (args.cache) {
    console.log(`📦 Preparing Gemini cache (manual + ${args.prompt}) for ${model}...`);
    cachedContentName = await getOrCreateCache(
      `${args.prompt}__${model}`,
      MANUAL_PATH,
      null, // files-only cache — no baked-in systemInstruction
      model,
      [{ path: promptPath, mimeType: 'text/plain' }],
      args.ttl
    );
    const cacheInfo = await getCacheInfo(apiKey, cachedContentName);
    cacheCreateTimeMs = cacheInfo?.createTimeMs ?? null;

    const justCreated = cacheCreateTimeMs && (Date.now() - cacheCreateTimeMs) < 10_000;
    if (justCreated && cacheInfo.totalTokenCount) {
      cacheCreationCost = (cacheInfo.totalTokenCount / 1_000_000) * PRICING[model].input;
      console.log(`✅ Using cache: ${cachedContentName} (freshly created — one-time write fee: ${cacheInfo.totalTokenCount} tokens ≈ $${cacheCreationCost.toFixed(5)})`);
    } else {
      console.log(`✅ Using cache: ${cachedContentName} (reused existing — write fee already paid in a prior run)`);
    }
  } else {
    promptText = fs.readFileSync(promptPath, 'utf-8');
  }

  const runResults = [];
  let totalCost = 0;

  for (const file of sessionFiles) {
    const label = file.match(/session-\d+/)?.[0] || file;
    const userMessage = fs.readFileSync(path.join(SESSION_DIR, file), 'utf-8');

    // Nonce-prefix the system instruction per call (nocache path only) so Gemini's
    // implicit prefix caching can never match it against a prior identical call in this
    // same loop — otherwise a "no-cache" run's later sessions could get silently
    // discounted, contaminating the no-cache cost baseline we're trying to measure.
    const systemInstruction = promptText
      ? { parts: [{ text: `[Cache-Bypass ID: ${crypto.randomUUID()} | Timestamp: ${Date.now()}]\n${promptText}` }] }
      : null;

    console.log(`\n▶ ${label} (model=${model}, cache=${args.cache})`);
    const { text, usageMetadata } = await generateContent(apiKey, model, {
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      systemInstruction,
      cachedContent: cachedContentName,
    });

    const usage = computeCost(model, usageMetadata);
    totalCost += usage.cost;

    console.log(
      `  prompt=${usage.promptTokens} (cached=${usage.cachedTokens}) ` +
      `output=${usage.outputTokens} thinking=${usage.thinkingTokens} ` +
      `total=${usage.totalTokens} cost=$${usage.cost.toFixed(5)}`
    );

    const baseName = `${label}__${model}__${args.cache ? 'cache' : 'nocache'}__${args.prompt}__${Date.now()}`;

    const outFile = path.join(OUT_DIR, `${baseName}.json`);
    fs.writeFileSync(outFile, JSON.stringify({
      session: label, model, cache: args.cache, prompt: args.prompt, usage, text,
      // Same one-time value + originating cache's createTime repeated on every session file
      // from this invocation (only set if this run actually created a fresh cache) — dedupe
      // by cacheCreateTimeMs (not by cost) when aggregating, since two distinct cache-creation
      // events can produce identical dollar amounts if the token count happens to match.
      cacheCreationCost: args.cache ? cacheCreationCost : undefined,
      cacheCreateTimeMs: args.cache ? cacheCreateTimeMs : undefined,
    }, null, 2));

    // Final prompt actually sent to the model, excluding the cached manual/prompt file
    // (those live in cachedContent, not inline text) — kept as a plain-text companion
    // file so the exact wording of a given call can be inspected without re-deriving it.
    const sentPrompt = args.cache
      ? `[USER]\n${userMessage}\n\n(note: manual + ${args.prompt} were supplied via cachedContent "${cachedContentName}", not inlined here)`
      : `[SYSTEM]\n${systemInstruction.parts[0].text}\n\n[USER]\n${userMessage}`;
    fs.writeFileSync(path.join(OUT_DIR, `${baseName}.prompt.txt`), sentPrompt);

    runResults.push({ session: label, ...usage });
  }

  let storageCost = 0;
  if (args.cache && cachedContentName) {
    if (cacheCreateTimeMs) {
      const cachedTokens = runResults[runResults.length - 1]?.cachedTokens ?? 0;
      const elapsedHours = (Date.now() - cacheCreateTimeMs) / 3_600_000;
      storageCost = (cachedTokens / 1_000_000) * PRICING[model].storage * elapsedHours;
      console.log(`\nCache storage: ${cachedTokens} tokens alive for ${(elapsedHours * 60).toFixed(1)} min ≈ $${storageCost.toFixed(5)} (separate from generation cost above)`);
    }

    if (args.keepCache) {
      console.log(`Cache kept alive (--keep-cache): ${cachedContentName} — its full committed TTL (${args.ttl}) is already billed for storage regardless of whether you use it again.`);
    } else {
      // Never call delete() here — deleting an otherwise-untouched cache does not stop
      // billing for the remaining committed TTL. Shrinking the ttl to Gemini's minimum
      // recalculates the bill to match actual usage and lets it auto-expire on its own.
      const shrunk = await shortenCacheTtl(apiKey, cachedContentName, '60s');
      if (shrunk) forgetCacheRegistryEntry(cachedContentName);
      console.log(shrunk
        ? `Cache TTL shortened to 60s (will auto-expire, billed only for actual usage): ${cachedContentName}`
        : `TTL shorten failed — cache left at its full committed TTL (${args.ttl}), will be billed accordingly: ${cachedContentName}`);
    }
  }

  const grandTotal = totalCost + storageCost + cacheCreationCost;
  console.log(
    `\n=== Total cost across ${runResults.length} call(s): $${grandTotal.toFixed(5)} ` +
    `(generation $${totalCost.toFixed(5)}` +
    `${cacheCreationCost ? ` + cache write $${cacheCreationCost.toFixed(5)}` : ''}` +
    `${storageCost ? ` + storage $${storageCost.toFixed(5)}` : ''}) ===`
  );
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
