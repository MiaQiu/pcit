// Transcription service - handles all STT API calls
// Easily mockable for testing

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

// ElevenLabs Scribe - best for similar voices
export const transcribeWithElevenLabs = async (audioBlob) => {
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

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey
    },
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail?.message || `API error: ${response.status}`);
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

  const response = await fetch(
    'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&punctuate=true&utterances=true&multichannel=false',
    {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': contentType
      },
      body: arrayBuffer
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.err_msg || `API error: ${response.status}`);
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

// AssemblyAI
export const transcribeWithAssemblyAI = async (audioBlob) => {
  const apiKey = API_KEYS.assemblyAI;

  if (!apiKey) {
    throw new Error('AssemblyAI API key not configured');
  }

  // Step 1: Upload audio
  const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/octet-stream'
    },
    body: audioBlob
  });

  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: ${uploadResponse.status}`);
  }

  const { upload_url } = await uploadResponse.json();

  // Step 2: Request transcription
  const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
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
  });

  if (!transcriptResponse.ok) {
    throw new Error(`Transcription request failed: ${transcriptResponse.status}`);
  }

  const { id } = await transcriptResponse.json();

  // Step 3: Poll for completion
  let result;
  while (true) {
    const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { 'Authorization': apiKey }
    });

    result = await pollResponse.json();

    if (result.status === 'completed') {
      break;
    } else if (result.status === 'error') {
      throw new Error(result.error || 'Transcription failed');
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
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
  let result = null;

  // Try ElevenLabs first (best for similar voices)
  if (API_KEYS.elevenLabs) {
    try {
      console.log('Trying ElevenLabs Scribe...');
      result = await transcribeWithElevenLabs(audioBlob);
      if (result) return result;
    } catch (err) {
      console.error('ElevenLabs failed:', err);
    }
  }

  // Fallback to Deepgram
  if (API_KEYS.deepgram) {
    try {
      console.log('Trying Deepgram...');
      result = await transcribeWithDeepgram(audioBlob);
      if (result) return result;
    } catch (err) {
      console.error('Deepgram failed:', err);
    }
  }

  // Fallback to AssemblyAI
  if (API_KEYS.assemblyAI) {
    console.log('Trying AssemblyAI...');
    result = await transcribeWithAssemblyAI(audioBlob);
    if (result) return result;
  }

  return null;
};

export default {
  transcribe,
  transcribeWithElevenLabs,
  transcribeWithDeepgram,
  transcribeWithAssemblyAI
};
