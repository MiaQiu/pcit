const express = require('express');
const prisma = require('../services/db.cjs');
const { requireAuth } = require('../middleware/auth.cjs');

const router = express.Router();
const CODE_LENGTH = 8;

/**
 * POST /api/share-links
 * Body: { targetUrl }. Upserted by targetUrl so repeat shares of the same
 * card/lesson reuse the same short code instead of accumulating duplicates.
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const targetUrl = typeof req.body.targetUrl === 'string' ? req.body.targetUrl.trim() : '';
    if (!targetUrl) return res.status(400).json({ error: 'targetUrl is required' });

    const existing = await prisma.shortLink.findUnique({ where: { targetUrl } });
    let code = existing?.code;
    if (!code) {
      // nanoid v5 is ESM-only — a plain require('nanoid') throws ERR_REQUIRE_ESM in this .cjs file.
      const { nanoid } = await import('nanoid');
      for (let attempt = 0; attempt < 5 && !code; attempt++) {
        try {
          const row = await prisma.shortLink.create({ data: { code: nanoid(CODE_LENGTH), targetUrl } });
          code = row.code;
        } catch (err) {
          if (err.code === 'P2002' && err.meta?.target?.includes('code')) continue; // code collision, retry
          if (err.code === 'P2002') { // lost a race on targetUrl — reread what won
            code = (await prisma.shortLink.findUnique({ where: { targetUrl } }))?.code;
          } else {
            throw err;
          }
        }
      }
      if (!code) return res.status(500).json({ error: 'Failed to generate short link' });
    }

    const webUrl = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:3001';
    res.json({ shortUrl: `${webUrl}/s/${code}` });
  } catch (error) {
    console.error('Create share link error:', error);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

module.exports = router;
