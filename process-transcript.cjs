/**
 * Process ElevenLabs transcript JSON into readable format
 * Output: "speaker_id: sentence" format
 */

const fs = require('fs');

function processTranscript(inputFile, outputFile) {
  console.log(`Reading ${inputFile}...`);

  // Read the JSON file
  const data = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

  if (!data.words || data.words.length === 0) {
    console.error('No words found in transcript');
    return;
  }

  console.log(`Processing ${data.words.length} words...`);

  // Group words into sentences based on punctuation and speaker changes
  const sentences = [];
  let currentSentence = {
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
    if (currentSentence.speaker === null) {
      currentSentence.speaker = word.speaker_id;
      currentSentence.start = word.start;
    }

    // If speaker changed, save current sentence and start new one
    if (word.speaker_id !== currentSentence.speaker && currentSentence.text.trim()) {
      currentSentence.end = word.start;
      sentences.push({ ...currentSentence });
      currentSentence = {
        speaker: word.speaker_id,
        text: '',
        start: word.start,
        end: null
      };
    }

    // Add word to current sentence
    currentSentence.text += word.text;
    currentSentence.end = word.end;

    // Check if this word ends a sentence (Chinese or English punctuation)
    const endsWithPunctuation = /[。！？\.\!\?]$/.test(word.text);

    if (endsWithPunctuation && currentSentence.text.trim()) {
      sentences.push({ ...currentSentence });
      currentSentence = {
        speaker: null,
        text: '',
        start: null,
        end: null
      };
    }
  }

  // Add any remaining sentence
  if (currentSentence.text.trim()) {
    sentences.push(currentSentence);
  }

  console.log(`Grouped into ${sentences.length} sentences\n`);

  // Format output
  let output = '';
  output += '=== ElevenLabs Transcript - Processed ===\n';
  output += `Language: ${data.language_code} (${(data.language_probability * 100).toFixed(1)}% confidence)\n`;
  output += `Total sentences: ${sentences.length}\n`;
  output += '\n';

  sentences.forEach((sentence, idx) => {
    const timestamp = `[${sentence.start.toFixed(2)}s - ${sentence.end.toFixed(2)}s]`;
    const speakerNum = sentence.speaker.replace('speaker_', '');
    output += `${idx + 1}. ${sentence.speaker}: ${sentence.text.trim()}\n`;
  });

  // Save to file
  fs.writeFileSync(outputFile, output, 'utf8');
  console.log(`\n✓ Processed transcript saved to: ${outputFile}`);

  // Also display to console
  console.log('\n' + output);

  // Summary statistics
  const speakerCounts = {};
  sentences.forEach(s => {
    speakerCounts[s.speaker] = (speakerCounts[s.speaker] || 0) + 1;
  });

  console.log('\n=== Statistics ===');
  console.log('Sentences per speaker:');
  Object.entries(speakerCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([speaker, count]) => {
      console.log(`  ${speaker}: ${count} sentences`);
    });
}

// Process the file
const inputFile = process.argv[2] || '/Users/mia/nora/test_elevenlabs_config1_output.json';
const outputFile = process.argv[3] || '/Users/mia/nora/test_elevenlabs_config1_output_processed.txt';

try {
  processTranscript(inputFile, outputFile);
  console.log('\n✓ Processing complete');
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
