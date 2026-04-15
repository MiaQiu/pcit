'use strict';

// AI coaching chat route — Gemini function-calling agent
const express = require('express');
const fetch   = require('node-fetch');
const { requireAuth } = require('../middleware/auth.cjs');
const { logLLMCall }  = require('../llm/logger.cjs');
const prisma          = require('../services/db.cjs');

const router = express.Router();
router.use(requireAuth);

const MODEL           = 'gemini-2.5-pro-preview-05-06';
const MAX_AGENT_TURNS = 6;          // tool-call rounds before giving up
const MAX_HISTORY_MESSAGES = 20;    // conversation turns sent to LLM

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateChildAgeInMonths(birthday, birthYear) {
  const today = new Date();
  if (birthday) {
    const d = new Date(birthday);
    return (today.getFullYear() - d.getFullYear()) * 12 + (today.getMonth() - d.getMonth());
  }
  return (today.getFullYear() - (birthYear || today.getFullYear())) * 12;
}

function formatGender(g) {
  return { BOY: 'boy', GIRL: 'girl', OTHER: 'child' }[g] || 'child';
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

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `**ROLE & OBJECTIVE**

You are an expert Child Psychologist and PCIT (Parent-Child Interaction Therapy) Therapist acting as an AI coaching assistant for parents using the Nora app. Your goal is to answer parents' questions with empathy, clinical insight, and personalised context retrieved from the database.

**Instructions**
1. Use your tools to retrieve relevant data before answering — you do not need to call all tools for every message; decide which data is actually relevant.
2. Strictly do not answer questions that are out of scope. State your limitation as AI. If something requires a human professional, advise the parent to tap "Talk to a Psychologist".
3. We have branded the special time as "emotional massage" and the score is a deposit to their "emotional bank account". Do not mention PCIT in conversation with parents.
4. Reply in a way that is easy to read on a mobile screen (no tables, no emoji). Sound like a warm, human therapist.
5. When discussing skill metrics: Labeled Praises, Reflections, Behavioral Descriptions are the skills to build (goal 10+ each). Questions, Commands, and Criticisms are the skills to reduce.`;

// ─── Tool declarations (sent to Gemini) ───────────────────────────────────────

const TOOL_DECLARATIONS = [
  {
    name: 'get_child_profile',
    description: "Retrieve the child's profile: name, age in months, gender, primary behavioural issue, secondary issues from assessment, and the two most recent developmental profiling snapshots (summary and metadata). Call this when the parent asks about their child, developmental progress, or when personalisation is needed.",
    parameters: { type: 'OBJECT', properties: {}, required: [] },
  },
  {
    name: 'get_recent_sessions',
    description: "Retrieve recent emotional massage (play) session data including date, duration, overall score, and skill counts (praises, reflections, narrations, questions, commands, criticisms). Call this when the parent asks about recent sessions, their performance, or their scores.",
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'NUMBER', description: 'Number of recent sessions to retrieve (1–10, default 5)' },
      },
      required: [],
    },
  },
  {
    name: 'get_skill_progress',
    description: "Retrieve a time-series of skill metrics across multiple sessions (oldest first) to identify trends and progress over time. Call this when the parent asks about improvement, trends, or how they are progressing.",
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'NUMBER', description: 'Number of sessions to include in trend (default 10, max 20)' },
      },
      required: [],
    },
  },
  {
    name: 'get_coaching_history',
    description: "Retrieve coaching summaries and tomorrow's goals from recent sessions. Call this when the parent asks what the coach previously said, what to work on, or what their focus area has been.",
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'NUMBER', description: 'Number of recent sessions with coaching to retrieve (default 3)' },
      },
      required: [],
    },
  },
];

// ─── Tool implementations (DB queries) ────────────────────────────────────────

async function toolGetChildProfile(userId) {
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

  let primaryIssue = 'none';
  let otherIssues  = 'none';
  if (child?.id) {
    const snap = await prisma.childIssuePriority.findFirst({
      where: { childId: child.id },
      orderBy: { computedAt: 'desc' },
      select: { computedAt: true },
    });
    if (snap) {
      const rows = await prisma.childIssuePriority.findMany({
        where: { childId: child.id, computedAt: snap.computedAt },
        orderBy: { priorityRank: 'asc' },
      });
      const primary = rows.find(r => r.priorityRank === 1);
      const others  = rows.filter(r => r.priorityRank > 1);
      primaryIssue  = primary ? formatIssueLabel(primary) : 'none';
      otherIssues   = others.length ? others.map(r => formatIssueLabel(r)).join(', ') : 'none';
    }
  }

  // Latest two ChildProfiling snapshots (summary + metadata)
  const profilingSnapshots = child?.id
    ? await prisma.childProfiling.findMany({
        where: { childId: child.id },
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: { createdAt: true, summary: true, metadata: true },
      })
    : [];

  return {
    childName,
    ageMonths,
    gender,
    primaryIssue,
    otherIssues,
    profilingSnapshots: profilingSnapshots.map(p => ({
      date: p.createdAt.toISOString().slice(0, 10),
      summary: p.summary ?? null,
      metadata: p.metadata ?? null,
    })),
  };
}

