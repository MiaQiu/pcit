// Transcription service - PDPA compliant with backend proxy
// All requests go through anonymization proxy (no user data sent to third parties)

import fetchWithTimeout from '../utils/fetchWithTimeout';
import authService from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Convert audio blob to base64 for JSON transport
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1]; // Remove data:audio/webm;base64, prefix
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
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

  // Convert to base64
  const audioData = await blobToBase64(audioBlob);

  const response = await authService.authenticatedRequest(
    `${API_URL}/api/transcription/elevenlabs`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audioData,
        audioSize: audioBlob.size
      })
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `ElevenLabs API error: ${response.status}`);
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

  const contentTypeMap = {
    'audio/webm;codecs=opus': 'audio/webm',
    'audio/webm': 'audio/webm',
    'audio/ogg;codecs=opus': 'audio/ogg',
    'audio/mp4': 'audio/mp4',
    'audio/mpeg': 'audio/mpeg'
  };

  const contentType = contentTypeMap[audioBlob.type] || 'audio/webm';

  // Convert to base64
  const audioData = await blobToBase64(audioBlob);

  const response = await authService.authenticatedRequest(
    `${API_URL}/api/transcription/deepgram`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audioData,
        contentType,
        audioSize: audioBlob.size
      })
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Deepgram API error: ${response.status}`);
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

  // Convert to base64
  const audioData = await blobToBase64(audioBlob);

  // Step 1: Submit transcription request
  const response = await authService.authenticatedRequest(
    `${API_URL}/api/transcription/assemblyai`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audioData,
        audioSize: audioBlob.size
      })
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `AssemblyAI request failed: ${response.status}`);
  }

  const { transcription_id, requestId } = await response.json();
  console.log(`[AssemblyAI] Started transcription: ${transcription_id} (request: ${requestId})`);

  // Step 2: Poll for completion with timeout and max retries
  const maxAttempts = 60; // 60 attempts
  const pollInterval = 2000; // 2 seconds between polls
  let attempts = 0;
  let result;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const pollResponse = await authService.authenticatedRequest(
        `${API_URL}/api/transcription/assemblyai/${transcription_id}`,
        {
          method: 'GET'
        }
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

  // Step 3: Format utterances
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
  try {
    console.log('Trying ElevenLabs Scribe (via proxy)...');
    result = await transcribeWithElevenLabs(audioBlob);
    if (result) return result;
  } catch (err) {
    console.error('ElevenLabs failed:', err.message);
    errors.push(`ElevenLabs: ${err.message}`);
  }

  // Fallback to Deepgram
  try {
    console.log('Trying Deepgram (via proxy)...');
    result = await transcribeWithDeepgram(audioBlob);
    if (result) return result;
  } catch (err) {
    console.error('Deepgram failed:', err.message);
    errors.push(`Deepgram: ${err.message}`);
  }

  // Fallback to AssemblyAI
  try {
    console.log('Trying AssemblyAI (via proxy)...');
    result = await transcribeWithAssemblyAI(audioBlob);
    if (result) return result;
  } catch (err) {
    console.error('AssemblyAI failed:', err.message);
    errors.push(`AssemblyAI: ${err.message}`);
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
