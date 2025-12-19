/**
 * Process ElevenLabs transcript JSON for LLM analysis
 * Optimized format for speaker identification and labeling
 */

const fs = require('fs');

function processTranscriptForLLM(inputFile, outputFile) {
  console.log(`Reading ${inputFile}...`);

  const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

  if (!data.words || data.words.length === 0) {
    console.error('No words found in transcript');
    return;
  }

  console.log(`Processing ${data.words.length} words...`);

  // Group words into sentences based on punctuation and speaker changes
  const utterances = [];
  let currentUtterance = {
    speaker: null,
    text: '',
    start: null,
    end: null
  };

  for (const word of data.words) {
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
    currentUtterance.text += word.text;
    currentUtterance.end = word.end;

    // Check if this word ends a sentence
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

  console.log(`Grouped into ${utterances.length} utterances\n`);

  // Calculate speaker statistics
  const speakerStats = {};
  utterances.forEach(utt => {
    if (!speakerStats[utt.speaker]) {
      speakerStats[utt.speaker] = {
        utteranceCount: 0,
        totalDuration: 0,
        wordCount: 0,
        avgUtteranceLength: 0
      };
    }
    speakerStats[utt.speaker].utteranceCount++;
    speakerStats[utt.speaker].totalDuration += (utt.end - utt.start);
    speakerStats[utt.speaker].wordCount += utt.text.replace(/[。！？\.\!\?]/g, '').length;
  });

  // Calculate averages
  Object.keys(speakerStats).forEach(speaker => {
    const stats = speakerStats[speaker];
    stats.avgUtteranceLength = (stats.totalDuration / stats.utteranceCount).toFixed(2);
  });

  // Format output for LLM
  let output = '';

  output += '=== TRANSCRIPT FOR SPEAKER IDENTIFICATION ===\n\n';

  output += '## Metadata\n';
  output += `Language: ${data.language_code}\n`;
  output += `Total utterances: ${utterances.length}\n`;
  output += `Number of speakers detected: ${Object.keys(speakerStats).length}\n`;
  output += '\n';

  output += '## Speaker Statistics\n';
  Object.entries(speakerStats)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([speaker, stats]) => {
      output += `${speaker}:\n`;
      output += `  - Utterances: ${stats.utteranceCount}\n`;
      output += `  - Total speaking time: ${stats.totalDuration.toFixed(2)}s\n`;
      output += `  - Avg utterance duration: ${stats.avgUtteranceLength}s\n`;
      output += `  - Character count: ${stats.wordCount}\n`;
    });
  output += '\n';

  output += '## Conversation Transcript\n';
  output += 'Format: [#] speaker_id | start-end time | utterance\n\n';

  utterances.forEach((utt, idx) => {
    const timeRange = `${utt.start.toFixed(2)}-${utt.end.toFixed(2)}s`;
    output += `[${String(idx + 1).padStart(2, '0')}] ${utt.speaker} | ${timeRange.padEnd(14)} | ${utt.text.trim()}\n`;
  });

  output += '\n';
  output += '## Task Instructions\n';
  output += 'Based on the conversation above:\n';
  output += '1. Identify which speaker is the CHILD (look for: shorter utterances, simpler language, says "妈妈/mama", responds to commands)\n';
  output += '2. Identify which speaker(s) are PARENT(S) (look for: gives instructions, asks questions, uses praise, longer utterances)\n';
  output += '3. Provide speaker labels in this format:\n';
  output += '   speaker_0: [child|parent_1|parent_2]\n';
  output += '   speaker_1: [child|parent_1|parent_2]\n';
  output += '   speaker_2: [child|parent_1|parent_2]\n';
  output += '\n';
  output += 'Provide your analysis and labeling below:\n';

  // Save to file
  fs.writeFileSync(outputFile, output, 'utf8');
  console.log(`✓ LLM-optimized transcript saved to: ${outputFile}`);

  // Display to console
  console.log('\n' + output);

  // Also save as JSON for programmatic use
  const jsonOutput = {
    metadata: {
      language: data.language_code,
      languageProbability: data.language_probability,
      totalUtterances: utterances.length,
      speakersDetected: Object.keys(speakerStats).length
    },
    utterances: utterances.map((utt, idx) => ({
      index: idx + 1,
      speaker: utt.speaker,
      startTime: utt.start,
      endTime: utt.end,
      duration: parseFloat((utt.end - utt.start).toFixed(2)),
      text: utt.text.trim()
    }))
  };

  const jsonFile = outputFile.replace('.txt', '.json');
  fs.writeFileSync(jsonFile, JSON.stringify(jsonOutput, null, 2), 'utf8');
  console.log(`✓ JSON format also saved to: ${jsonFile}`);
}

// Process the file
const inputFile = process.argv[2] || '/Users/mia/nora/test_elevenlabs_config1_output.json';
const outputFile = process.argv[3] || '/Users/mia/nora/test_elevenlabs_config1_output_for_llm.txt';

try {
  processTranscriptForLLM(inputFile, outputFile);
  console.log('\n✓ Processing complete');
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
