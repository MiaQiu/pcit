import type AuthService from './authService';
import type { TranscriptionSegment } from '../types';

/**
 * Transcription Service
 * PDPA compliant with backend proxy - all requests go through anonymization proxy
 * (no user data sent to third parties)
 */
class TranscriptionService {
  private authService: AuthService;
  private apiUrl: string;

  constructor(authService: AuthService, apiUrl: string) {
    this.authService = authService;
    this.apiUrl = apiUrl;
  }

  /**
   * Convert audio blob to base64 for JSON transport
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1]; // Remove data:audio/webm;base64, prefix
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Parse ElevenLabs speaker_id string to number
   */
  private parseSpeakerId(speakerId: string | undefined): number {
    if (!speakerId) return 0;
    const match = speakerId.match(/speaker_(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Validate audio blob input
   */
  private validateAudioBlob(audioBlob: Blob): void {
    if (!audioBlob) {
      throw new Error('No audio data provided');
    }
    if (!(audioBlob instanceof Blob)) {
      throw new Error('Invalid audio format');
    }
    if (audioBlob.size === 0) {
      throw new Error('Audio recording is empty');
    }
  }

  /**
   * ElevenLabs Scribe - best for similar voices
   */
  async transcribeWithElevenLabs(audioBlob: Blob): Promise<TranscriptionSegment[] | null> {
    this.validateAudioBlob(audioBlob);

    // Convert to base64
    const audioData = await this.blobToBase64(audioBlob);

    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/transcription/elevenlabs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData,
          audioSize: audioBlob.size,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `ElevenLabs API error: ${response.status}`);
    }

    const result = await response.json();

    // Group words by speaker into utterances
    if (result.words && result.words.length > 0) {
      const utterances: TranscriptionSegment[] = [];
      let currentUtterance: TranscriptionSegment = {
        speaker: this.parseSpeakerId(result.words[0].speaker_id).toString(),
        text: '',
        start: result.words[0].start,
        end: result.words[0].end,
      };

      for (const word of result.words) {
        const speakerId = this.parseSpeakerId(word.speaker_id);

        if (speakerId.toString() === currentUtterance.speaker) {
          currentUtterance.text += (currentUtterance.text ? ' ' : '') + word.text;
          currentUtterance.end = word.end;
        } else {
          if (currentUtterance.text) {
            utterances.push(currentUtterance);
          }
          currentUtterance = {
            speaker: speakerId.toString(),
            text: word.text,
            start: word.start,
            end: word.end,
          };
        }
      }

      if (currentUtterance.text) {
        utterances.push(currentUtterance);
      }

      return utterances;
    } else if (result.text) {
      return [
        {
          speaker: '0',
          text: result.text,
          start: 0,
          end: 0,
        },
      ];
    }

    return null;
  }

  /**
   * Deepgram Nova-2
   */
  async transcribeWithDeepgram(audioBlob: Blob): Promise<TranscriptionSegment[] | null> {
    this.validateAudioBlob(audioBlob);

    const contentTypeMap: { [key: string]: string } = {
      'audio/webm;codecs=opus': 'audio/webm',
      'audio/webm': 'audio/webm',
      'audio/ogg;codecs=opus': 'audio/ogg',
      'audio/mp4': 'audio/mp4',
      'audio/mpeg': 'audio/mpeg',
    };

    const contentType = contentTypeMap[audioBlob.type] || 'audio/webm';

    // Convert to base64
    const audioData = await this.blobToBase64(audioBlob);

    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/transcription/deepgram`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData,
          contentType,
          audioSize: audioBlob.size,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Deepgram API error: ${response.status}`);
    }

    const result = await response.json();

    if (result.results?.utterances) {
      return result.results.utterances.map((utterance: any) => ({
        speaker: utterance.speaker.toString(),
        text: utterance.transcript,
        start: utterance.start,
        end: utterance.end,
      }));
    } else if (result.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
      return [
        {
          speaker: '0',
          text: result.results.channels[0].alternatives[0].transcript,
          start: 0,
          end: 0,
        },
      ];
    }

    return null;
  }

  /**
   * AssemblyAI with timeout and max retries
   */
  async transcribeWithAssemblyAI(audioBlob: Blob): Promise<TranscriptionSegment[] | null> {
    this.validateAudioBlob(audioBlob);

    // Convert to base64
    const audioData = await this.blobToBase64(audioBlob);

    // Step 1: Submit transcription request
    const response = await this.authService.authenticatedRequest(
      `${this.apiUrl}/api/transcription/assemblyai`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audioData,
          audioSize: audioBlob.size,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `AssemblyAI request failed: ${response.status}`
      );
    }

    const { transcription_id, requestId } = await response.json();
    console.log(
      `[AssemblyAI] Started transcription: ${transcription_id} (request: ${requestId})`
    );

    // Step 2: Poll for completion with timeout and max retries
    const maxAttempts = 60; // 60 attempts
    const pollInterval = 2000; // 2 seconds between polls
    let attempts = 0;
    let result: any;

    while (attempts < maxAttempts) {
      attempts++;

      try {
        const pollResponse = await this.authService.authenticatedRequest(
          `${this.apiUrl}/api/transcription/assemblyai/${transcription_id}`,
          {
            method: 'GET',
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
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (err: any) {
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
      return result.utterances.map((utterance: any) => ({
        speaker: (utterance.speaker.charCodeAt(0) - 65).toString(),
        text: utterance.text,
        start: utterance.start,
        end: utterance.end,
      }));
    } else if (result.text) {
      return [
        {
          speaker: '0',
          text: result.text,
          start: 0,
          end: 0,
        },
      ];
    }

    return null;
  }

  /**
   * Main transcription function with automatic fallbacks
   */
  async transcribe(audioBlob: Blob): Promise<TranscriptionSegment[] | null> {
    // Validate input first
    this.validateAudioBlob(audioBlob);

    let result: TranscriptionSegment[] | null = null;
    const errors: string[] = [];

    // Try ElevenLabs first (best for similar voices)
    try {
      console.log('Trying ElevenLabs Scribe (via proxy)...');
      result = await this.transcribeWithElevenLabs(audioBlob);
      if (result) return result;
    } catch (err: any) {
      console.error('ElevenLabs failed:', err.message);
      errors.push(`ElevenLabs: ${err.message}`);
    }

    // Fallback to Deepgram
    try {
      console.log('Trying Deepgram (via proxy)...');
      result = await this.transcribeWithDeepgram(audioBlob);
      if (result) return result;
    } catch (err: any) {
      console.error('Deepgram failed:', err.message);
      errors.push(`Deepgram: ${err.message}`);
    }

    // Fallback to AssemblyAI
    try {
      console.log('Trying AssemblyAI (via proxy)...');
      result = await this.transcribeWithAssemblyAI(audioBlob);
      if (result) return result;
    } catch (err: any) {
      console.error('AssemblyAI failed:', err.message);
      errors.push(`AssemblyAI: ${err.message}`);
    }

    // If all services failed, throw with details
    if (errors.length > 0) {
      throw new Error(`All transcription services failed: ${errors.join('; ')}`);
    }

    return null;
  }
}

export default TranscriptionService;
