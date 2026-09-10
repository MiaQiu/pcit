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
        startUtteranceNumber: { type: 'integer' },
        endUtteranceNumber:   { type: 'integer' },
      },
      required: ['startUtteranceNumber', 'endUtteranceNumber'],
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

// ── generate-crisis ───────────────────────────────────────────────────────────
// Hero banner text, a free-form crisis coaching report, a skill-coaching note
// for tomorrow's goal, and a "top moment" bonding exchange — all derived from
// the raw session transcript plus the already-generated coaching narrative.
const CRISIS_COACHING = {
  type: 'object',
  properties: {
    heroText: { type: 'string' },
    crisisMoment: {
      type: 'object',
      properties: {
        detected: { type: 'boolean' },
        title:    { type: 'string' },
        coaching: { type: 'string' },
      },
      required: ['detected', 'title', 'coaching'],
    },
    skillCoaching: { type: 'string' },
    topMoment: {
      type: 'object',
      properties: {
        startUtteranceNumber: { type: 'integer' },
        endUtteranceNumber:   { type: 'integer' },
        context:              { type: 'string' },
      },
      required: ['startUtteranceNumber', 'endUtteranceNumber', 'context'],
    },
  },
  required: ['heroText', 'crisisMoment', 'skillCoaching', 'topMoment'],
};

// ── about-child ───────────────────────────────────────────────────────────────
// Array of 10 "About Child" observations from a single LLM pass over the
// transcript (see generateAboutChild), ranked by how valuable each is to the
// parent (id 1 = most valuable). `label` places the child relative to their age;
// `valence` is NOT produced by the model — generateAboutChild derives it from
// `label` for back-compat with mobile + aboutChildSelectionService.
const ABOUT_CHILD = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id:          { type: 'integer' },
      label:       { type: 'string', enum: ['advanced', 'age_appropriate', 'needs_help'] },
      Title:       { type: 'string' },
      Description: { type: 'string' },
      Details:     { type: 'string' },
      tags:        { type: 'array', items: { type: 'string' } },
    },
    required: ['id', 'label', 'Title', 'Description', 'Details', 'tags'],
  },
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
// Splits the free-form CDI coaching write-up into the two pieces the app shows
// separately: `coach_corner` — sections "1. What you did well" + "3. Next Growth
// Focus" broken into structured breakdown fields ({ did_well, growth_focus,
// word_bank }) so the mobile Coach's Corner card can lay them out (always
// present) — and, only when the write-up has a "4. Handling tricky moments"
// section, `tricky_moments` — a structured card ({ summary, points[] }) shown in
// the Crisis Moment slot; otherwise `tricky_moments` is null.
const COACHING_FORMAT = {
  type: 'object',
  properties: {
    coach_corner: {
      type: 'object',
      properties: {
        // section "1. What you did well"
        did_well: {
          type: 'object',
          properties: {
            theme:        { type: 'string' },
            how_it_helps: { type: 'string' },
            examples: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  quote:   { type: 'string' },
                  benefit: { type: 'string' },
                },
                required: ['quote', 'benefit'],
              },
            },
          },
          required: ['theme', 'how_it_helps', 'examples'],
        },
        // section "3. Next Growth Focus — (Upgrade Strategy)"
        growth_focus: {
          type: 'object',
          properties: {
            heading:   { type: 'string' },
            gap:       { type: 'string' },
            benchmark: { type: 'string' },
            strategy:  { type: 'string' },
          },
          required: ['heading', 'gap', 'benchmark', 'strategy'],
        },
        // the tailored word bank under section 3 — one entry per primary child goal
        word_bank: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              goal: { type: 'string' },
              categories: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name:     { type: 'string' },
                    examples: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['name', 'examples'],
                },
              },
            },
            required: ['goal', 'categories'],
          },
        },
      },
      required: ['did_well', 'growth_focus', 'word_bank'],
    },
    tricky_moments: {
      type: 'object',
      nullable: true,
      properties: {
        summary: { type: 'string' },
        points: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title:             { type: 'string' },
              explanation:       { type: 'string' },
              quote:             { type: 'string', nullable: true },
              suggested_rewrite: { type: 'string', nullable: true },
            },
            required: ['title', 'explanation'],
          },
        },
      },
      required: ['summary', 'points'],
    },
  },
  required: ['coach_corner'],
};

// ── skill-improve ─────────────────────────────────────────────────────────────
// Session-grounded opportunities to build or reduce this session's target skill
const SKILL_IMPROVE = {
  type: 'object',
  properties: {
    direction: { type: 'string', enum: ['BUILD', 'AVOID'] },
    summary:   { type: 'string' },
    opportunities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title:                { type: 'string' },
          explanation:          { type: 'string' },
          startUtteranceNumber: { type: 'integer', nullable: true },
          endUtteranceNumber:   { type: 'integer', nullable: true },
          suggestedRewrite:     { type: 'string', nullable: true },
        },
        required: ['title', 'explanation'],
      },
    },
  },
  required: ['direction', 'summary', 'opportunities'],
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
  CRISIS_COACHING,
  ABOUT_CHILD,
  PDI_TWO_CHOICES,
  DEV_PROFILING,
  COACHING_FORMAT,
  MILESTONE_DETECTION,
  SKILL_IMPROVE,
};
