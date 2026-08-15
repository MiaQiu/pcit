'use strict';

/**
 * Gemini responseSchema definitions for each LLM call site.
 *
 * When a schema is supplied, Gemini constrains output at the token level —
 * malformed JSON becomes impossible. jsonrepair remains as a last-resort
 * safety net for non-schema calls (Claude, streaming, etc.).
 *
 * Schema format follows OpenAPI 3.0 subset supported by Gemini.
 * Reference: https://ai.google.dev/gemini-api/docs/structured-output
 */

// ── pcit-coding ───────────────────────────────────────────────────────────────
// Array of DPICS coding results for parent utterances
const PCIT_CODING = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id:       { type: 'integer' },
      code:     { type: 'string', enum: ['LP', 'UP', 'BD', 'RF', 'RQ', 'Q', 'DC', 'IC', 'NTA', 'AK', 'ID', 'TC'] },
      feedback: { type: 'string' },
    },
    required: ['id', 'code', 'feedback'],
  },
};

// ── review-feedback ───────────────────────────────────────────────────────────
// Array of revised utterance feedback items (including silence slots)
const REVIEW_FEEDBACK = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id:             { type: 'integer' },
      feedback:       { type: 'string' },
      additional_tip: { type: 'string', nullable: true },
    },
    required: ['id', 'feedback'],
  },
};

// ── combined-feedback ─────────────────────────────────────────────────────────
// Session opening report: top moment, opening message, child reaction
const COMBINED_FEEDBACK = {
  type: 'object',
  properties: {
    topMoment: {
      type: 'object',
      properties: {
        quote:           { type: 'string' },
        utteranceNumber: { type: 'integer' },
      },
      required: ['quote', 'utteranceNumber'],
    },
    Feedback:              { type: 'string' },
    exampleUtteranceNumber: { type: 'integer' },
    reminder:              { type: 'string' },
    ChildReaction:         { type: 'string' },
    activity:              { type: 'string' },
  },
  required: ['topMoment', 'Feedback', 'reminder', 'ChildReaction', 'activity'],
};

// ── report-highlights ─────────────────────────────────────────────────────────
// Hero banner text, top-moment celebration, interaction-style tip, and optional
// crisis-moment extraction — all derived from the already-generated coaching
// narrative + the identified top-moment quote (not the raw transcript)
const REPORT_HIGHLIGHTS = {
  type: 'object',
  properties: {
    heroText:            { type: 'string' },
    topMomentCelebration: { type: 'string' },
    interactionTip:       { type: 'string' },
    crisisMoment: {
      type: 'object',
      properties: {
        detected:    { type: 'boolean' },
        title:       { type: 'string' },
        description: { type: 'string' },
        whatHelped:  { type: 'array', items: { type: 'string' } },
      },
      required: ['detected', 'title', 'description', 'whatHelped'],
    },
  },
  required: ['heroText', 'topMomentCelebration', 'interactionTip', 'crisisMoment'],
};

// ── pdi-two-choices ───────────────────────────────────────────────────────────
// PDI discipline sequence analysis
const PDI_TWO_CHOICES = {
  type: 'object',
  properties: {
    summary:      { type: 'string' },
    encouragement: { type: 'string' },
    commandSequences: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title:         { type: 'string' },
          label:         { type: 'string', enum: ['Great!', 'Needs Work'] },
          whatHappened:  { type: 'string' },
          command:       { type: 'string' },
          waitTime:      { type: 'string' },
          followThrough: { type: 'string' },
          coachTip:      { type: 'string', nullable: true },
        },
        required: ['title', 'label', 'whatHappened', 'command', 'waitTime', 'followThrough'],
      },
    },
    pdiSkills: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          skill:       { type: 'string' },
          performance: { type: 'string', enum: ['Good', 'Excellent', 'Needs Work'] },
          feedback:    { type: 'string' },
        },
        required: ['skill', 'performance', 'feedback'],
      },
    },
    tomorrowGoal: { type: 'string' },
  },
  required: ['summary', 'encouragement', 'commandSequences', 'pdiSkills', 'tomorrowGoal'],
};

// ── dev-profiling ─────────────────────────────────────────────────────────────
// Developmental profiling across 5 domains
const DEV_PROFILING = {
  type: 'object',
  properties: {
    session_metadata: {
      type: 'object',
      properties: {
        subject:            { type: 'string' },
        age_months:         { type: 'number' },
        overall_impression: { type: 'string' },
      },
      required: ['subject', 'age_months', 'overall_impression'],
    },
    developmental_observation: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        domains: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category:             { type: 'string', enum: ['Language', 'Cognitive', 'Social', 'Emotional', 'Connection'] },
              framework:            { type: 'string' },
              developmental_status: { type: 'string' },
              current_level:        { type: 'string' },
              benchmark_for_age:    { type: 'string' },
              detailed_observations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    insight:  { type: 'string' },
                    evidence: { type: 'string' },
                  },
                  required: ['insight', 'evidence'],
                },
              },
              detected_milestone_keys: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    milestone_key:    { type: 'string' },
                    evidence_summary: { type: 'string' },
                  },
                  required: ['milestone_key', 'evidence_summary'],
                },
              },
            },
            required: ['category', 'framework', 'developmental_status', 'current_level', 'benchmark_for_age', 'detailed_observations', 'detected_milestone_keys'],
          },
        },
      },
      required: ['summary', 'domains'],
    },
    baseline_achieved: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          milestone_key:    { type: 'string' },
          evidence_summary: { type: 'string' },
        },
        required: ['milestone_key', 'evidence_summary'],
      },
    },
  },
  required: ['session_metadata', 'developmental_observation', 'baseline_achieved'],
};

// ── coaching-format ───────────────────────────────────────────────────────────
// CDI coaching report formatted into 3 mobile-friendly sections
const COACHING_FORMAT = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title:   { type: 'string' },
          content: { type: 'string' },
        },
        required: ['title', 'content'],
      },
    },
    tomorrowGoal: { type: 'string', nullable: true },
  },
  required: ['sections'],
};

// ── milestone-detection ───────────────────────────────────────────────────────
// Maps developmental observations to milestone library entries
const MILESTONE_DETECTION = {
  type: 'object',
  properties: {
    detected_milestones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          milestone_key:    { type: 'string' },
          evidence_summary: { type: 'string' },
        },
        required: ['milestone_key', 'evidence_summary'],
      },
    },
    baseline_achieved: {
      type: 'array',
      nullable: true,
      items: {
        type: 'object',
        properties: {
          milestone_key:    { type: 'string' },
          evidence_summary: { type: 'string' },
        },
        required: ['milestone_key', 'evidence_summary'],
      },
    },
  },
  required: ['detected_milestones'],
};

module.exports = {
  PCIT_CODING,
  REVIEW_FEEDBACK,
  COMBINED_FEEDBACK,
  REPORT_HIGHLIGHTS,
  PDI_TWO_CHOICES,
  DEV_PROFILING,
  COACHING_FORMAT,
  MILESTONE_DETECTION,
};
