'use strict';

// Campaign/partner signup-screen customisation, stored in Partner.config:
//   displayName      — public name shown on the subscribe page ("Special discount for X").
//                      Campaigns default to none so an internal campaign name never leaks.
//   skipSubscription — web signup skips /subscribe and goes straight to /success.
//   campaignRules    — { title, content } shown behind the consent checkbox on the
//                      web create-account screen (campaigns only).
//   landing          — custom copy for the web signup screens:
//     { headline, subtext, ctaText, imageKey, accountTitle, accountSubtitle,
//       successTitle, successSubtitle }
// Every field is optional; blank falls back to the web app's default copy.

const LANDING_LIMITS = {
  headline: 120,
  subtext: 300,
  ctaText: 40,
  accountTitle: 80,
  accountSubtitle: 300,
  successTitle: 80,
  successSubtitle: 300,
};
const DISPLAY_NAME_LIMIT = 80;
const RULES_LIMITS = { title: 120, content: 20000 };

function cleanText(value, max, field) {
  if (value == null) return null;
  if (typeof value !== 'string') throw new PartnerConfigError(`${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) throw new PartnerConfigError(`${field} must be at most ${max} characters`);
  return trimmed;
}

class PartnerConfigError extends Error {}

/**
 * Normalise an incoming `landing` object. Text fields come from `input`; imageKey
 * is never taken from the request (it's set only by the upload/remove endpoints)
 * unless `allowImageKey` is set — used when duplicating a campaign, where the key
 * must already be under `partners/`.
 * Returns null when nothing is customised.
 */
function sanitizeLanding(input, { existingImageKey = null, allowImageKey = false } = {}) {
  const landing = {};
  for (const [field, max] of Object.entries(LANDING_LIMITS)) {
    landing[field] = cleanText(input?.[field], max, `landing.${field}`);
  }
  let imageKey = existingImageKey;
  if (allowImageKey && typeof input?.imageKey === 'string' && input.imageKey.startsWith('partners/')) {
    imageKey = input.imageKey;
  }
  landing.imageKey = imageKey ?? null;
  return Object.values(landing).some(v => v != null) ? landing : null;
}

/**
 * Normalise campaign rules. Returns null when no content is given (the title alone
 * is meaningless — the checkbox then only covers the Terms and Privacy Policy).
 */
function sanitizeCampaignRules(input) {
  if (input == null) return null;
  const content = cleanText(input.content, RULES_LIMITS.content, 'campaignRules.content');
  if (!content) return null;
  const title = cleanText(input.title, RULES_LIMITS.title, 'campaignRules.title');
  return { title, content };
}

function sanitizeDisplayName(value) {
  return cleanText(value, DISPLAY_NAME_LIMIT, 'displayName');
}

// Campaign links: /p/<slug>/<messageKey>?src=<source>. Both are lowercase a-z0-9,
// '-' and '_' (sources only); anything else is replaced with '-'.
const MESSAGE_KEY_LIMIT = 40;
const MESSAGE_NAME_LIMIT = 120;
const SOURCE_LIMIT = 40;

/** Strict validation for a new message key (admin input). */
function sanitizeMessageKey(value) {
  const key = cleanText(value, MESSAGE_KEY_LIMIT, 'key');
  if (!key || !/^[a-z0-9-]+$/.test(key)) {
    throw new PartnerConfigError('key must be lowercase letters, digits and dashes');
  }
  return key;
}

function sanitizeMessageName(value) {
  const name = cleanText(value, MESSAGE_NAME_LIMIT, 'name');
  if (!name) throw new PartnerConfigError('name is required');
  return name;
}

/**
 * Lenient normalisation of a public `?src=` channel tag (never throws — it comes
 * from ad URLs). Returns null when empty.
 */
function normalizeSource(value) {
  if (typeof value !== 'string') return null;
  const src = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, SOURCE_LIMIT);
  return src || null;
}

/**
 * Field-by-field merge of a message's landing over the parent link's landing:
 * a blank message field keeps the parent's value (which may itself be blank =
 * the web app's default).
 */
function mergeLanding(base, override) {
  if (!override) return base ?? null;
  const merged = { ...(base ?? {}) };
  for (const [field, value] of Object.entries(override)) {
    if (value != null) merged[field] = value;
  }
  return Object.values(merged).some(v => v != null) ? merged : null;
}

/**
 * The public name for the subscribe page. B2B partners fall back to their name;
 * campaigns fall back to nothing (their name is an internal label).
 */
function publicDisplayName(partner) {
  const configured = partner.config?.displayName;
  if (configured) return configured;
  return partner.kind === 'CAMPAIGN' ? null : partner.name;
}

module.exports = {
  LANDING_LIMITS,
  DISPLAY_NAME_LIMIT,
  RULES_LIMITS,
  MESSAGE_KEY_LIMIT,
  MESSAGE_NAME_LIMIT,
  PartnerConfigError,
  sanitizeMessageKey,
  sanitizeMessageName,
  normalizeSource,
  mergeLanding,
  sanitizeLanding,
  sanitizeDisplayName,
  sanitizeCampaignRules,
  publicDisplayName,
};
