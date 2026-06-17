const express = require('express');
const { requireAuth } = require('../middleware/auth.cjs');
const prisma = require('../services/db.cjs');
const { llmCall } = require('../llm/gateway.cjs');

const router = express.Router();
router.use(requireAuth);

// POST /api/abc-logs — create a new ABC log entry
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { logType, antecedents, behaviors, situations, places, persons, consequences, intensity, durationBucket, behaviorFunction, recordedAt } = req.body;

    const isPositive = logType === 'POSITIVE';

    if (isPositive && (!Array.isArray(antecedents) || antecedents.length === 0)) {
      return res.status(400).json({ error: 'at least one positive behavior is required' });
    }
    if (!isPositive && (!Array.isArray(antecedents) || antecedents.length === 0)) {
      return res.status(400).json({ error: 'at least one antecedent is required' });
    }
    if (!isPositive && (!Array.isArray(behaviors) || behaviors.length === 0)) {
      return res.status(400).json({ error: 'at least one behavior is required' });
    }

    const child = await prisma.child.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } });
    if (!child) return res.status(404).json({ error: 'no child profile found' });

    const data = {
      userId,
      childId: child.id,
      logType: logType || 'CHALLENGING',
      antecedents: antecedents || [],
      situations: situations || [],
      places: places || [],
      persons: persons || [],
      consequences: consequences || [],
    };
    if (Array.isArray(behaviors) && behaviors.length) data.behaviors = behaviors;
    if (intensity != null) data.intensity = Number(intensity);
    if (durationBucket) data.durationBucket = durationBucket;
    if (behaviorFunction) data.behaviorFunction = behaviorFunction;
    if (recordedAt) data.recordedAt = new Date(recordedAt);

    const log = await prisma.abcLog.create({ data });

    res.status(201).json({ log });
  } catch (err) {
    console.error('[abc-logs] POST error:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /api/abc-logs — list logs, optionally filtered
// Query params: ?since=ISO_DATE&limit=20&cursor=LOG_ID
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { since, limit = '20', cursor } = req.query;

    const where = { userId };
    if (since) where.recordedAt = { gte: new Date(since) };

    const take = Math.min(Number(limit), 100);
    const findOptions = { where, orderBy: { recordedAt: 'desc' }, take };
    if (cursor) { findOptions.cursor = { id: cursor }; findOptions.skip = 1; }

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

const MIN_LOGS_FOR_INSIGHT = 5;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function _formatLogTime(dt) {
  const hour = dt.getHours();
  if (hour === 0) return 'midnight';
  if (hour < 12) return `${hour}am`;
  if (hour === 12) return '12pm';
  return `${hour - 12}pm`;
}

// GET /api/abc-logs/insights — generate (or return cached) AI insight for this user's logs
router.get('/insights', async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch recent logs, child profile, and past insights in parallel
    const [allRecentLogs, user, child, pastInsights] = await Promise.all([
      prisma.abcLog.findMany({
        where: { userId },
        orderBy: { recordedAt: 'desc' },
        take: 30,
      }),
      prisma.user.findUnique({ where: { id: userId }, select: { childBirthYear: true, childBirthday: true, childConditions: true } }),
      prisma.child.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { conditions: true } }),
      prisma.abcInsight.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    const recentLogs = allRecentLogs.filter(l => l.logType !== 'POSITIVE').slice(0, 20);
    const recentPositiveLogs = allRecentLogs.filter(l => l.logType === 'POSITIVE').slice(0, 10);

    if (recentLogs.length === 0) {
      return res.status(404).json({ error: 'no logs found' });
    }

    // Require a minimum number of challenging logs before generating insights
    if (recentLogs.length < MIN_LOGS_FOR_INSIGHT) {
      return res.json({ needsMoreLogs: true, logsNeeded: MIN_LOGS_FOR_INSIGHT - recentLogs.length });
    }

    // Return cached insight if it was generated after the most recent log's submission time
    const latestLogSubmittedAt = recentLogs[0].createdAt;
    const latestInsight = pastInsights[0];
    if (latestInsight && latestInsight.createdAt > latestLogSubmittedAt) {
      return res.json({ insight: latestInsight.insight, cached: true });
    }

    // Build child age string
    const childAge = _childAge(user);

    // Resolve conditions safely — child.conditions may be an empty array (truthy but empty)
    const rawConditions = Array.isArray(child?.conditions) ? child.conditions.filter(Boolean) : null;
    const condStr = rawConditions?.length
      ? rawConditions.join(', ')
      : (typeof user?.childConditions === 'string' && user.childConditions.trim() ? user.childConditions : null);
    const conditions = condStr || 'not specified';

    // Format recent logs for the prompt — include day/time and use pipe separators
    const logsText = recentLogs.map((log, i) => {
      const dt = new Date(log.recordedAt || log.createdAt);
      const dayName = DAY_NAMES[dt.getDay()];
      const timeStr = _formatLogTime(dt);
      const parts = [];
      if (log.antecedents?.length) parts.push(`  Triggers: ${log.antecedents.join(' | ')}`);
      if (log.behaviors?.length) parts.push(`  Behavior: ${log.behaviors.join(' | ')}`);
      if (log.situations?.length) parts.push(`  Context: ${log.situations.join(' | ')}`);
      if (log.places?.length) parts.push(`  Place: ${log.places.join(' | ')}`);
      if (log.persons?.length) parts.push(`  People: ${log.persons.join(' | ')}`);
      if (log.consequences?.length) parts.push(`  Consequence: ${log.consequences.join(' | ')}`);
      if (log.intensity) parts.push(`  Intensity: ${log.intensity}/5`);
      if (log.durationBucket) parts.push(`  Duration: ${log.durationBucket}`);
      if (log.behaviorFunction) parts.push(`  Possible function: ${log.behaviorFunction}`);
      return `Log ${i + 1} (${dayName}, ${timeStr}):\n${parts.join('\n')}`;
    }).join('\n\n');

    // Past insights for novelty constraint — include both observation, strategy, and follow-up outcome
    const pastObservations = pastInsights.length > 0
      ? pastInsights
          .map((p, i) => {
            const obs = p.insight?.observation ?? '';
            const strat = p.insight?.strategy ?? '';
            let followUpLine = '';
            if (p.followUpRating != null) {
              const label = p.followUpRating <= 2 ? "didn't help" : p.followUpRating <= 3 ? 'somewhat helped' : 'helped';
              followUpLine = `\n   Parent follow-up: ${label} (${p.followUpRating}/5)`;
              if (p.followUpNote) followUpLine += ` — "${p.followUpNote}"`;
            }
            return `${i + 1}. Observation: ${obs}${strat ? `\n   Strategy given: ${strat}` : ''}${followUpLine}`;
          })
          .filter(s => s.length > 5)
          .join('\n')
      : 'None — this is the first insight.';

    // Include recent positive behaviors as context if available
    let positiveSummary = '';
    if (recentPositiveLogs.length > 0) {
      const posFreq = {};
      for (const log of recentPositiveLogs) {
        for (const tag of (log.antecedents || [])) {
          posFreq[tag] = (posFreq[tag] ?? 0) + 1;
        }
      }
      const topPos = Object.entries(posFreq).sort((a, b) => b[1] - a[1]).slice(0, 5);
      positiveSummary = `\nRecent Positive Behaviors Logged (${recentPositiveLogs.length} wins):\n${topPos.map(([tag, count]) => `  - ${tag} (${count}×)`).join('\n')}`;
    }

    const prompt = `Role: You are an empathetic, concise, and highly practical parenting coach trained in Parent-Child Interaction Therapy (PCIT).

Context: The user is a parent who has been logging their child's challenging behaviors using an ABC (Antecedent, Behavior, Consequence) framework.

Child's profile: age ${childAge}, condition: ${conditions}.

Recent Challenging Logs (most recent first):
${logsText}${positiveSummary}

Past Insights Already Given to This Parent:
${pastObservations}

Instructions:

1. Analyze: Review the recent logs holistically. Look for patterns across any dimension — time of day, day of week, triggers, places, people present, or consequences. Identify the single strongest or most surprising pattern.

2. Novelty Constraint: Check the past insights above. Your new observation and strategy must be meaningfully different from anything already given. Do not repeat a strategy that was previously provided.

3. Safety Constraint: Never suggest physical punishment, harsh consequences, or strategies that require the child to have skills they have not yet demonstrated. If the behavior involves self-harm or harm to others, acknowledge the difficulty without prescribing a strategy — instead encourage the parent to consult their therapist.

4. Draft the Insight as a 4-part message:

   Observation: State the specific pattern using their actual data (e.g., "I noticed 4 of your last 6 logs happened on weekday evenings, and in every case the trigger was being asked to stop screen time").

   Validation: In 1–2 sentences, validate how challenging this specific situation is for both parent and child.

   Strategy: Provide 3–4 numbered action steps the parent can take today. Each step should be one concrete sentence. Cover both the scenario where the child cooperates AND the scenario where the child refuses or escalates.

   Why it works: In 2–3 sentences, explain the mechanism behind the strategy and connect it to the child's profile if relevant.

5. PCIT Skill Reference: Where the strategy naturally aligns with a named PCIT skill, name it explicitly at the end of the "why" field so parents can connect it to what they are learning in the app. Use the exact names: Labeled Praise, Narration, Echo, Effective Command, Follow-Through, Strategic Ignoring. Only include a skill name if it genuinely fits — do not force it.

Tone & Formatting [STRICT]: Speak directly to the parent using "you" and "your child." Be warm but candid. Do not use clinical jargon. CRITICAL: Output only a valid JSON object — no markdown, no code blocks, no preamble. Use exactly these keys:

{
  "observation": "...",
  "validation": "...",
  "strategy": "...",
  "why": "..."
}`;

    const insight = await llmCall(prompt, {
      profile:      'abc-insight',
      label:        'abc-insight',
      _geminiConfig: { thinkingConfig: { thinkingBudget: 1024 } },
    });

    // Validate expected keys are present
    if (!insight.observation || !insight.validation || !insight.strategy || !insight.why) {
      throw new Error('LLM response missing required insight fields');
    }

    // Persist for caching and novelty tracking
    const saved = await prisma.abcInsight.create({ data: { userId, insight } });

    res.json({ insight, insightId: saved.id, cached: false });
  } catch (err) {
    console.error('[abc-logs] GET /insights error:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// GET /api/abc-logs/insights/latest — return the most recent insight record for the follow-up card
router.get('/insights/latest', async (req, res) => {
  try {
    const userId = req.user.id;
    const record = await prisma.abcInsight.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return res.status(404).json({ error: 'no insight found' });
    res.json({ insightId: record.id, insight: record.insight, followUpRating: record.followUpRating, followUpAt: record.followUpAt, createdAt: record.createdAt });
  } catch (err) {
    console.error('[abc-logs] GET /insights/latest error:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

// POST /api/abc-logs/insights/:id/followup — save parent's follow-up rating on an insight
router.post('/insights/:id/followup', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { rating, note } = req.body;

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be a number between 1 and 5' });
    }

    const record = await prisma.abcInsight.findFirst({ where: { id, userId } });
    if (!record) return res.status(404).json({ error: 'insight not found' });

    const updated = await prisma.abcInsight.update({
      where: { id },
      data: { followUpRating: rating, followUpNote: note ?? null, followUpAt: new Date() },
    });

    res.json({ insightId: updated.id, followUpRating: updated.followUpRating });
  } catch (err) {
    console.error('[abc-logs] POST /insights/:id/followup error:', err);
    res.status(500).json({ error: 'internal server error' });
  }
});

function _childAge(user) {
  if (!user) return 'age unknown';
  if (user.childBirthday) {
    const now = new Date();
    const birth = new Date(user.childBirthday);
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (months < 24) return `${months} months old`;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem > 0 ? `${years} years ${rem} months old` : `${years} years old`;
  }
  if (user.childBirthYear) {
    return `approximately ${new Date().getFullYear() - user.childBirthYear} years old`;
  }
  return 'age unknown';
}

module.exports = router;