async function toolGetRecentSessions(userId, limit = 5) {
  const n = Math.min(Math.max(1, Number(limit) || 5), 10);
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: n,
    select: {
      id: true,
      createdAt: true,
      durationSeconds: true,
      overallScore: true,
      tagCounts: true,
      coachingSummary: true,
      coachingCards: true,
    },
  });
  return sessions.map((s, idx) => {
    const tc = (s.tagCounts && typeof s.tagCounts === 'object') ? s.tagCounts : {};
    return {
      date: s.createdAt.toISOString().slice(0, 10),
      durationMinutes: Math.round((s.durationSeconds || 0) / 60),
      overallScore: s.overallScore ?? null,
      skills: {
        labeledPraises:         tc.praise    ?? 0,
        reflections:            tc.echo      ?? 0,
        behavioralDescriptions: tc.narration ?? 0,
        questions:              tc.question  ?? 0,
        commands:               tc.command   ?? 0,
        criticisms:             tc.criticism ?? 0,
      },
      coachingSummary: s.coachingSummary || null,
      // Include coachingCards for the two most recent sessions only
      coachingCards: idx < 2 ? (s.coachingCards ?? null) : undefined,
    };
  });
}

async function toolGetSkillProgress(userId, limit = 10) {
  const n = Math.min(Math.max(1, Number(limit) || 10), 20);
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: n,
    select: { createdAt: true, overallScore: true, tagCounts: true },
  });
  sessions.reverse(); // show oldest → newest for trend reading
  return sessions.map(s => {
    const tc = (s.tagCounts && typeof s.tagCounts === 'object') ? s.tagCounts : {};
    return {
      date: s.createdAt.toISOString().slice(0, 10),
      overallScore:           s.overallScore ?? null,
      labeledPraises:         tc.praise    ?? 0,
      reflections:            tc.echo      ?? 0,
      behavioralDescriptions: tc.narration ?? 0,
      questions:              tc.question  ?? 0,
      commands:               tc.command   ?? 0,
      criticisms:             tc.criticism ?? 0,
    };
  });
}

async function toolGetCoachingHistory(userId, limit = 3) {
  const n = Math.min(Math.max(1, Number(limit) || 3), 5);
  const sessions = await prisma.session.findMany({
    where: { userId, NOT: { coachingSummary: null } },
    orderBy: { createdAt: 'desc' },
    take: n,
    select: { createdAt: true, coachingSummary: true, coachingCards: true },
  });
  return sessions.map(s => ({
    date: s.createdAt.toISOString().slice(0, 10),
    coachingSummary: s.coachingSummary,
    tomorrowGoal: (s.coachingCards && typeof s.coachingCards === 'object')
      ? s.coachingCards.tomorrowGoal ?? null
      : null,
  }));
}

async function executeTool(name, args, userId) {
  switch (name) {
    case 'get_child_profile':    return toolGetChildProfile(userId);
    case 'get_recent_sessions':  return toolGetRecentSessions(userId, args?.limit);
    case 'get_skill_progress':   return toolGetSkillProgress(userId, args?.limit);
    case 'get_coaching_history': return toolGetCoachingHistory(userId, args?.limit);
    default:                     return { error: `Unknown tool: ${name}` };
  }
}

// ─── Gemini agent loop ────────────────────────────────────────────────────────

async function runAgentLoop(userId, userText, dbHistory) {
  const contents = [
    ...dbHistory.map(m => ({
      role: m.role === 'model' || m.role === 'psychologist' ? 'model' : 'user',
      parts: [{ text: m.text }],
    })),
    { role: 'user', parts: [{ text: userText }] },
  ];

  const baseBody = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    tools: [{ function_declarations: TOOL_DECLARATIONS }],
    generationConfig: { temperature: 0.8, maxOutputTokens: 2048 },
  };

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  let totalInput = 0;
  let totalOutput = 0;

  for (let turn = 0; turn < MAX_AGENT_TURNS; turn++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    let raw;
    try {
      raw = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...baseBody, contents }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!raw.ok) {
      const errText = await raw.text().catch(() => '');
      throw Object.assign(new Error(`Gemini API error ${raw.status}: ${errText.slice(0, 200)}`), { status: raw.status });
    }

    const data = await raw.json();
    totalInput  += data.usageMetadata?.promptTokenCount     ?? 0;
    totalOutput += data.usageMetadata?.candidatesTokenCount ?? 0;

    const parts  = data.candidates?.[0]?.content?.parts ?? [];
    const textPart = parts.find(p => typeof p.text === 'string');
    const fnParts  = parts.filter(p => p.functionCall);

    if (textPart) {
      return { text: textPart.text, usage: { inputTokens: totalInput, outputTokens: totalOutput } };
    }

    if (fnParts.length === 0) {
      throw new Error('Gemini returned no text and no function calls');
    }

    // Append model's tool-call turn
    contents.push({ role: 'model', parts: fnParts });

    // Execute tools (in parallel) and append results
    const responseParts = await Promise.all(
      fnParts.map(async p => {
        const result = await executeTool(p.functionCall.name, p.functionCall.args ?? {}, userId);
        return { functionResponse: { name: p.functionCall.name, response: { result } } };
      })
    );
    contents.push({ role: 'user', parts: responseParts });
  }

  throw new Error('Agent exceeded maximum tool-call turns without producing a reply');
}

// ─── Routes ───────────────────────────────────────────────────────────────────

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

    // Load conversation history (exclude psychologist messages from LLM context)
    const dbHistory = await prisma.coachChatMessage.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_HISTORY_MESSAGES,
      select: { role: true, text: true },
    });
    dbHistory.reverse();

    const start = Date.now();
    let result;
    try {
      result = await runAgentLoop(req.userId, userText, dbHistory);
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

    await prisma.coachChatMessage.createMany({
      data: [
        { userId: req.userId, role: 'user',  text: userText },
        { userId: req.userId, role: 'model', text: reply },
      ],
    });

    res.json({ reply });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
