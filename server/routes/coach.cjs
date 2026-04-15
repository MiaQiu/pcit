'use strict';

// AI coaching chat route
const express = require('express');
const { requireAuth } = require('../middleware/auth.cjs');
const { geminiCall } = require('../llm/providers/gemini.cjs');
const { logLLMCall } = require('../llm/logger.cjs');
const prisma = require('../services/db.cjs');

const router = express.Router();
router.use(requireAuth);

const MODEL = 'gemini-3-pro-preview';
const MAX_HISTORY_MESSAGES = 20; // 10 turns (user + model each)

// ─── Helpers (mirrored from pcitAnalysisService) ──────────────────────────────

function calculateChildAgeInMonths(birthday, birthYear) {
  const today = new Date();
  if (birthday) {
    const birthDate = new Date(birthday);
    return (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());
  }
  return (today.getFullYear() - (birthYear || today.getFullYear())) * 12;
}

function formatGender(genderEnum) {
  return { BOY: 'boy', GIRL: 'girl', OTHER: 'child' }[genderEnum] || 'child';
}

function formatIssueLabel(row) {
  if (row?.fromUserIssue && row.userIssues) {
    try { return JSON.parse(row.userIssues).map(i => i.replace(/_/g, ' ').toLowerCase()).join(', '); } catch (_) {}
  }
  if (row?.fromWacb && row.wacbQuestions) {
    try { return JSON.parse(row.wacbQuestions).join(', '); } catch (_) {}
  }
  return row?.clinicalLevel ? row.clinicalLevel.replace(/_/g, ' ').toLowerCase() : 'none';
}

// ─── Load child context for this user ────────────────────────────────────────

async function loadChildContext(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { childName: true, childBirthday: true, childBirthYear: true, childGender: true },
  });

  const child = await prisma.child.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, birthday: true, gender: true },
  });

  const childName = child?.name || user?.childName || 'your child';
  const birthday  = child?.birthday || user?.childBirthday || null;
  const birthYear = user?.childBirthYear || null;
  const gender    = formatGender(child?.gender || user?.childGender);
  const ageMonths = calculateChildAgeInMonths(birthday, birthYear);

  // Latest ChildIssuePriority snapshot
  let primaryIssueText = 'none';
  let otherIssuesText  = 'none';
  if (child?.id) {
    const latestSnapshot = await prisma.childIssuePriority.findFirst({
      where: { childId: child.id },
      orderBy: { computedAt: 'desc' },
      select: { computedAt: true },
    });
    if (latestSnapshot) {
      const rows = await prisma.childIssuePriority.findMany({
        where: { childId: child.id, computedAt: latestSnapshot.computedAt },
        orderBy: { priorityRank: 'asc' },
      });
      const primaryRow   = rows.find(r => r.priorityRank === 1);
      const otherRows    = rows.filter(r => r.priorityRank > 1);
      primaryIssueText   = primaryRow ? formatIssueLabel(primaryRow) : 'none';
      otherIssuesText    = otherRows.length > 0 ? otherRows.map(r => formatIssueLabel(r)).join(', ') : 'none';
    }
  }

  return { childName, ageMonths, gender, primaryIssueText, otherIssuesText };
}

// ─── Build system prompt ──────────────────────────────────────────────────────

function buildSystemPrompt({ childName, ageMonths, gender, primaryIssueText, otherIssuesText }) {
  return `**ROLE & OBJECTIVE**

You are an expert Child Psychologist and PCIT (Parent-Child Interaction Therapy) Therapist for a family. Your goal is to provide chat services to parents, answering their questions (e.g. the skills Nora teaches, insights about their child).

**Instructions**
1. Strictly do not answer questions that are out of scope.
2. We have branded the special time as "emotional massage" and the score is a deposit to their emotional bank account. Do not mention PCIT in your conversation with parents.
3. As a master coach, reply in a way that is easy to read on a mobile screen (no tables), and sounds like a human therapist.  Do not use emoji.

**Child Information:**
- Name: ${childName}
- Age: ${ageMonths} months old
- Gender: ${gender}

**Issue Priority (from assessment):**
- Primary Issue: ${primaryIssueText}
- Other Issues: ${otherIssuesText}`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * GET /api/coach/history
 * Returns the authenticated user's full chat history (all roles), oldest first.
 */
router.get('/history', async (req, res, next) => {
  try {
    const messages = await prisma.coachChatMessage.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, text: true, createdAt: true },
    });
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/coach/chat
 * Body: { message: string }
 * Returns: { reply: string }
 */
router.post('/chat', async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }

    const userText = message.trim();

    // 1. Load child context + history in parallel
    const [childContext, dbHistory] = await Promise.all([
      loadChildContext(req.userId),
      prisma.coachChatMessage.findMany({
        where: { userId: req.userId },
        orderBy: { createdAt: 'desc' },
        take: MAX_HISTORY_MESSAGES,
        select: { role: true, text: true },
      }),
    ]);
    dbHistory.reverse(); // desc → chronological

    // 2. Build Gemini native contents array
    const contents = [
      ...dbHistory.map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text }],
      })),
      { role: 'user', parts: [{ text: userText }] },
    ];

    // 3. Call Gemini with proper multi-turn structure + child-aware system prompt
    const start = Date.now();
    let result;
    try {
      result = await geminiCall(
        process.env.GEMINI_API_KEY,
        MODEL,
        {
          system_instruction: { parts: [{ text: buildSystemPrompt(childContext) }] },
          contents,
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 2048,
          },
        },
        { timeout: 30_000 }
      );
    } catch (llmErr) {
      logLLMCall({
        label: 'coach-chat', model: MODEL, provider: 'gemini',
        latencyMs: Date.now() - start,
        inputTokens: null, outputTokens: null,
        hasSchema: false, usedFallback: false, usedRepair: false, usedRetry: false,
        ok: false, error: llmErr.message,
      });
      throw llmErr;
    }

    logLLMCall({
      label: 'coach-chat', model: MODEL, provider: 'gemini',
      latencyMs: Date.now() - start,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      hasSchema: false, usedFallback: false, usedRepair: false, usedRetry: false,
      ok: true, error: null,
    });

    const reply = result.text.trim();

    // 4. Persist both turns
    await prisma.coachChatMessage.createMany({
      data: [
        { userId: req.userId, role: 'user', text: userText },
        { userId: req.userId, role: 'model', text: reply },
      ],
    });

    res.json({ reply });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
