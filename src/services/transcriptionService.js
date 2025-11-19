// Transcription service - handles all STT API calls
// Easily mockable for testing

import fetchWithTimeout from '../utils/fetchWithTimeout';

const API_KEYS = {
  get elevenLabs() {
    return import.meta.env.VITE_ELEVENLABS_API_KEY;
  },
  get deepgram() {
    return import.meta.env.VITE_DEEPGRAM_API_KEY;
  },
  get assemblyAI() {
    return import.meta.env.VITE_ASSEMBLYAI_API_KEY;
  }
};

// Parse ElevenLabs speaker_id string to number
const parseSpeakerId = (speakerId) => {
  if (!speakerId) return 0;
  const match = speakerId.match(/speaker_(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

// Validate audio blob input
const validateAudioBlob = (audioBlob) => {
  if (!audioBlob) {
    throw new Error('No audio data provided');
  }
  if (!(audioBlob instanceof Blob)) {
    throw new Error('Invalid audio format');
  }
  if (audioBlob.size === 0) {
    throw new Error('Audio recording is empty');
  }
};

// ElevenLabs Scribe - best for similar voices
export const transcribeWithElevenLabs = async (audioBlob) => {
  validateAudioBlob(audioBlob);

  const apiKey = API_KEYS.elevenLabs;
  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  formData.append('model_id', 'scribe_v1');
  formData.append('diarize', 'true');
  formData.append('num_speakers', '2');
  formData.append('timestamps_granularity', 'word');

  const response = await fetchWithTimeout(
    'https://api.elevenlabs.io/v1/speech-to-text',
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey
      },
      body: formData
    },
    60000 // 60s timeout for audio processing
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail?.message || `ElevenLabs API error: ${response.status}`);
  }

  const result = await response.json();

  // Group words by speaker into utterances
  if (result.words && result.words.length > 0) {
    const utterances = [];
    let currentUtterance = {
      speaker: parseSpeakerId(result.words[0].speaker_id),
      text: '',
      start: result.words[0].start,
      end: result.words[0].end
    };

    for (const word of result.words) {
      const speakerId = parseSpeakerId(word.speaker_id);

      if (speakerId === currentUtterance.speaker) {
        currentUtterance.text += (currentUtterance.text ? ' ' : '') + word.text;
        currentUtterance.end = word.end;
      } else {
        if (currentUtterance.text) {
          utterances.push(currentUtterance);
        }
        currentUtterance = {
          speaker: speakerId,
          text: word.text,
          start: word.start,
          end: word.end
        };
      }
    }

    if (currentUtterance.text) {
      utterances.push(currentUtterance);
    }

    return utterances;
  } else if (result.text) {
    return [{
      speaker: 0,
      text: result.text,
      start: 0,
      end: 0
    }];
  }

  return null;
};

// Deepgram Nova-2
export const transcribeWithDeepgram = async (audioBlob) => {
  validateAudioBlob(audioBlob);

  const apiKey = API_KEYS.deepgram;
  if (!apiKey) {
    throw new Error('Deepgram API key not configured');
  }

  const arrayBuffer = await audioBlob.arrayBuffer();

  const contentTypeMap = {
    'audio/webm;codecs=opus': 'audio/webm',
    'audio/webm': 'audio/webm',
    'audio/ogg;codecs=opus': 'audio/ogg',
    'audio/mp4': 'audio/mp4',
    'audio/mpeg': 'audio/mpeg'
  };

  const contentType = contentTypeMap[audioBlob.type] || 'audio/webm';

  const response = await fetchWithTimeout(
    'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&punctuate=true&utterances=true&multichannel=false',
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': contentType
      },
      body: arrayBuffer
    },
    60000 // 60s timeout
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.err_msg || `Deepgram API error: ${response.status}`);
  }

  const result = await response.json();

  if (result.results?.utterances) {
    return result.results.utterances.map(utterance => ({
      speaker: utterance.speaker,
      text: utterance.transcript,
      start: utterance.start,
      end: utterance.end
    }));
  } else if (result.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
    return [{
      speaker: 0,
      text: result.results.channels[0].alternatives[0].transcript,
      start: 0,
      end: 0
    }];
  }

  return null;
};

