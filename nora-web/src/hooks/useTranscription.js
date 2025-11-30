import { useCallback } from 'react';
import { transcribe } from '../services/transcriptionService';

const useTranscription = () => {
  const transcribeAudio = useCallback(async (audioBlob) => {
    // Let errors propagate to caller for proper handling
    return await transcribe(audioBlob);
  }, []);

  return { transcribe: transcribeAudio };
};

export default useTranscription;
