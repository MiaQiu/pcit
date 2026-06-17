'use strict';

/**
 * LLM Call Profiles
 *
 * Named presets for every LLM call in the system.
 * All calls use the 'gemini' model (gemini-3.5-flash → gemini-3.1-pro-preview fallback).
 * Explicit options at the call site override profile defaults.
 */
const PROFILES = {
  // ── PCIT core pipeline ────────────────────────────────────────────────────

  'pcit-coding': {
    model:       'gemini',
    temperature: 0,
    maxTokens:   32768,
    timeout:     300_000,
    output:      'array',
  },

  'pcit-coding-supplemental': {
    model:       'gemini',
    temperature: 0,
    maxTokens:   8192,
    timeout:     120_000,
    output:      'array',
  },

  'review-feedback': {
    model:       'gemini',
    temperature: 0.5,
    maxTokens:   8192,
    timeout:     120_000,
    output:      'array',
  },

  'combined-feedback': {
    model:       'gemini',
    temperature: 0.4,
    maxTokens:   2048,
    timeout:     120_000,
    output:      'json',
  },

  'coaching-narrative': {
    model:       'gemini',
    temperature: 0.5,
    maxTokens:   16384,
    timeout:     300_000,
    output:      'text',
  },

  'coaching-format': {
    model:       'gemini',
    temperature: 0,
    maxTokens:   4096,
    timeout:     120_000,
    output:      'json',
  },

  'coaching-notifications': {
    model:       'gemini',
    temperature: 0.5,
    maxTokens:   2048,
    timeout:     90_000,
    output:      'json',
  },

  'dev-profiling': {
    model:       'gemini',
    temperature: 0.5,
    maxTokens:   8192,
    timeout:     120_000,
    output:      'json',
  },

  'about-child-narrative': {
    model:       'gemini',
    temperature: 0.7,
    maxTokens:   4096,
    timeout:     120_000,
    output:      'text',
  },

  'about-child-extract': {
    model:       'gemini',
    temperature: 0.3,
    maxTokens:   2048,
    timeout:     60_000,
    output:      'array',
  },

  'pdi-two-choices': {
    model:       'gemini',
    temperature: 0.4,
    maxTokens:   6144,
    timeout:     120_000,
    output:      'json',
  },

  'role-identification': {
    model:       'gemini',
    temperature: 0.3,
    maxTokens:   2048,
    timeout:     60_000,
    output:      'json',
  },

  'role-id-tiebreaker': {
    model:       'gemini',
    temperature: 0.3,
    maxTokens:   2048,
    timeout:     60_000,
    output:      'json',
  },

  'quality-check': {
    model:       'gemini',
    temperature: 0,
    maxTokens:   512,
    timeout:     30_000,
    output:      'json',
  },

  // ── Other services ────────────────────────────────────────────────────────

  'weekly-report': {
    model:       'gemini',
    temperature: 0.7,
    maxTokens:   2000,
    timeout:     60_000,
    output:      'text',
  },

  'text-input-eval': {
    model:       'gemini',
    temperature: 0.3,
    maxTokens:   512,
    timeout:     30_000,
    output:      'json',
  },

  'abc-insight': {
    model:       'gemini',
    temperature: 0.3,
    maxTokens:   2000,
    timeout:     60_000,
    output:      'json',
  },

  'segmenter': {
    model:       'gemini',
    temperature: 0,
    maxTokens:   8192,
    timeout:     120_000,
    output:      'array',
  },
};

module.exports = { PROFILES };
