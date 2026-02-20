// Social Authentication routes (Google, Facebook, Apple)
const express = require('express');
const Joi = require('joi');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const prisma = require('../services/db.cjs');
const { generateAccessToken, generateRefreshToken } = require('../utils/jwt.cjs');
const { encryptUserData, decryptUserData } = require('../utils/encryption.cjs');

// Apple JWKS cache
let appleKeysCache = null;
let appleKeysCacheTime = 0;
const APPLE_KEYS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

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
        const facebookUser = await verifyFacebookToken(idToken);
        if (!facebookUser) {
          return res.status(401).json({ error: 'Invalid Facebook token' });
        }
        email = facebookUser.email || providedEmail;
        if (!email) {
          return res.status(400).json({ error: 'Email not available from Facebook. Please grant email permission.' });
        }
        name = facebookUser.name || providedName || email.split('@')[0];
        sub = `facebook_${facebookUser.sub}`;
        break;

      case 'apple':
        const appleUser = await verifyAppleToken(idToken);
        if (!appleUser) {
          return res.status(401).json({ error: 'Invalid Apple token' });
        }
        email = appleUser.email || providedEmail;
        if (!email) {
          return res.status(400).json({ error: 'Email not available from Apple. Please re-authenticate to grant email permission.' });
        }
        name = providedName || email.split('@')[0];
        sub = `apple_${appleUser.sub}`;
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

      const encryptedChildName = encryptUserData({ childName: 'Child' }).childName;
      user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: encryptedData.email,
          emailHash,
          passwordHash: crypto.randomBytes(32).toString('hex'), // Random password for social auth
          name: encryptedData.name,
          childName: encryptedChildName,
          childBirthYear: new Date().getFullYear() - 5, // Placeholder, matches email signup
          childConditions: JSON.stringify(['none']), // Will be updated during onboarding
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
 * Verify Facebook access token using the Graph API debug_token endpoint.
 * Requires FACEBOOK_APP_ID and FACEBOOK_APP_SECRET env vars.
 */
async function verifyFacebookToken(accessToken) {
  try {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error('FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be set');
    }

    // Validate token against our app using the debug_token endpoint
    const appToken = `${appId}|${appSecret}`;
    const debugRes = await fetch(
      `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`
    );
    const debugData = await debugRes.json();

    if (!debugData.data?.is_valid || debugData.data.app_id !== appId) {
      console.error('Facebook token invalid or issued for wrong app:', debugData);
      return null;
    }

    // Fetch user profile
    const meRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`
    );
    const meData = await meRes.json();

    if (meData.error || !meData.id) {
      console.error('Facebook /me error:', meData.error);
      return null;
    }

    return {
      sub: meData.id,
      email: meData.email || null,
      name: meData.name || null,
    };
  } catch (error) {
    console.error('Facebook token verification error:', error);
    return null;
  }
}

/**
 * Verify Apple identity token (JWT) using Apple's published JWKS.
 * Requires APPLE_BUNDLE_ID env var (defaults to com.chromamind.nora).
 */
async function verifyAppleToken(idToken) {
  try {
    // Fetch Apple's public keys (with caching)
    const now = Date.now();
    if (!appleKeysCache || now - appleKeysCacheTime > APPLE_KEYS_CACHE_TTL) {
      const keysRes = await fetch('https://appleid.apple.com/auth/keys');
      if (!keysRes.ok) throw new Error('Failed to fetch Apple public keys');
      const { keys } = await keysRes.json();
      appleKeysCache = keys;
      appleKeysCacheTime = now;
    }

    // Decode the JWT header to find the matching key by kid
    const [headerB64] = idToken.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
    const jwk = appleKeysCache.find(k => k.kid === header.kid);

    if (!jwk) {
      console.error('Apple public key not found for kid:', header.kid);
      return null;
    }

    // Convert JWK to a Node crypto public key and verify the JWT
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const bundleId = process.env.APPLE_BUNDLE_ID || 'com.chromamind.nora';

    const payload = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
      audience: bundleId,
    });

    return {
      sub: payload.sub,
      email: payload.email || null,
    };
  } catch (error) {
    console.error('Apple token verification error:', error);
    return null;
  }
}

/**
 * Verify Google ID token
 */
async function verifyGoogleToken(idToken) {
  try {
    // Decode the payload to read the aud claim before verification
    const [, payloadB64] = idToken.split('.');
    const unverifiedPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    const tokenAud = Array.isArray(unverifiedPayload.aud)
      ? unverifiedPayload.aud[0]
      : unverifiedPayload.aud;

    // Confirm the audience is one of our own Google client IDs
    const knownClientIds = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
    ].filter(Boolean);

    if (!knownClientIds.includes(tokenAud)) {
      console.error('Google token has unrecognised audience:', tokenAud);
      return null;
    }

    // Now verify the signature using the exact audience from the token
    const client = new OAuth2Client();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: tokenAud,
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
