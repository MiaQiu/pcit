import { useCallback } from 'react';
import * as pcitService from '../services/pcitService';

const usePCITAnalysis = () => {
  const analyzeAndCode = useCallback(async (transcriptData) => {
    // Let errors propagate to caller for proper handling
    return await pcitService.analyzeAndCode(transcriptData);
  }, []);

  const getCompetencyAnalysis = useCallback(async (counts) => {
    // Let errors propagate to caller for proper handling
    return await pcitService.getCompetencyAnalysis(counts);
  }, []);

  const countPcitTags = useCallback((codingText) => {
    return pcitService.countPcitTags(codingText);
  }, []);

  const extractNegativePhraseFlags = useCallback((codingText, transcript) => {
    return pcitService.extractNegativePhraseFlags(codingText, transcript);
  }, []);

  const sendCoachAlert = useCallback(async (flaggedItems, sessionInfo) => {
    return await pcitService.sendCoachAlert(flaggedItems, sessionInfo);
  }, []);

  return {
    analyzeAndCode,
    getCompetencyAnalysis,
    countPcitTags,
    extractNegativePhraseFlags,
    sendCoachAlert
  };
};

export default usePCITAnalysis;
