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

  const checkCdiMastery = useCallback((counts) => {
    return pcitService.checkCdiMastery(counts);
  }, []);

  const sendCoachAlert = useCallback(async (flaggedItems, sessionInfo) => {
    return await pcitService.sendCoachAlert(flaggedItems, sessionInfo);
  }, []);

  // PDI functions
  const pdiAnalyzeAndCode = useCallback(async (transcriptData) => {
    return await pcitService.pdiAnalyzeAndCode(transcriptData);
  }, []);

  const getPdiCompetencyAnalysis = useCallback(async (counts) => {
    return await pcitService.getPdiCompetencyAnalysis(counts);
  }, []);

  const countPdiTags = useCallback((codingText) => {
    return pcitService.countPdiTags(codingText);
  }, []);

  return {
    // CDI functions
    analyzeAndCode,
    getCompetencyAnalysis,
    countPcitTags,
    extractNegativePhraseFlags,
    checkCdiMastery,
    // PDI functions
    pdiAnalyzeAndCode,
    getPdiCompetencyAnalysis,
    countPdiTags,
    // Shared
    sendCoachAlert
  };
};

export default usePCITAnalysis;
