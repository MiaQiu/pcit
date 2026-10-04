// Anonymous signup drafts for account-last links (Partner.config.accountLast).
// Web-only: the signup SPA creates a draft on the first onboarding screen, updates it on
// every screen change, and converts it after the visitor creates an account (or logs in)
// at the end. A draft never holds anything that identifies a person — see
// doc/implementation/account-last-signup.md.
const express = require('express');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const prisma = require('../services/db.cjs');
const { requireAuth } = require('../middleware/auth.cjs');
const { normalizeSource } = require('../utils/partnerLanding.cjs');
const { logError } = require('../utils/errorLogger.cjs');

const router = express.Router();

// Option keys of the web ChildIssueScreen (same as the mobile app's). Anything else —
// including the parent's own "Other" text — is dropped.
const CONCERN_KEYS = new Set([
  'big_feelings_tantrums', 'behavior_challenges', 'listening_cooperation', 'attention_focus',
  'social', 'anxiety', 'confidence', 'adhd', 'developmental_concerns', 'parenting_strategies', 'other',
]);

// One create per visitor, then one update per screen (~25 per signup).
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
const updateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

const progressFields = {
  childBirthYear: Joi.number().integer().min(1900).max(new Date().getFullYear()).allow(null).optional(),
  concerns: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  wacbScore: Joi.number().integer().min(0).max(70).allow(null).optional(),
  lastStep: Joi.string().max(100).pattern(/^\//).optional(),
};

const createSchema = Joi.object({
  partnerSlug: Joi.string().max(100).required(),
  messageKey: Joi.string().max(40).allow(null, '').optional(),
  source: Joi.string().max(100).allow(null, '').optional(),
  ...progressFields,
});

const updateSchema = Joi.object(progressFields);

// Keeps only the ChildIssueScreen option keys, de-duplicated.
function cleanProgress({ childBirthYear, concerns, wacbScore, lastStep }) {
  const data = { childBirthYear, wacbScore, lastStep };
  if (concerns) data.concerns = [...new Set(concerns.filter(c => CONCERN_KEYS.has(c)))];
  return data;
}

// POST /api/signup-draft — { partnerSlug, messageKey?, source?, …progress fields } → { id }
// Carries the current screen/answers so the row is complete even if no update follows
// (e.g. the tab is closed while this request is in flight). Same link checks as GET /api/partner/validate/:slug, plus the link must have
// accountLast on.
router.post('/', createLimiter, async (req, res) => {
  try {
    const { error, value } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const partner = await prisma.partner.findUnique({ where: { slug: value.partnerSlug } });
    const config = partner?.config ?? {};
    if (
      !partner || partner.status !== 'ACTIVE' || config.accountLast !== true ||
      (partner.expiresAt && new Date(partner.expiresAt) < new Date()) ||
      (config.maxRedemptions != null && partner.redemptions >= config.maxRedemptions)
    ) {
      return res.status(400).json({ error: 'Link not eligible for a signup draft' });
    }

    // Best-effort, like signup: an unknown/archived message leaves the draft unattributed to one.
    let campaignMessageId = null;
    if (value.messageKey) {
      const message = await prisma.campaignMessage.findUnique({
        where: { partnerId_key: { partnerId: partner.id, key: value.messageKey.toLowerCase() } },
      });
      if (message?.active) campaignMessageId = message.id;
    }

    const draft = await prisma.signupDraft.create({
      data: {
        partnerId: partner.id,
        campaignMessageId,
        signupSource: normalizeSource(value.source),
        ...cleanProgress(value),
      },
      select: { id: true },
    });
    res.status(201).json({ id: draft.id });
  } catch (err) {
    logError(err, { route: 'signup-draft#create' });
    res.status(500).json({ error: 'Failed to create signup draft' });
  }
});

// PATCH /api/signup-draft/:id — any of { childBirthYear, concerns, wacbScore, lastStep }.
// No-op once the draft is converted.
router.patch('/:id', updateLimiter, async (req, res) => {
  try {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const data = cleanProgress(value);

    const { count } = await prisma.signupDraft.updateMany({
      where: { id: req.params.id, convertedAt: null },
      data,
    });
    if (count === 0) {
      const exists = await prisma.signupDraft.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!exists) return res.status(404).json({ error: 'Draft not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    logError(err, { route: 'signup-draft#update' });
    res.status(500).json({ error: 'Failed to update signup draft' });
  }
});

// POST /api/signup-draft/:id/convert — links the draft to the signed-up / logged-in user,
// with the visitor's final progress fields (queued screen updates may still be in flight
// and are ignored once converted). Idempotent: an already-converted draft is left as is.
router.post('/:id/convert', requireAuth, async (req, res) => {
  try {
    const { error, value } = updateSchema.validate(req.body ?? {});
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { count } = await prisma.signupDraft.updateMany({
      where: { id: req.params.id, convertedAt: null },
      data: { ...cleanProgress(value), convertedUserId: req.user.id, convertedAt: new Date() },
    });
    res.json({ ok: true, converted: count > 0 });
  } catch (err) {
    logError(err, { route: 'signup-draft#convert', userId: req.user?.id });
    res.status(500).json({ error: 'Failed to convert signup draft' });
  }
});

module.exports = router;
