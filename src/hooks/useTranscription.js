import { useCallback } from 'react';
import { transcribe } from '../services/transcriptionService';

const useTranscription = () => {
  const transcribeAudio = useCallback(async (audioBlob) => {
    return transcribe(audioBlob);
  }, []);

  return { transcribe: transcribeAudio };
};

export default useTranscription;
