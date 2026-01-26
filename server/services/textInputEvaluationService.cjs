/**
 * Text Input Evaluation Service
 * Uses Claude AI to evaluate user responses in text input exercises
 */
const { callClaudeForFeedback } = require('./claudeService.cjs');

const SYSTEM_PROMPT = `You are evaluating a parent's response in PCIT (Parent-Child Interaction Therapy) training.
Be supportive and encouraging. Focus on what they did well first.
Provide specific, actionable suggestions with a warm, coaching tone.
Remember that parents are learning new skills and may feel vulnerable - be kind.`;

/**
 * Evaluate a user's text input response against an ideal answer
 * @param {Object} params - Evaluation parameters
 * @param {string} params.prompt - The exercise prompt/question shown to the user
 * @param {string} params.idealAnswer - The expected/ideal answer for comparison
 * @param {string} params.userAnswer - The user's submitted answer
 * @param {string} [params.aiCheckMode='AI-Check'] - Mode: 'AI-Check' or 'Ideal'
 * @returns {Promise<Object>} Evaluation result with isCorrect, score, feedback, suggestions
 */
async function evaluateTextInput({ prompt, idealAnswer, userAnswer, aiCheckMode = 'AI-Check' }) {
  if (!userAnswer || userAnswer.trim().length === 0) {
    return {
      isCorrect: false,
      score: 0,
      feedback: "Please enter a response before submitting.",
      suggestions: []
    };
  }

  const evaluationPrompt = `
## PCIT Training Exercise

### Exercise Prompt:
${prompt}

### Ideal/Expected Answer:
${idealAnswer}

### Parent's Response:
${userAnswer}

### Instructions:
Evaluate the parent's response compared to the ideal answer. Consider:
1. Does their response capture the key concepts from the ideal answer?
2. Is their phrasing positive and direct (for commands)?
3. Would this response be effective in a PCIT context?

Respond with a JSON object containing:
- "isCorrect": true if the response is acceptable (doesn't need to be word-for-word, just captures the intent)
- "score": 0-100 representing how close to ideal the response is
- "feedback": 1-2 encouraging sentences about what they did well and/or what to improve. do not mention pcit, therapy or clinical terms.
- "suggestions": array of 0-2 specific, actionable suggestions for improvement (empty if perfect). do not mention pcit, therapy or clinical terms.

Example response format:
{
  "isCorrect": true,
  "score": 85,
  "feedback": "Great job! Your command is direct and positively stated. You've captured the essence of an effective command.",
  "suggestions": ["Consider being more specific about the location."]
}`;

  try {
    const result = await callClaudeForFeedback(evaluationPrompt, {
      temperature: 0.3, // Lower temperature for consistent evaluations
      maxTokens: 512,
      systemPrompt: SYSTEM_PROMPT,
      model: 'claude-sonnet-4-5-20250929'
    });

    // Validate and normalize the response
    return {
      isCorrect: Boolean(result.isCorrect),
      score: Math.min(100, Math.max(0, parseInt(result.score) || 0)),
      feedback: result.feedback || "Your response has been evaluated.",
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : []
    };
  } catch (error) {
    console.error('Error evaluating text input:', error);

    // Fallback: Do a simple comparison if Claude fails
    const normalizedUser = userAnswer.toLowerCase().trim();
    const normalizedIdeal = idealAnswer.toLowerCase().trim();
    const isMatch = normalizedUser === normalizedIdeal ||
                    normalizedIdeal.includes(normalizedUser) ||
                    normalizedUser.includes(normalizedIdeal);

    return {
      isCorrect: isMatch,
      score: isMatch ? 80 : 50,
      feedback: isMatch
        ? "Your answer looks good! Keep practicing these skills."
        : "Good effort! Compare your answer with the ideal response to see how you can improve.",
      suggestions: []
    };
  }
}

module.exports = {
  evaluateTextInput
};
