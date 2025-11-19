// PCIT Analysis service - handles Claude API calls
// Easily mockable for testing

import fetchWithTimeout from '../utils/fetchWithTimeout';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// Validate transcript input
const validateTranscript = (transcript) => {
  if (!transcript) {
    throw new Error('No transcript provided');
  }
  if (!Array.isArray(transcript)) {
    throw new Error('Transcript must be an array');
  }
  if (transcript.length === 0) {
    throw new Error('Transcript is empty');
  }
  // Validate each utterance has required fields
  for (let i = 0; i < transcript.length; i++) {
    const utterance = transcript[i];
    if (typeof utterance.speaker !== 'number') {
      throw new Error(`Invalid speaker at index ${i}`);
    }
    if (typeof utterance.text !== 'string' || !utterance.text.trim()) {
      throw new Error(`Invalid or empty text at index ${i}`);
    }
  }
};

// Validate counts input
const validateCounts = (counts) => {
  if (!counts || typeof counts !== 'object') {
    throw new Error('Invalid counts object');
  }
  const requiredFields = ['praise', 'reflect', 'describe', 'imitate', 'question', 'command', 'criticism', 'negative_phrases', 'neutral'];
  for (const field of requiredFields) {
    if (typeof counts[field] !== 'number') {
      throw new Error(`Missing or invalid count for: ${field}`);
    }
  }
};

// Combined speaker identification and PCIT coding
export const analyzeAndCode = async (transcript) => {
  validateTranscript(transcript);

  const response = await fetchWithTimeout(
    `${API_BASE_URL}/speaker-and-coding`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transcript })
    },
    120000 // 2 min timeout for Claude API
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Analysis failed: ${response.status}`);
  }

  const result = await response.json();
  return {
    parentSpeaker: result.parentSpeaker,
    coding: result.coding,
    fullResponse: result.fullResponse
  };
};

// Get competency analysis
export const getCompetencyAnalysis = async (counts) => {
  validateCounts(counts);

  const response = await fetchWithTimeout(
    `${API_BASE_URL}/competency-analysis`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ counts })
    },
    120000 // 2 min timeout for Claude API
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Competency analysis failed: ${response.status}`);
  }

  const result = await response.json();
  return result.analysis;
};

// Count PCIT tags from coding text
export const countPcitTags = (codingText) => {
  if (!codingText) return null;
  if (typeof codingText !== 'string') {
    console.error('countPcitTags: expected string, got', typeof codingText);
    return null;
  }

  const counts = {
    describe: (codingText.match(/\[DO:\s*Describe\]/gi) || []).length,
    reflect: (codingText.match(/\[DO:\s*Reflect\]/gi) || []).length,
    praise: (codingText.match(/\[DO:\s*Praise\]/gi) || []).length,
    imitate: (codingText.match(/\[DO:\s*Imitate\]/gi) || []).length,
    question: (codingText.match(/\[DON'T:\s*Question\]/gi) || []).length,
    command: (codingText.match(/\[DON'T:\s*Command\]/gi) || []).length,
    criticism: (codingText.match(/\[DON'T:\s*Criticism\]/gi) || []).length,
    negative_phrases: (codingText.match(/\[DON'T:\s*Negative\s*Phrases?\]/gi) || []).length,
    neutral: (codingText.match(/\[Neutral\]/gi) || []).length
  };

  counts.totalPride = counts.describe + counts.reflect + counts.praise + counts.imitate;
  counts.totalAvoid = counts.question + counts.command + counts.criticism + counts.negative_phrases;

  return counts;
};

// Extract utterances flagged with negative phrases for human review
export const extractNegativePhraseFlags = (codingText, transcript) => {
  if (!codingText || !transcript || !Array.isArray(transcript)) {
    return [];
  }

  const flaggedItems = [];

  // Find all lines with negative phrases tag
  const lines = codingText.split('\n');
  for (const line of lines) {
    if (/\[DON'T:\s*Negative\s*Phrases?\]/i.test(line)) {
      // Extract the quoted dialogue from the line
      const dialogueMatch = line.match(/[""]([^""]+)[""]/);
      if (dialogueMatch) {
        const dialogue = dialogueMatch[1].trim().toLowerCase();

        // Find matching utterance in transcript to get timestamp
        for (const utterance of transcript) {
          if (utterance.text && utterance.text.toLowerCase().includes(dialogue.substring(0, 20))) {
            flaggedItems.push({
              text: utterance.text,
              speaker: utterance.speaker,
              timestamp: utterance.start || utterance.timestamp || 0,
              reason: 'Negative phrase detected - requires human coach review'
            });
            break;
          }
        }

        // If no timestamp match found, still flag it without timestamp
        if (flaggedItems.length === 0 || flaggedItems[flaggedItems.length - 1].text !== dialogueMatch[1]) {
          flaggedItems.push({
            text: dialogueMatch[1],
            speaker: null,
            timestamp: null,
            reason: 'Negative phrase detected - requires human coach review'
          });
        }
      }
    }
  }

  return flaggedItems;
};

// Send coach alert email
export const sendCoachAlert = async (flaggedItems, sessionInfo = null) => {
  if (!flaggedItems || flaggedItems.length === 0) {
    throw new Error('No flagged items to send');
  }

  const response = await fetchWithTimeout(
    `${API_BASE_URL}/send-coach-alert`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ flaggedItems, sessionInfo })
    },
    30000 // 30s timeout for email
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to send alert: ${response.status}`);
  }

  return response.json();
};

// Health check
export const checkHealth = async () => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/health`, {}, 5000);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
  } catch (err) {
    throw new Error(`Backend unavailable: ${err.message}`);
  }
};

export default {
  analyzeAndCode,
  getCompetencyAnalysis,
  countPcitTags,
  extractNegativePhraseFlags,
  sendCoachAlert,
  checkHealth
};
