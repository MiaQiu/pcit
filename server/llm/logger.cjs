'use strict';

/**
 * Structured LLM call logger.
 * Emits one JSON line per call — easy to grep, aggregate, or pipe to a log sink.
 *
 * Fields:
 *   event        — always "llm_call"
 *   label        — caller identifier (e.g. "pcit-coding")
 *   model        — model ID that actually responded
 *   provider     — "gemini" | "anthropic"
 *   latencyMs    — wall-clock time for the full llmCall()
 *   inputTokens  — prompt token count (null if unavailable)
 *   outputTokens — completion token count (null if unavailable)
 *   hasSchema    — true if Gemini responseSchema was applied
 *   usedFallback — true if primary model failed and fallback was used
 *   usedRepair   — true if jsonrepair fixed malformed JSON
 *   usedRetry    — true if the LLM call was retried after a JSON parse failure
 *   ok           — false if the call ultimately threw
 *   error        — error message snippet (only present when ok=false)
 */
function logLLMCall({
  label,
  model,
  provider,
  latencyMs,
  inputTokens  = null,
  outputTokens = null,
  hasSchema    = false,
  usedFallback = false,
  usedRepair   = false,
  usedRetry    = false,
  ok           = true,
  error        = null,
}) {
  const entry = {
    event: 'llm_call',
    label,
    model,
    provider,
    latencyMs,
    inputTokens,
    outputTokens,
    hasSchema,
    usedFallback,
    usedRepair,
    usedRetry,
    ok,
  };
  if (error) entry.error = String(error).substring(0, 200);
  console.log(JSON.stringify(entry));
}

module.exports = { logLLMCall };
