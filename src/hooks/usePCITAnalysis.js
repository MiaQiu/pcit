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

  return {
    analyzeAndCode,
    getCompetencyAnalysis,
    countPcitTags
  };
};

export default usePCITAnalysis;
