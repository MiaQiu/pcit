// PCIT Analysis service - handles Claude API calls
// Easily mockable for testing

const API_BASE_URL = 'http://localhost:3001/api';

// Combined speaker identification and PCIT coding
export const analyzeAndCode = async (transcript) => {
  const response = await fetch(`${API_BASE_URL}/speaker-and-coding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ transcript })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
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
  const response = await fetch(`${API_BASE_URL}/competency-analysis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ counts })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  const result = await response.json();
  return result.analysis;
};

// Count PCIT tags from coding text
export const countPcitTags = (codingText) => {
  if (!codingText) return null;

  const counts = {
    describe: (codingText.match(/\[DO:\s*Describe\]/gi) || []).length,
    reflect: (codingText.match(/\[DO:\s*Reflect\]/gi) || []).length,
    praise: (codingText.match(/\[DO:\s*Praise\]/gi) || []).length,
    imitate: (codingText.match(/\[DO:\s*Imitate\]/gi) || []).length,
    question: (codingText.match(/\[DON'T:\s*Question\]/gi) || []).length,
    command: (codingText.match(/\[DON'T:\s*Command\]/gi) || []).length,
    criticism: (codingText.match(/\[DON'T:\s*Criticism\]/gi) || []).length,
    neutral: (codingText.match(/\[Neutral\]/gi) || []).length
  };

  counts.totalPride = counts.describe + counts.reflect + counts.praise + counts.imitate;
  counts.totalAvoid = counts.question + counts.command + counts.criticism;

  return counts;
};

// Health check
export const checkHealth = async () => {
  const response = await fetch(`${API_BASE_URL}/health`);
  return response.json();
};

export default {
  analyzeAndCode,
  getCompetencyAnalysis,
  countPcitTags,
  checkHealth
};
