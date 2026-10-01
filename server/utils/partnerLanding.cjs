'use strict';

// Campaign/partner signup-screen customisation, stored in Partner.config:
//   displayName      — public name shown on the subscribe page ("Special discount for X").
//                      Campaigns default to none so an internal campaign name never leaks.
//   skipSubscription — web signup skips /subscribe and goes straight to /success.
//   landing          — custom copy for the first two web signup screens:
//     { headline, subtext, ctaText, imageKey, accountTitle, accountSubtitle }
// Every field is optional; blank falls back to the web app's default copy.

const LANDING_LIMITS = {
  headline: 120,
  subtext: 300,
  ctaText: 40,
  accountTitle: 80,
  accountSubtitle: 300,
};
const DISPLAY_NAME_LIMIT = 80;

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

function sanitizeDisplayName(value) {
  return cleanText(value, DISPLAY_NAME_LIMIT, 'displayName');
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
  PartnerConfigError,
  sanitizeLanding,
  sanitizeDisplayName,
  publicDisplayName,
};
