/**
 * Parse ElevenLabs JSON response into structured utterances
 * Groups words by speaker and sentence boundaries
 *
 * Based on logic from process-transcript-for-llm.cjs
 */

/**
 * Remove text inside parentheses (e.g., sound effects, background noises)
 * Examples: "(wind)" -> "", "Hello (laughter) there" -> "Hello there"
 *
 * @param {String} text - Text to clean
 * @returns {String} cleaned - Text with parentheses content removed
 */
function removeParenthesesContent(text) {
  return text
    .replace(/\([^)]*\)/g, '') // Remove content inside parentheses
    .replace(/\s+/g, ' ')      // Normalize multiple spaces to single space
    .trim();                    // Remove leading/trailing whitespace
}

/**
 * Parse ElevenLabs API response into structured utterances
 *
 * @param {Object} elevenLabsJson - Raw ElevenLabs API response
 * @returns {Array} utterances - Array of {speaker, text, start, end, duration}
 */
function parseElevenLabsTranscript(elevenLabsJson) {
  if (!elevenLabsJson || !elevenLabsJson.words || elevenLabsJson.words.length === 0) {
    console.warn('No words found in ElevenLabs response');
    return [];
  }

  const words = elevenLabsJson.words;
  const utterances = [];

  let currentUtterance = {
    speaker: null,
    text: '',
    start: null,
    end: null
  };

  for (const word of words) {
    // Skip spacing tokens
    if (word.type === 'spacing') {
      continue;
    }

    // Initialize or check speaker change
    if (currentUtterance.speaker === null) {
      currentUtterance.speaker = word.speaker_id;
      currentUtterance.start = word.start;
    }

    // If speaker changed, save current utterance and start new one
    if (word.speaker_id !== currentUtterance.speaker && currentUtterance.text.trim()) {
      currentUtterance.end = word.start;
      utterances.push({ ...currentUtterance });
      currentUtterance = {
        speaker: word.speaker_id,
        text: '',
        start: word.start,
        end: null
      };
    }

    // Add word to current utterance
    // Add space before word if utterance already has text
    if (currentUtterance.text) {
      currentUtterance.text += ' ' + word.text;
    } else {
      currentUtterance.text = word.text;
    }
    currentUtterance.end = word.end;

    // Check if this word ends a sentence (Chinese or English punctuation)
    const endsWithPunctuation = /[。！？\.\!\?]$/.test(word.text);

    if (endsWithPunctuation && currentUtterance.text.trim()) {
      utterances.push({ ...currentUtterance });
      currentUtterance = {
        speaker: null,
        text: '',
        start: null,
        end: null
      };
    }
  }

  // Add any remaining utterance
  if (currentUtterance.text.trim()) {
    utterances.push(currentUtterance);
  }

  // Add duration and format output
  const formattedUtterances = utterances.map(utt => ({
    speaker: utt.speaker,
    text: removeParenthesesContent(utt.text), // Remove parentheses content
    start: utt.start,
    end: utt.end,
    duration: parseFloat((utt.end - utt.start).toFixed(2))
  }));

  console.log(`Parsed ${formattedUtterances.length} utterances from ElevenLabs response`);

  return formattedUtterances;
}

/**
 * Format utterances as readable text for database storage
 *
 * @param {Array} utterances - Array of utterance objects
 * @returns {String} formatted - Formatted transcript text
 */
function formatUtterancesAsText(utterances) {
  if (!utterances || utterances.length === 0) {
    return '';
  }

  return utterances
    .map((utt, idx) => {
      const timeRange = `${utt.start.toFixed(2)}-${utt.end.toFixed(2)}s`;
      return `[${String(idx + 1).padStart(2, '0')}] ${utt.speaker} | ${timeRange.padEnd(14)} | ${utt.text}`;
    })
    .join('\n');
}

module.exports = {
  parseElevenLabsTranscript,
  formatUtterancesAsText
};
