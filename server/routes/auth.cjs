// Authentication routes
const express = require('express');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const multer = require('multer');
const prisma = require('../services/db.cjs');
const { hashPassword, verifyPassword } = require('../utils/password.cjs');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt.cjs');
const { encryptSensitiveData, decryptSensitiveData, encryptUserData, decryptUserData } = require('../utils/encryption.cjs');
const { uploadProfileImage, deleteProfileImage } = require('../services/storage-s3.cjs');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files are allowed'), false);
      return;
    }
    cb(null, true);
  }
});

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

    // Set up trial period (30 days from now)
    const now = new Date();
    const trialEndDate = new Date(now);
    trialEndDate.setDate(trialEndDate.getDate() + 30);

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
        therapistId,
        subscriptionPlan: 'TRIAL',
        subscriptionStatus: 'ACTIVE',
        trialStartDate: now,
        trialEndDate: trialEndDate
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
        profileImageUrl: true,
        relationshipToChild: true,
        childName: true,
        childBirthYear: true,
        childBirthday: true,
        childConditions: true,
        issue: true,
        therapistId: true,
        createdAt: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        trialStartDate: true,
        trialEndDate: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Decrypt sensitive data for response
    const decryptedUser = decryptUserData(user);

    // Parse issue if it's a JSON string
    if (decryptedUser.issue && typeof decryptedUser.issue === 'string' && decryptedUser.issue.startsWith('[')) {
      try {
        decryptedUser.issue = JSON.parse(decryptedUser.issue);
      } catch (e) {
        // Keep as string if parsing fails
      }
    }

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
      // Handle both string and array of issues
      const validIssues = ['tantrums', 'not-listening', 'arguing', 'social', 'new_baby_in_the_house', 'frustration_tolerance', 'Navigating_change', 'defiance', 'aggression', 'emotional', 'routine', 'general'];

      if (Array.isArray(issue)) {
        // Validate all issues in array
        const invalidIssues = issue.filter(i => !validIssues.includes(i));
        if (invalidIssues.length > 0) {
          return res.status(400).json({ error: `Invalid issue values: ${invalidIssues.join(', ')}` });
        }
        // Store as JSON string for database
        updateData.issue = JSON.stringify(issue);
      } else {
        // Single issue (backward compatibility)
        if (!validIssues.includes(issue)) {
          return res.status(400).json({ error: 'Invalid issue value' });
        }
        updateData.issue = issue;
      }
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

// POST /api/auth/upload-profile-image
// Upload profile image
router.post('/upload-profile-image', require('../middleware/auth.cjs').requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Get current user to check for existing profile image
    const currentUser = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { profileImageUrl: true }
    });

    // Delete old profile image if it exists
    if (currentUser?.profileImageUrl) {
      await deleteProfileImage(currentUser.profileImageUrl);
    }

    // Get file extension from mimetype
    const extensionMap = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp'
    };
    const extension = extensionMap[req.file.mimetype] || 'jpg';

    // Upload new profile image
    const imageUrl = await uploadProfileImage(req.file.buffer, req.userId, extension);

    // Update user record with new profile image URL
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { profileImageUrl: imageUrl },
      select: {
        id: true,
        email: true,
        name: true,
        profileImageUrl: true,
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

    res.json({
      user: decryptedUser,
      message: 'Profile image uploaded successfully'
    });

  } catch (error) {
    console.error('Upload profile image error:', error);
    res.status(500).json({ error: 'Failed to upload profile image' });
  }
});

module.exports = router;
