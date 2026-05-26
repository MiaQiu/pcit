const express = require('express');
const { requireAuth } = require('../middleware/auth.cjs');
const prisma = require('../services/db.cjs');

const router = express.Router();
router.use(requireAuth);

// POST /api/abc-logs — create a new ABC log entry
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { logType, antecedents, behaviors, consequences, intensity, durationBucket } = req.body;

    if (!Array.isArray(behaviors) || behaviors.length === 0) {
      return res.status(400).json({ error: 'at least one behavior is required' });
    }

    // Resolve the first child for this user
    const child = await prisma.child.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
    if (!child) return res.status(404).json({ error: 'no child profile found' });

    const log = await prisma.abcLog.create({
      data: {
        userId,
        childId: child.id,
        logType: logType || 'CHALLENGING',
        antecedents: antecedents || [],
        behaviors,
        consequences: consequences || [],
        intensity: intensity ? Number(intensity) : null,
        durationBucket: durationBucket || null,
      },
    });

    res.status(201).json({ log });
  } catch (err) {
    console.error('[abc-logs] POST error:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /api/abc-logs — list logs for the current user, optionally filtered by week
// Query params: ?since=ISO_DATE&limit=20&cursor=LOG_ID
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { since, limit = '20', cursor } = req.query;

    const where = { userId };
    if (since) {
      where.recordedAt = { gte: new Date(since) };
    }

    const take = Math.min(Number(limit), 100);
    const findOptions = { where, orderBy: { recordedAt: 'desc' }, take };
    if (cursor) {
      findOptions.cursor = { id: cursor };
      findOptions.skip = 1;
    }

    const [logs, total] = await Promise.all([
      prisma.abcLog.findMany(findOptions),
      prisma.abcLog.count({ where }),
    ]);

    res.json({ logs, total });
  } catch (err) {
    console.error('[abc-logs] GET error:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

module.exports = router;
