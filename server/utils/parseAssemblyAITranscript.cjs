/**
 * Parse AssemblyAI JSON response into structured utterances
 * Handles speaker diarization and Chinese text formatting
 *
 * AssemblyAI returns:
 * - Speakers as "A", "B", "C", etc. (need to convert to "speaker_0", "speaker_1", etc.)
 * - Timestamps in milliseconds (need to convert to seconds)
 * - Chinese text with spaces between characters (need to clean up)
 */

/**
 * Remove extra spaces in Chinese text that AssemblyAI adds
 * AssemblyAI adds spaces between Chinese characters: "你 好 吗" -> "你好吗"
 * Keep spaces around English words and punctuation
 *
 * @param {String} text - Text to clean
 * @returns {String} cleaned - Text with proper spacing
 */
function cleanChineseSpacing(text) {
  if (!text) return '';

  // Remove spaces between Chinese characters (Unicode range: 4E00-9FFF)
  // But keep spaces around non-Chinese characters (English, numbers, punctuation)
  let cleaned = text;

  // Repeat the replacement multiple times to handle all consecutive Chinese characters
  // This handles cases like "你 先 玩" -> "你先玩"
  for (let i = 0; i < 10; i++) {
    const before = cleaned;
    cleaned = cleaned.replace(/([一-龥])\s+([一-龥])/g, '$1$2');
    if (before === cleaned) break; // Stop when no more changes
  }

  // Normalize multiple spaces and trim
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Convert AssemblyAI speaker label to numeric speaker ID
 * A -> speaker_0, B -> speaker_1, C -> speaker_2, etc.
 *
 * @param {String} speakerLabel - AssemblyAI speaker label (A, B, C, etc.)
 * @returns {String} speakerId - speaker_0, speaker_1, etc.
 */
function convertSpeakerLabel(speakerLabel) {
  if (!speakerLabel) return 'speaker_0';

  // Convert A=0, B=1, C=2, etc.
  const speakerNum = speakerLabel.charCodeAt(0) - 65;
  return `speaker_${speakerNum}`;
}

/**
 * Parse AssemblyAI API response into structured utterances
 *
 * @param {Object} assemblyAIJson - Raw AssemblyAI API response
 * @returns {Array} utterances - Array of {speaker, text, start, end, duration}
 */
function parseAssemblyAITranscript(assemblyAIJson) {
  if (!assemblyAIJson) {
    console.warn('No AssemblyAI response provided');
    return [];
  }

  const utterances = [];

  // AssemblyAI provides utterances directly (already grouped by speaker)
  if (assemblyAIJson.utterances && assemblyAIJson.utterances.length > 0) {
    assemblyAIJson.utterances.forEach(utt => {
      utterances.push({
        speaker: convertSpeakerLabel(utt.speaker),
        text: cleanChineseSpacing(utt.text),
        start: utt.start / 1000,  // Convert ms to seconds
        end: utt.end / 1000,      // Convert ms to seconds
        duration: parseFloat(((utt.end - utt.start) / 1000).toFixed(2)),
        confidence: utt.confidence
      });
    });
  }
  // Fallback: if no utterances but we have words, group them by speaker
  else if (assemblyAIJson.words && assemblyAIJson.words.length > 0) {
    console.log('No utterances found, grouping words by speaker...');

    let currentUtterance = {
      speaker: null,
      text: '',
      start: null,
      end: null,
      words: []
    };

    for (const word of assemblyAIJson.words) {
      // Initialize or check speaker change
      if (currentUtterance.speaker === null) {
        currentUtterance.speaker = word.speaker;
        currentUtterance.start = word.start;
      }

      // If speaker changed, save current utterance and start new one
      if (word.speaker !== currentUtterance.speaker && currentUtterance.text.trim()) {
        currentUtterance.end = currentUtterance.words[currentUtterance.words.length - 1].end;
        utterances.push({
          speaker: convertSpeakerLabel(currentUtterance.speaker),
          text: cleanChineseSpacing(currentUtterance.text),
          start: currentUtterance.start / 1000,
          end: currentUtterance.end / 1000,
          duration: parseFloat(((currentUtterance.end - currentUtterance.start) / 1000).toFixed(2))
        });

        currentUtterance = {
          speaker: word.speaker,
          text: '',
          start: word.start,
          end: null,
          words: []
        };
      }

      // Add word to current utterance
      currentUtterance.words.push(word);
      if (currentUtterance.text) {
        currentUtterance.text += ' ' + word.text;
      } else {
        currentUtterance.text = word.text;
      }
    }

    // Add any remaining utterance
    if (currentUtterance.text.trim() && currentUtterance.words.length > 0) {
      currentUtterance.end = currentUtterance.words[currentUtterance.words.length - 1].end;
      utterances.push({
        speaker: convertSpeakerLabel(currentUtterance.speaker),
        text: cleanChineseSpacing(currentUtterance.text),
        start: currentUtterance.start / 1000,
        end: currentUtterance.end / 1000,
        duration: parseFloat(((currentUtterance.end - currentUtterance.start) / 1000).toFixed(2))
      });
    }
  }
  // Fallback: if no words or utterances, use the full text
  else if (assemblyAIJson.text) {
    console.log('No utterances or words found, using full text...');
    utterances.push({
      speaker: 'speaker_0',
      text: cleanChineseSpacing(assemblyAIJson.text),
      start: 0,
      end: 0,
      duration: 0
    });
  }

  console.log(`Parsed ${utterances.length} utterances from AssemblyAI response`);

  return utterances;
}

/**
 * Format utterances as readable text for database storage
 * Same format as ElevenLabs parser for consistency
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
  parseAssemblyAITranscript,
  formatUtterancesAsText,
  cleanChineseSpacing,
  convertSpeakerLabel
};
