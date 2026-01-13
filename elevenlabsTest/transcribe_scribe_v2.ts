import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

async function transcribeWithScribeV2() {
  const audioFilePath = '/Users/mia/Downloads/audio3_panhu_baba_mama.m4a';
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is not set');
  }

  const formData = new FormData();
  formData.append('file', fs.createReadStream(audioFilePath), {
    filename: 'audio.m4a',
    contentType: 'audio/mp4'
  });
  formData.append('model_id', 'scribe_v2');
  formData.append('diarize', 'true');
  formData.append('diarization_threshold', '0.1');
  formData.append('temperature', '0');
  formData.append('tag_audio_events', 'false');
  formData.append('timestamps_granularity', 'word');

  console.log('Starting transcription with scribe_v2...');
  console.log('Audio file:', audioFilePath);

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text?include_timestamps=true', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        ...formData.getHeaders()
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const result = await response.json();

    const outputPath = '/Users/mia/nora/elevenlabsTest/scribe_v2_result.json';
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log('Transcription completed successfully!');
    console.log('Result saved to:', outputPath);

    return result;
  } catch (error) {
    console.error('Error during transcription:', error);
    throw error;
  }
}

transcribeWithScribeV2();
