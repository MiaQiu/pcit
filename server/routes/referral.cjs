'use strict';

const express = require('express');
const crypto = require('crypto');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const prisma = require('../services/db.cjs');
const { hashPassword } = require('../utils/password.cjs');
const { encryptUserData, decryptSensitiveData } = require('../utils/encryption.cjs');
const { requireAuth } = require('../middleware/auth.cjs');
const { ValidationError, ConflictError, NotFoundError } = require('../utils/errors.cjs');

const router = express.Router();

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'tempmail.com', 'guerrillamail.com', 'throwaway.email',
  'sharklasers.com', 'guerrillamailblock.com', 'grr.la', 'guerrillamail.info',
  'spam4.me', 'yopmail.com', 'trashmail.com', 'dispostable.com',
]);

const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many registration attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const codeEnumerationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,
});

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
    .messages({ 'string.pattern.base': 'Password must contain at least 1 uppercase, 1 lowercase, and 1 number' }),
  referralCode: Joi.string().required(),
});

function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'NORA-' + Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

// GET /api/referral/referrer-name/:code
// Public — used by landing page to personalise the invite heading
router.get('/referrer-name/:code', codeEnumerationLimiter, async (req, res, next) => {
  try {
    const { code } = req.params;
    const referrer = await prisma.user.findUnique({
      where: { referralCode: code },
      select: { name: true },
    });
    if (!referrer) return next(new NotFoundError('Referral code not found'));

    const fullName = decryptSensitiveData(referrer.name) || '';
    const firstName = fullName.split(' ')[0] || 'Someone';

    res.json({ firstName });
  } catch (err) {
    next(err);
  }
});

// POST /api/referral/register
// Public — web landing page creates a minimal account and records the referral
router.post('/register', registrationLimiter, async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const { email, password, referralCode } = value;

    // Block disposable email domains
    const domain = email.split('@')[1]?.toLowerCase();
    if (DISPOSABLE_DOMAINS.has(domain)) {
      return next(new ValidationError('Please use a permanent email address'));
    }

    const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');

    // Check for existing account
    const existing = await prisma.user.findUnique({ where: { emailHash } });
    if (existing) {
      return next(new ConflictError('An account with this email already exists. Download the app and log in.'));
    }

    // Validate referral code and find referrer
    const referrer = await prisma.user.findUnique({ where: { referralCode } });
    if (!referrer) return next(new NotFoundError('Referral code not found'));

    // Block self-referral
    if (referrer.emailHash === emailHash) {
      return next(new ValidationError('You cannot use your own referral code'));
    }

    const passwordHash = await hashPassword(password);

    // Encrypt sensitive fields exactly like POST /api/auth/signup
    const encryptedData = encryptUserData({
      email,
      name: 'User',      // placeholder — triggers NameInput step in onboarding
      childName: 'Child', // placeholder — triggers ChildName step in onboarding
    });

    const newUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: encryptedData.email,
        emailHash,
        passwordHash,
        name: encryptedData.name,
        childName: encryptedData.childName,
        childBirthYear: new Date().getFullYear() - 3,
        childConditions: '[]',
        subscriptionPlan: 'FREE',
        subscriptionStatus: 'INACTIVE',
      },
    });

    await prisma.referral.create({
      data: {
        id: crypto.randomUUID(),
        referrerId: referrer.id,
        refereeId: newUser.id,
        code: referralCode,
        status: 'PENDING',
      },
    });

    res.status(201).json({ message: 'Account created! Download Nora to start your free trial.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/referral/my-code
// Authenticated — get (or generate) the current user's referral code + stats
router.get('/my-code', requireAuth, async (req, res, next) => {
  try {
    let user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { referralCode: true },
    });
    if (!user) return next(new NotFoundError('User not found'));

    let code = user.referralCode;

    // Generate a unique code if this user doesn't have one yet
    if (!code) {
      let attempts = 0;
      while (!code && attempts < 10) {
        const candidate = generateReferralCode();
        const collision = await prisma.user.findUnique({ where: { referralCode: candidate } });
        if (!collision) {
          await prisma.user.update({ where: { id: req.userId }, data: { referralCode: candidate } });
          code = candidate;
        }
        attempts++;
      }
      if (!code) return next(new Error('Failed to generate unique referral code'));
    }

    const [totalReferred, converted, pendingConversion] = await Promise.all([
      prisma.referral.count({ where: { referrerId: req.userId } }),
      prisma.referral.count({ where: { referrerId: req.userId, status: 'COMPLETED' } }),
      prisma.referral.count({ where: { referrerId: req.userId, status: 'PENDING' } }),
    ]);

    res.json({
      code,
      shareUrl: `https://hinora.co/join/${code}`,
      stats: { totalReferred, converted, pendingConversion },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/referral/apply-existing
// Authenticated — for users who already had an account when they tapped a referral link
router.post('/apply-existing', requireAuth, async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      return next(new ValidationError('Referral code is required'));
    }

    const referrer = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!referrer) return next(new NotFoundError('Referral code not found'));

    if (referrer.id === req.userId) {
      return next(new ValidationError('You cannot use your own referral code'));
    }

    const existingReferral = await prisma.referral.findUnique({ where: { refereeId: req.userId } });
    if (existingReferral) {
      return next(new ConflictError('A referral has already been applied to your account'));
    }

    await prisma.referral.create({
      data: {
        id: crypto.randomUUID(),
        referrerId: referrer.id,
        refereeId: req.userId,
        code,
        status: 'PENDING',
      },
    });

    res.json({ message: 'Referral applied successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
