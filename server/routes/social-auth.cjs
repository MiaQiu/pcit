// Social Authentication routes (Google, Facebook, Apple)
const express = require('express');
const Joi = require('joi');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const prisma = require('../services/db.cjs');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt.cjs');
const { encryptUserData, decryptUserData } = require('../utils/encryption.cjs');

const router = express.Router();

// Validation schema
const socialAuthSchema = Joi.object({
  name: Joi.string().valid('google', 'facebook', 'apple').required(),
  idToken: Joi.string().required(),
  accessToken: Joi.string().optional(),
  email: Joi.string().email().optional(),
  userName: Joi.string().optional(),
});

/**
 * POST /api/auth/social
 * Authenticate with social provider (Google, Facebook, or Apple)
 */
router.post('/social', async (req, res) => {
  try {
    // Validate input
    const { error, value } = socialAuthSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name: provider, idToken, email: providedEmail, userName: providedName } = value;

    let email, name, sub;

    // Verify token and extract user info based on provider
    switch (provider) {
      case 'google':
        const googleUser = await verifyGoogleToken(idToken);
        if (!googleUser) {
          return res.status(401).json({ error: 'Invalid Google token' });
        }
        email = googleUser.email;
        name = googleUser.name;
        sub = `google_${googleUser.sub}`;
        break;

      case 'facebook':
        // For Facebook, we trust the client has validated the token
        // In production, verify with Facebook API
        if (!providedEmail) {
          return res.status(400).json({ error: 'Email required for Facebook auth' });
        }
        email = providedEmail;
        name = providedName || email.split('@')[0];
        sub = `facebook_${idToken.substring(0, 20)}`;
        break;

      case 'apple':
        // For Apple, verify the identity token
        // In production, verify with Apple's public keys
        if (!providedEmail) {
          return res.status(400).json({ error: 'Email required for Apple auth' });
        }
        email = providedEmail;
        name = providedName || email.split('@')[0];
        sub = `apple_${idToken.substring(0, 20)}`;
        break;

      default:
        return res.status(400).json({ error: 'Unsupported provider' });
    }

    // Create email hash for querying
    const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { emailHash },
    });

    if (!user) {
      // Create new user
      const encryptedData = encryptUserData({
        email,
        name,
        childName: 'Not Set', // Will be updated during onboarding
      });

      user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: encryptedData.email,
          emailHash,
          passwordHash: crypto.randomBytes(32).toString('hex'), // Random password for social auth
          name: encryptedData.name,
          childName: encryptedData.childName,
          childBirthYear: new Date().getFullYear(), // Placeholder
          childConditions: JSON.stringify([]), // Will be updated during onboarding
        },
      });
    }

    // Decrypt user data
    const decryptedUser = decryptUserData(user);

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: decryptedUser.email,
    });

    const refreshToken = generateRefreshToken({
      userId: user.id,
    });

    // Store refresh token
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.upsert({
      where: { userId: user.id },
      update: {
        tokenHash: refreshTokenHash,
        expiresAt,
      },
      create: {
        id: crypto.randomUUID(),
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt,
      },
    });

    res.json({
      user: {
        id: decryptedUser.id,
        email: decryptedUser.email,
        name: decryptedUser.name,
        childName: decryptedUser.childName,
        childBirthYear: decryptedUser.childBirthYear,
        childConditions: decryptedUser.childConditions,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('Social auth error:', error);
    res.status(500).json({ error: 'Social authentication failed' });
  }
});

/**
 * Verify Google ID token
 */
async function verifyGoogleToken(idToken) {
  try {
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  } catch (error) {
    console.error('Google token verification error:', error);
    return null;
  }
}

module.exports = router;
