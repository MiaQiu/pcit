/**
 * DPICS Behavioral Segmenter
 * Re-segments ElevenLabs utterances according to DPICS Complete Thought rules.
 * Runs between parseElevenLabsTranscript and createUtterances.
 */

const { llmCall } = require('../llm/gateway.cjs');
const { loadPromptWithVariables } = require('../prompts/index.cjs');

// ─── Token normalisation ────────────────────────────────────────────────────
// Strip punctuation and lowercase so "barn." matches ElevenLabs word "barn",
// "You" matches "you", etc.  CJK characters are kept as-is.
function normaliseToken(str) {
  return str.toLowerCase().replace(/[^\w一-鿿]/g, '');
}

function tokenise(text) {
  return text.trim().split(/\s+/).map(normaliseToken).filter(Boolean);
}

// ─── Timestamp recovery ─────────────────────────────────────────────────────
/**
 * Assign start/end timestamps to each segment by walking the ElevenLabs
 * word-level data in order.  Falls back to proportional splitting if word
 * matching fails to cover a segment.
 *
 * @param {string[]}   segments          - Text of each sub-sentence
 * @param {Object}     originalUtterance - The pre-split utterance {speaker,start,end}
 * @param {Object[]}   allWords          - Full ElevenLabs words array
 * @returns {Object[]} Utterance-shaped objects with recovered timestamps
 */
function recoverTimestamps(segments, originalUtterance, allWords) {
  const BUFFER = 0.15; // seconds — absorbs minor float drift at boundaries

  // Words that belong to this utterance, in time order, spacing removed
  const uttWords = allWords
    .filter(w =>
      w.type !== 'spacing' &&
      w.start >= originalUtterance.start - BUFFER &&
      w.end   <= originalUtterance.end   + BUFFER
    )
    .sort((a, b) => a.start - b.start);

  // ── Word-level matching ───────────────────────────────────────────────────
  let wordCursor = 0;
  const timed = [];

  for (let si = 0; si < segments.length; si++) {
    const segText   = segments[si];
    const segTokens = tokenise(segText);

    const startWord = uttWords[wordCursor];
    let segStart = startWord?.start ?? originalUtterance.start;
    let segEnd   = segStart;
    let wordsConsumed = 0;

    for (let ti = 0; ti < segTokens.length; ti++) {
      if (wordCursor >= uttWords.length) break;

      const wordNorm = normaliseToken(uttWords[wordCursor].text);
      if (wordNorm === segTokens[ti] || wordNorm === '') {
        segEnd = uttWords[wordCursor].end;
        wordCursor++;
        wordsConsumed++;
      } else {
        // Mismatch — advance past the ElevenLabs word anyway to stay in sync
        segEnd = uttWords[wordCursor].end;
        wordCursor++;
        wordsConsumed++;
      }
    }

    timed.push({ wordsConsumed, segStart, segEnd, segText });
  }

  // ── Fallback: proportional split if any segment got 0 words ──────────────
  const anyEmpty = timed.some(t => t.wordsConsumed === 0);
  if (anyEmpty) {
    const totalChars   = segments.reduce((s, t) => s + t.length, 0);
    const totalDuration = originalUtterance.end - originalUtterance.start;
    let cursor = originalUtterance.start;

    return segments.map(text => {
      const ratio  = totalChars > 0 ? text.length / totalChars : 1 / segments.length;
      const end    = parseFloat((cursor + totalDuration * ratio).toFixed(3));
      const result = {
        speaker:  originalUtterance.speaker,
        text,
        start:    parseFloat(cursor.toFixed(3)),
        end,
        duration: parseFloat((end - cursor).toFixed(2))
      };
      cursor = end;
      return result;
    });
  }

  // ── Extend last segment to original utterance boundary ───────────────────
  const last = timed[timed.length - 1];
  last.segEnd = Math.max(last.segEnd, originalUtterance.end);

  return timed.map(({ segStart, segEnd, segText }) => ({
    speaker:  originalUtterance.speaker,
    text:     segText,
    start:    parseFloat(segStart.toFixed(3)),
    end:      parseFloat(segEnd.toFixed(3)),
    duration: parseFloat((segEnd - segStart).toFixed(2))
  }));
}

// ─── Main export ─────────────────────────────────────────────────────────────
/**
 * Re-segment a parsed utterance array according to DPICS Complete Thought rules.
 * Calls the LLM once with the full transcript; only utterances that need splitting
 * are returned by the model (sparse output).
 *
 * @param {Object[]} utterances - Output of parseElevenLabsTranscript
 * @param {Object[]} words      - Raw ElevenLabs words array (for timestamp recovery)
 * @returns {Promise<Object[]>} Corrected utterances (same shape, potentially more rows)
 */
async function reSegmentUtterances(utterances, words) {
  if (!utterances?.length || !words?.length) return utterances;

  const transcriptJson = utterances.map((u, idx) => ({
    id:      idx,
    speaker: u.speaker,
    text:    u.text
  }));

  const prompt = loadPromptWithVariables('DPICS-Behavioral-Segmenter', {
    TRANSCRIPT_JSON: JSON.stringify(transcriptJson, null, 2)
  });

  let splitResults;
  console.log(`📝 [DPICS-SEGMENTER] Re-segmenting ${utterances.length} utterances...`);
  try {
    splitResults = await llmCall(prompt, {
      model:       'gemini-3.5-flash',
      output:      'array',
      temperature: 0,
      maxTokens:   8192,
      label:       'dpics-segmenter'
    });
  } catch (err) {
    console.warn(`⚠️ [DPICS-SEGMENTER] Flash failed (${err.message}), retrying with Pro 3...`);
    try {
      splitResults = await llmCall(prompt, {
        model:       'gemini-3.1-pro-preview',
        output:      'array',
        temperature: 0,
        maxTokens:   8192,
        label:       'dpics-segmenter-fallback'
      });
    } catch (err2) {
      console.warn(`⚠️ [DPICS-SEGMENTER] Pro 3 also failed (${err2.message}), keeping original utterances`);
      return utterances;
    }
  }

  if (!Array.isArray(splitResults) || splitResults.length === 0) {
    console.log(`✅ [DPICS-SEGMENTER] No utterances required re-segmentation`);
    return utterances;
  }

  // Build map: original index → segments[]  (only valid multi-segment entries)
  const splitMap = new Map();
  for (const item of splitResults) {
    if (
      typeof item.id === 'number' &&
      Array.isArray(item.segments) &&
      item.segments.length > 1 &&
      item.id >= 0 &&
      item.id < utterances.length
    ) {
      splitMap.set(item.id, item.segments);
    }
  }

  if (splitMap.size === 0) {
    console.log(`✅ [DPICS-SEGMENTER] LLM returned no valid splits`);
    return utterances;
  }

  // Rebuild array, splicing in sub-sentences where needed
  const corrected = [];
  for (let i = 0; i < utterances.length; i++) {
    if (!splitMap.has(i)) {
      corrected.push(utterances[i]);
      continue;
    }

    const segments     = splitMap.get(i);
    const timedSegments = recoverTimestamps(segments, utterances[i], words);
    corrected.push(...timedSegments);
    console.log(`   [${i}] split into ${segments.length}: "${utterances[i].text.substring(0, 60)}..."`);
  }

  console.log(`✅ [DPICS-SEGMENTER] ${utterances.length} → ${corrected.length} utterances`);
  return corrected;
}

module.exports = { reSegmentUtterances, recoverTimestamps };
