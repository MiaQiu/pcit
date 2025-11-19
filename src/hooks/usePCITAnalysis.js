import { useCallback } from 'react';
import * as pcitService from '../services/pcitService';

const usePCITAnalysis = () => {
  const analyzeAndCode = useCallback(async (transcriptData) => {
    try {
      return await pcitService.analyzeAndCode(transcriptData);
    } catch (err) {
      console.error('Analysis and coding error:', err);
      return null;
    }
  }, []);

  const getCompetencyAnalysis = useCallback(async (counts) => {
    try {
      return await pcitService.getCompetencyAnalysis(counts);
    } catch (err) {
      console.error('Competency analysis error:', err);
      return null;
    }
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