// AssemblyAI with timeout and max retries
export const transcribeWithAssemblyAI = async (audioBlob) => {
  validateAudioBlob(audioBlob);

  const apiKey = API_KEYS.assemblyAI;
  if (!apiKey) {
    throw new Error('AssemblyAI API key not configured');
  }

  // Step 1: Upload audio
  const uploadResponse = await fetchWithTimeout(
    'https://api.assemblyai.com/v2/upload',
    {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/octet-stream'
      },
      body: audioBlob
    },
    60000 // 60s timeout for upload
  );

  if (!uploadResponse.ok) {
    throw new Error(`AssemblyAI upload failed: ${uploadResponse.status}`);
  }

  const { upload_url } = await uploadResponse.json();

  // Step 2: Request transcription
  const transcriptResponse = await fetchWithTimeout(
    'https://api.assemblyai.com/v2/transcript',
    {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: upload_url,
        speaker_labels: true,
        speakers_expected: 2
      })
    },
    30000
  );

  if (!transcriptResponse.ok) {
    throw new Error(`AssemblyAI transcription request failed: ${transcriptResponse.status}`);
  }

  const { id } = await transcriptResponse.json();

  // Step 3: Poll for completion with timeout and max retries
  const maxAttempts = 60; // 60 attempts
  const pollInterval = 2000; // 2 seconds between polls
  let attempts = 0;
  let result;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const pollResponse = await fetchWithTimeout(
        `https://api.assemblyai.com/v2/transcript/${id}`,
        {
          headers: { 'Authorization': apiKey }
        },
        10000 // 10s timeout per poll
      );

      if (!pollResponse.ok) {
        throw new Error(`Poll request failed: ${pollResponse.status}`);
      }

      result = await pollResponse.json();

      if (result.status === 'completed') {
        break;
      } else if (result.status === 'error') {
        throw new Error(result.error || 'AssemblyAI transcription failed');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (err) {
      // If it's a timeout on poll, continue trying
      if (err.message.includes('timeout') && attempts < maxAttempts) {
        continue;
      }
      throw err;
    }
  }

  if (attempts >= maxAttempts) {
    throw new Error('AssemblyAI transcription timed out after 2 minutes');
  }

  // Step 4: Format utterances
  if (result.utterances && result.utterances.length > 0) {
    return result.utterances.map(utterance => ({
      speaker: utterance.speaker.charCodeAt(0) - 65,
      text: utterance.text,
      start: utterance.start,
      end: utterance.end
    }));
  } else if (result.text) {
    return [{
      speaker: 0,
      text: result.text,
      start: 0,
      end: 0
    }];
  }

  return null;
};

// Main transcription function with automatic fallbacks
export const transcribe = async (audioBlob) => {
  // Validate input first
  validateAudioBlob(audioBlob);

  let result = null;
  const errors = [];

  // Try ElevenLabs first (best for similar voices)
  if (API_KEYS.elevenLabs) {
    try {
      console.log('Trying ElevenLabs Scribe...');
      result = await transcribeWithElevenLabs(audioBlob);
      if (result) return result;
    } catch (err) {
      console.error('ElevenLabs failed:', err.message);
      errors.push(`ElevenLabs: ${err.message}`);
    }
  }

  // Fallback to Deepgram
  if (API_KEYS.deepgram) {
    try {
      console.log('Trying Deepgram...');
      result = await transcribeWithDeepgram(audioBlob);
      if (result) return result;
    } catch (err) {
      console.error('Deepgram failed:', err.message);
      errors.push(`Deepgram: ${err.message}`);
    }
  }

  // Fallback to AssemblyAI
  if (API_KEYS.assemblyAI) {
    try {
      console.log('Trying AssemblyAI...');
      result = await transcribeWithAssemblyAI(audioBlob);
      if (result) return result;
    } catch (err) {
      console.error('AssemblyAI failed:', err.message);
      errors.push(`AssemblyAI: ${err.message}`);
    }
  }

  // If all services failed, throw with details
  if (errors.length > 0) {
    throw new Error(`All transcription services failed: ${errors.join('; ')}`);
  }

  return null;
};

export default {
  transcribe,
  transcribeWithElevenLabs,
  transcribeWithDeepgram,
  transcribeWithAssemblyAI
};
