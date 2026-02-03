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
const { runPriorityEngine } = require('../services/priorityEngine.cjs');
const {
  ValidationError,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  AppError
} = require('../utils/errors.cjs');

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
  issue: Joi.string().min(1).optional(),
  therapistId: Joi.string().uuid().optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// POST /api/auth/signup
router.post('/signup', async (req, res, next) => {
  try {
    // Validate input
    const { error, value } = signupSchema.validate(req.body);
    if (error) {
      const errors = error.details.map(d => d.message);
      return next(new ValidationError(errors[0], errors));
    }

    const { email, password, name, childName, childBirthYear, childBirthday, childConditions, issue, therapistId } = value;

    // Create email hash for querying (since email will be encrypted)
    const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');

    // Check if user already exists (using emailHash)
    const existingUser = await prisma.user.findUnique({
      where: { emailHash }
    });

    if (existingUser) {
      return next(new ConflictError(
        'Email already exists in database',
        'This email is already registered. Please log in or use a different email.'
      ));
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Encrypt sensitive user data (email, name, childName)
    const encryptedData = encryptUserData({
      email,
      name,
      childName
    });

    // Create user with INACTIVE subscription status
    // Subscription will be activated by RevenueCat webhook after purchase
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
        subscriptionPlan: 'FREE',
        subscriptionStatus: 'INACTIVE',
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
    expiresAt.setDate(expiresAt.getDate() + 180); // 180 days (matches JWT_REFRESH_EXPIRY)

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
    // Pass all errors to global handler
    if (error instanceof AppError) {
      return next(error);
    }

    console.error('Signup error:', error);
    return next(new AppError(
      `Signup error: ${error.message}`,
      500,
      'SIGNUP_ERROR',
      'Failed to create account. Please try again or contact support.'
    ));
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return next(new ValidationError(error.details[0].message));
    }

    const { email, password } = value;

    // Create email hash for lookup (email is encrypted in DB)
    const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');

    // Find user by emailHash
    const user = await prisma.user.findUnique({
      where: { emailHash }
    });

    if (!user) {
      return next(new UnauthorizedError(
        'User not found',
        'No account found with this email. Please sign up.'
      ));
    }

    // Verify password
    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      return next(new UnauthorizedError(
        'Invalid password',
        'Incorrect password. Please try again.'
      ));
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
    expiresAt.setDate(expiresAt.getDate() + 180); // 180 days (matches JWT_REFRESH_EXPIRY)

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
        childConditions: decryptedUser.childConditions,
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionEndDate: user.subscriptionEndDate,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        relationshipToChild: user.relationshipToChild,
        createdAt: user.createdAt
      },
      accessToken,
      refreshToken
    });

  } catch (error) {
    // Pass all errors to global handler
    if (error instanceof AppError) {
      return next(error);
    }

    console.error('Login error:', error);
    return next(new AppError(
      `Login error: ${error.message}`,
      500,
      'LOGIN_ERROR',
      'Login failed. Please try again.'
    ));
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

// POST /api/auth/forgot-password
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Create email hash for lookup
    const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');

    // Find user by emailHash
    const user = await prisma.user.findUnique({
      where: { emailHash },
      select: { id: true }
    });

    // Always return success even if user not found (security best practice)
    if (!user) {
      return res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });
    }

    // Delete any existing unused reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        used: false
      }
    });

    // Generate reset token (32 random bytes = 64 hex characters)
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Token expires in 1 hour
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Store reset token
    await prisma.passwordResetToken.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        token: resetToken,
        expiresAt
      }
    });

    // Send reset email (use email from request, no need to decrypt from DB)
    // Use web URL that will redirect to app or show web form
    const resetUrl = `${process.env.WEB_APP_URL || 'https://hinora.co'}/reset-password?token=${resetToken}`;

    // Get email transporter from server.cjs
    const nodemailer = require('nodemailer');
    const emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    await emailTransporter.sendMail({
      from: `"Nora" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Reset Your Nora Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8C49D5;">Reset Your Password</h2>
          <p>Hi there,</p>
          <p>We received a request to reset your password for your Nora account. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #8C49D5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #6B7280; font-size: 14px; text-align: center;">Or copy and paste this link into your browser:</p>
          <p style="color: #6B7280; word-break: break-all; text-align: center; font-size: 12px;">${resetUrl}</p>
          <p style="margin-top: 30px; color: #6B7280; font-size: 14px;">This link will expire in 1 hour.</p>
          <p style="color: #6B7280; font-size: 14px;">If you didn't request this password reset, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
          <p style="color: #9CA3AF; font-size: 12px; text-align: center;">Nora - Parent-Child Interaction Therapy</p>
        </div>
      `
    });

    res.json({ message: 'If an account exists with this email, a password reset link has been sent.' });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      return res.status(400).json({ error: 'Password must contain at least 1 uppercase, 1 lowercase, and 1 number' });
    }

    // Find reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { User: true }
    });

    if (!resetToken) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    // Check if token has expired
    if (resetToken.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    // Check if token has been used
    if (resetToken.used) {
      return res.status(400).json({ error: 'Reset token has already been used' });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update user's password
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash: newPasswordHash }
    });

    // Mark token as used
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true }
    });

    // Invalidate all refresh tokens for security
    await prisma.refreshToken.deleteMany({
      where: { userId: resetToken.userId }
    });

    res.json({ message: 'Password reset successfully' });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
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
        childGender: true,
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
    const { name, relationshipToChild, childName, childGender, childBirthday, issue } = req.body;

    // Validate at least one field is provided
    if (!name && !relationshipToChild && !childName && !childGender && !childBirthday && !issue) {
      return res.status(400).json({ error: 'At least one field required' });
    }

    // Build update data
    const updateData = {};

    if (name) {
      const encryptedName = encryptSensitiveData(name);
      updateData.name = encryptedName;
    }

    if (relationshipToChild) {
      const validRelationships = ['MOTHER', 'FATHER', 'GRANDMOTHER', 'GRANDFATHER', 'GUARDIAN', 'OTHER'];
      if (!validRelationships.includes(relationshipToChild)) {
        return res.status(400).json({ error: 'Invalid relationshipToChild value' });
      }
      updateData.relationshipToChild = relationshipToChild;
    }

    if (childName) {
      const encryptedChildName = encryptSensitiveData(childName);
      updateData.childName = encryptedChildName;
    }

    if (childGender) {
      const validGenders = ['BOY', 'GIRL', 'OTHER'];
      if (!validGenders.includes(childGender)) {
        return res.status(400).json({ error: 'Invalid childGender value' });
      }
      updateData.childGender = childGender;
    }

    if (childBirthday) {
      updateData.childBirthday = new Date(childBirthday);
      // Also update childBirthYear for backwards compatibility
      updateData.childBirthYear = new Date(childBirthday).getFullYear();
    }

    if (issue) {
      // Handle both string and array of issues
      // Note: We accept any string value to allow custom free-text input from "Others" option
      if (Array.isArray(issue)) {
        // Validate all issues are non-empty strings
        const invalidIssues = issue.filter(i => typeof i !== 'string' || i.trim() === '');
        if (invalidIssues.length > 0) {
          return res.status(400).json({ error: 'All issue values must be non-empty strings' });
        }
        // Store as JSON string for database
        updateData.issue = JSON.stringify(issue);
      } else {
        // Single issue (backward compatibility)
        if (typeof issue !== 'string' || issue.trim() === '') {
          return res.status(400).json({ error: 'Issue value must be a non-empty string' });
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
        relationshipToChild: true,
        childName: true,
        childGender: true,
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

    // Run priority engine if issue was provided (fire-and-forget)
    if (issue) {
      runPriorityEngine(req.userId).catch(err => {
        console.error('[PRIORITY-ENGINE] Error during onboarding:', err.message);
      });
    }

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

/**
 * POST /api/auth/push-token
 * Register or update user's push notification token
 * Requires authentication
 */
router.post('/push-token', async (req, res) => {
  try {
    const { requireAuth } = require('../middleware/auth.cjs');
    await requireAuth(req, res, async () => {
      const { pushToken } = req.body;

      if (!pushToken || typeof pushToken !== 'string') {
        return res.status(400).json({
          error: 'Invalid push token',
          details: 'pushToken is required and must be a string'
        });
      }

      const { registerPushToken } = require('../services/pushNotifications.cjs');
      const success = await registerPushToken(req.userId, pushToken);

      if (success) {
        console.log(`[AUTH] Push token registered for user ${req.userId.substring(0, 8)}`);
        res.json({ success: true, message: 'Push token registered successfully' });
      } else {
        res.status(400).json({ error: 'Failed to register push token' });
      }
    });
  } catch (error) {
    console.error('[AUTH] Error registering push token:', error);
    res.status(500).json({ error: 'Failed to register push token' });
  }
});

/**
 * DELETE /api/auth/push-token
 * Unregister user's push notification token
 * Requires authentication
 */
router.delete('/push-token', async (req, res) => {
  try {
    const { requireAuth } = require('../middleware/auth.cjs');
    await requireAuth(req, res, async () => {
      const { unregisterPushToken } = require('../services/pushNotifications.cjs');
      const success = await unregisterPushToken(req.userId);

      if (success) {
        console.log(`[AUTH] Push token unregistered for user ${req.userId.substring(0, 8)}`);
        res.json({ success: true, message: 'Push token unregistered successfully' });
      } else {
        res.status(500).json({ error: 'Failed to unregister push token' });
      }
    });
  } catch (error) {
    console.error('[AUTH] Error unregistering push token:', error);
    res.status(500).json({ error: 'Failed to unregister push token' });
  }
});

/**
 * DELETE /api/auth/delete-account
 * Delete user account by anonymizing personal data
 * Requires authentication
 *
 * This endpoint complies with Apple's App Store guideline 5.1.1(v) requiring
 * apps that support account creation to also support account deletion.
 *
 * Instead of deleting records, we anonymize the account by wiping PII fields.
 * This preserves session data for analytics while removing identifiable information.
 */
router.delete('/delete-account', require('../middleware/auth.cjs').requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`[AUTH] Account deletion requested for user ${userId.substring(0, 8)}`);

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete all refresh tokens for this user (prevents future login)
    await prisma.refreshToken.deleteMany({
      where: { userId }
    });

    // Delete any password reset tokens
    await prisma.passwordResetToken.deleteMany({
      where: { userId }
    });

    // Anonymize the user by wiping PII fields
    // This keeps the record and related data but removes identifiable information
    // Use placeholder values for required fields
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted_${userId}`, // Placeholder for required field
        emailHash: `deleted_${userId}`, // Unique placeholder to satisfy unique constraint
        passwordHash: '',
        name: '',
        childName: '',
        pushToken: null,
        pushTokenUpdatedAt: null
      }
    });

    console.log(`[AUTH] Account anonymized successfully for user ${userId.substring(0, 8)}`);

    res.json({
      success: true,
      message: 'Account deleted successfully.'
    });

  } catch (error) {
    console.error('[AUTH] Account deletion error:', error);
    res.status(500).json({
      error: 'Failed to delete account',
      details: 'An error occurred while deleting your account. Please try again or contact support.'
    });
  }
});

module.exports = router;
