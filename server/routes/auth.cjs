// Authentication routes
const express = require('express');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const prisma = require('../services/db.cjs');
const { hashPassword, verifyPassword } = require('../utils/password.cjs');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt.cjs');
const { encryptSensitiveData, decryptSensitiveData, encryptUserData, decryptUserData } = require('../utils/encryption.cjs');

const router = express.Router();

// Rate limiter for auth endpoints
// More lenient in development, stricter in production
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 10 : 100, // 100 attempts in dev, 10 in prod
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const signupSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
    .messages({
      'string.pattern.base': 'Password must contain at least 1 uppercase, 1 lowercase, and 1 number'
    }),
  name: Joi.string().min(2).max(100).required(),
  childName: Joi.string().min(1).max(50).required(),
  childBirthYear: Joi.number().integer().min(1900).max(new Date().getFullYear()).required(),
  childBirthday: Joi.date().optional(),
  childConditions: Joi.array().items(Joi.string().max(200)).min(1).required(),
  issue: Joi.string().valid('tantrums', 'defiance', 'aggression', 'social', 'emotional', 'routine', 'general').optional(),
  therapistId: Joi.string().uuid().optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    // Validate input
    const { error, value } = signupSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password, name, childName, childBirthYear, childBirthday, childConditions, issue, therapistId } = value;

    // Create email hash for querying (since email will be encrypted)
    const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');

    // Check if user already exists (using emailHash)
    const existingUser = await prisma.user.findUnique({
      where: { emailHash }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Encrypt sensitive user data (email, name, childName)
    const encryptedData = encryptUserData({
      email,
      name,
      childName
    });

    // Create user
    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: encryptedData.email,
        emailHash,
        passwordHash,
        name: encryptedData.name,
        childName: encryptedData.childName,
        childBirthYear,
        childBirthday: childBirthday ? new Date(childBirthday) : null,
        childConditions: JSON.stringify(childConditions), // Stored as plain JSON
        issue,
        therapistId
      }
    });

    // Decrypt user data for token and response
    const decryptedUser = decryptUserData(user);

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: decryptedUser.email
    });

    const refreshToken = generateRefreshToken({
      userId: user.id
    });

    // Store refresh token hash
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await prisma.refreshToken.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt
      }
    });

    res.status(201).json({
      user: {
        id: decryptedUser.id,
        email: decryptedUser.email,
        name: decryptedUser.name,
        childName: decryptedUser.childName,
        childBirthYear: decryptedUser.childBirthYear,
        childConditions: decryptedUser.childConditions
      },
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = value;

    // Create email hash for lookup (email is encrypted in DB)
    const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');

    // Find user by emailHash
    const user = await prisma.user.findUnique({
      where: { emailHash }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Decrypt user data for token and response
    const decryptedUser = decryptUserData(user);

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: decryptedUser.email
    });

    const refreshToken = generateRefreshToken({
      userId: user.id
    });

    // Store refresh token hash (delete old one first)
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.upsert({
      where: { userId: user.id },
      update: {
        tokenHash: refreshTokenHash,
        expiresAt
      },
      create: {
        id: crypto.randomUUID(),
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt
      }
    });

    res.json({
      user: {
        id: decryptedUser.id,
        email: decryptedUser.email,
        name: decryptedUser.name,
        childName: decryptedUser.childName,
        childBirthYear: decryptedUser.childBirthYear,
        childConditions: decryptedUser.childConditions
      },
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Hash and delete refresh token
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    await prisma.refreshToken.deleteMany({
      where: { tokenHash: refreshTokenHash }
    });

    res.json({ message: 'Logged out successfully' });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if token exists in database
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const storedToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: refreshTokenHash }
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Decrypt email for token
    const decryptedUser = decryptUserData(user);

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user.id,
      email: decryptedUser.email
    });

    res.json({ accessToken });

  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth.cjs').requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        childName: true,
        childBirthYear: true,
        childBirthday: true,
        childConditions: true,
        issue: true,
        therapistId: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Decrypt sensitive data for response
    const decryptedUser = decryptUserData(user);

    res.json({ user: decryptedUser });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// PATCH /api/auth/complete-onboarding
// Update user profile with onboarding data
router.patch('/complete-onboarding', require('../middleware/auth.cjs').requireAuth, async (req, res) => {
  try {
    const { name, childName, childBirthday, issue } = req.body;

    // Validate at least one field is provided
    if (!name && !childName && !childBirthday && !issue) {
      return res.status(400).json({ error: 'At least one field required' });
    }

    // Build update data
    const updateData = {};

    if (name) {
      const encryptedName = encryptSensitiveData(name);
      updateData.name = encryptedName;
    }

    if (childName) {
      const encryptedChildName = encryptSensitiveData(childName);
      updateData.childName = encryptedChildName;
    }

    if (childBirthday) {
      updateData.childBirthday = new Date(childBirthday);
      // Also update childBirthYear for backwards compatibility
      updateData.childBirthYear = new Date(childBirthday).getFullYear();
    }

    if (issue) {
      // Validate issue value
      const validIssues = ['tantrums', 'defiance', 'aggression', 'social', 'emotional', 'routine', 'general'];
      if (!validIssues.includes(issue)) {
        return res.status(400).json({ error: 'Invalid issue value' });
      }
      updateData.issue = issue;
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        childName: true,
        childBirthYear: true,
        childBirthday: true,
        childConditions: true,
        issue: true,
        therapistId: true,
        createdAt: true
      }
    });

    // Decrypt sensitive data for response
    const decryptedUser = decryptUserData(user);

    res.json({ user: decryptedUser });

  } catch (error) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

module.exports = router;
